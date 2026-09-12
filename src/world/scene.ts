import * as THREE from "three";
import { MODEL_URL } from "./modelUrl.ts";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SeatRig, seatsForRoom } from "./seats.ts";
import { buildOffice } from "./office.ts";
import { buildCabinetRoom, buildCapitol, buildPressRoom, buildResidence, buildStudy } from "./rooms.ts";
import { ROOM_INFO } from "./roomkit.ts";
import type { Door, RoomBuild, RoomId } from "./roomkit.ts";
import { CharacterAnimator } from "./character.ts";
import { Stations } from "./stations.ts";
import { Doors } from "./doors.ts";
import { Sound } from "../audio/sound.ts";
import { loadProps } from "./assetLoader.ts";
import type { Footprint, LoadProgress } from "./assetLoader.ts";
import { PROPS_BY_ROOM } from "./props.ts";
import { applySeason, addModelKeyLight } from "./lighting.ts";
import { buildCast, castFingerprint } from "./cast.ts";
import { loadOvalOffice } from "./ovalLoader.ts";
import { RenderLoop } from "./renderLoop.ts";
import { OVAL_GRADE, CABINET_GRADE, CAPITOL_GRADE, PRESS_GRADE, RESIDENCE_GRADE, STUDY_GRADE } from "./postfx.ts";
import type { Grade } from "./postfx.ts";
import type { GameState, StationId } from "../game/types.ts";

/** Which room each station lives in, now that they are not all in the Oval. */
export const STATION_ROOM: Record<StationId, RoomId> = {
  desk: "oval",
  phone: "oval",
  budget: "cabinet",
  staff: "cabinet",
  floor: "capitol",
  press: "press",
  family: "residence",
  rest: "study",
};

/** Per-room grade, so each space has its own mood and not just its own lights. */
const ROOM_GRADES: Record<RoomId, Grade> = {
  oval: OVAL_GRADE,
  cabinet: CABINET_GRADE,
  capitol: CAPITOL_GRADE,
  press: PRESS_GRADE,
  residence: RESIDENCE_GRADE,
  study: STUDY_GRADE,
};

const ROOM_PRESENTATION: Record<RoomId, {
  horizontalFov: number;
  exposure: number;
  fogNear: number;
  fogFar: number;
}> = {
  oval: { horizontalFov: 82, exposure: 1.2, fogNear: 18, fogFar: 44 },
  cabinet: { horizontalFov: 78, exposure: 1.02, fogNear: 16, fogFar: 38 },
  capitol: { horizontalFov: 92, exposure: 1.12, fogNear: 25, fogFar: 62 },
  press: { horizontalFov: 76, exposure: 0.98, fogNear: 14, fogFar: 34 },
  residence: { horizontalFov: 74, exposure: 1.12, fogNear: 13, fogFar: 32 },
  study: { horizontalFov: 70, exposure: 1.08, fogNear: 10, fogFar: 25 },
};

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly stations: Stations;
  readonly doors: Doors;
  private rooms = new Map<RoomId, RoomBuild>();
  private current!: RoomBuild;
  /** People currently in the room, rebuilt whenever the cast could have changed. */
  private people = new THREE.Group();
  private animator = new CharacterAnimator();
  private castKey = "";
  private ambient: THREE.AmbientLight;
  private hemisphere: THREE.HemisphereLight;
  private modelKey: THREE.DirectionalLight | null = null;
  private raycaster = new THREE.Raycaster();
  private listener = new THREE.AudioListener();
  private month = 1;
  private state: GameState | null = null;
  private loop: RenderLoop;
  /** Fixed seat rig controlling camera position and head rotation. */
  private rig: SeatRig | null = null;
  private canvas: HTMLCanvasElement;
  private tapStart = { x: 0, y: 0, t: 0 };
  /** True until the Oval GLB has replaced the procedural stand-in. */
  private ovalPending = true;
  readonly sound = new Sound();
  /** Whether the player is on a touch screen, for UI sizing — not graphics quality. */
  readonly touch: boolean;

  onNearestChange: (station: StationId | null) => void = () => {};
  /** A tap or click that landed on a station. */
  onStationTap: (station: StationId) => void = () => {};
  /** A tap that landed on a door. */
  onDoorTap: (door: Door) => void = () => {};
  /** The player has moved through a door or station into another room. */
  onRoomChange: (room: RoomId, name: string) => void = () => {};
  /** Fires once the Oval is ready to be shown. */
  onReady: () => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x1a1712, 18, 46);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.scene.add(this.people);

    this.ambient = new THREE.AmbientLight(0xfff3e0, 1.6);
    this.scene.add(this.ambient);

    this.hemisphere = new THREE.HemisphereLight(0xf6f1e4, 0x6b5a44, 0.9);
    this.scene.add(this.hemisphere);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    this.scene.environmentIntensity = 0.8;
    pmrem.dispose();

    this.camera.add(this.listener);
    this.stations = new Stations(this.scene, [], this.touch);
    this.doors = new Doors(this.scene);

    canvas.addEventListener("pointerdown", (e) => {
      this.tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener("pointerup", this.onCanvasTap);

    // The Oval is built but stays hidden until its model arrives, so the
    // procedural stand-in is never on screen.
    this.enterRoom("oval");
    this.current.group.visible = false;

    this.loop = new RenderLoop(this.renderer, this.scene, this.camera, (dt) => this.tick(dt));
    const plain = new URLSearchParams(location.search).has("plain");
    if (!plain) this.loop.build(ROOM_GRADES.oval);
    this.resize();
    window.addEventListener("resize", this.resize);

    void this.loadOval(MODEL_URL);
  }

  /** One frame of simulation, before the frame is drawn. */
  private tick(dt: number): void {
    this.rig?.update(dt);
    this.stations.update(dt);
    this.doors.update(dt, this.camera);
    this.animator.update(dt, this.camera.position);
  }

  private onCanvasTap = (e: PointerEvent): void => {
    const dt = performance.now() - this.tapStart.t;
    const dist = Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y);
    if (dt > 400 || dist > 14) return;

    const station = this.pickStation(e.clientX, e.clientY);
    if (station) {
      this.onStationTap(station);
      return;
    }
    const door = this.doors.pick(e.clientX, e.clientY, this.camera, this.canvas);
    if (door) this.onDoorTap(door);
  };

  /** Loads the Oval GLB and swaps it in for the procedural stand-in. */
  private async loadOval(url: string): Promise<void> {
    loadOvalOffice(url, {
      onLoaded: (model) => {
        this.scene.add(model);
        model.updateMatrixWorld(true);

        // Seats come from the procedural room's anchors, which describe the
        // same furniture the model does. The model is scenery; the anchors
        // are the truth the rest of the game reads.
        this.ovalPending = false;
        this.current.group.visible = false;
        this.rig?.dispose();
        this.rig = new SeatRig(this.camera, seatsForRoom(this.current), this.canvas);
        this.stations.rebuild(this.current.anchors);
        this.doors.rebuild(this.current.doors);

        this.modelKey = addModelKeyLight(this.scene, this.current.spawnLook);
        this.renderer.toneMappingExposure = ROOM_PRESENTATION.oval.exposure;
        this.syncPeople(this.state);
        this.onReady();

        console.log(
          `Oval Office model loaded (${model.children.length} root nodes, ${this.rig.seats.length} seats, at ${this.rig.currentId})`,
        );
      },
      onError: (error) => {
        // The model is scenery. If it never arrives, show the procedural room
        // rather than leaving the player on a black screen.
        console.error("Oval Office model failed to load — showing procedural room", error);
        this.ovalPending = false;
        this.current.group.visible = true;
        this.onReady();
      },
    });
  }

  // ------------------------------------------------------------------ rooms

  get room(): RoomId {
    return this.current.id;
  }

  get roomName(): string {
    return ROOM_INFO[this.current.id].name;
  }

  private roomOf(id: RoomId): RoomBuild {
    let room = this.rooms.get(id);
    if (!room) {
      room =
        id === "oval"
          ? buildOffice()
          : id === "cabinet"
            ? buildCabinetRoom()
            : id === "capitol"
              ? buildCapitol()
              : id === "press"
                ? buildPressRoom()
                : id === "residence"
                  ? buildResidence()
                  : buildStudy();
      room.group.visible = false;
      this.scene.add(room.group);
      this.rooms.set(id, room);
    }
    return room;
  }

  enterRoom(id: RoomId): void {
    const room = this.roomOf(id);
    if (this.current) this.current.group.visible = false;
    this.current = room;
    // The Oval stays dark until its model has loaded.
    room.group.visible = !(id === "oval" && this.ovalPending);

    const presentation = ROOM_PRESENTATION[id];
    this.renderer.toneMappingExposure = presentation.exposure;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = presentation.fogNear;
      this.scene.fog.far = presentation.fogFar;
    }

    this.rig?.dispose();
    this.rig = new SeatRig(this.camera, seatsForRoom(room), this.canvas);

    this.resize();
    this.stations.rebuild(room.anchors);
    this.doors.rebuild(room.doors);
    this.loop.setGrade(ROOM_GRADES[id]);
    this.castKey = "";
    this.syncPeople(this.state);
    this.setMonth(this.month);
    if (room.fireplace) this.sound.attachRoom(this.listener, room.fireplace, room.clockSpot ?? room.fireplace);
    this.onRoomChange(id, ROOM_INFO[id].name);
  }

  goToStation(station: StationId): void {
    const target = STATION_ROOM[station];
    if (target !== this.current.id) this.enterRoom(target);
    this.rig?.goTo(station);
  }

  /** The seat the camera is at, or heading to. */
  get seat(): string | null {
    return this.rig?.currentId ?? null;
  }

  /** Moves the view to a fixed seat position by id. */
  goToSeat(id: string): boolean {
    return this.rig?.goTo(id) ?? false;
  }

  // ------------------------------------------------------------------ people

  syncPeople(state: GameState | null): void {
    this.state = state;
    const key = castFingerprint(this.current.id, state);
    if (key === this.castKey) return;
    this.castKey = key;
    buildCast(this.current.id, this.current.cast, state, this.people, this.animator);
  }

  // ------------------------------------------------------------------ setup

  async loadAssets(onProgress?: (progress: LoadProgress) => void): Promise<number> {
    const propGroups = new Map<RoomId, THREE.Object3D>();
    const footprints = new Map<RoomId, Footprint[]>();
    for (const id of Object.keys(PROPS_BY_ROOM) as RoomId[]) {
      const room = this.roomOf(id);
      const props = new THREE.Group();
      props.name = `${id}-signature-props`;
      room.group.add(props);
      propGroups.set(id, props);
      footprints.set(id, []);
    }
    const count = await loadProps(propGroups, onProgress, footprints);
    for (const [id, roomFootprints] of footprints) {
      const room = this.roomOf(id);
      room.colliders = [...room.colliders, ...roomFootprints];
    }
    return count;
  }

  startAudio(): void {
    this.sound.start(this.listener);
    const room = this.current;
    if (room.fireplace) {
      this.sound.attachRoom(this.listener, room.fireplace, room.clockSpot ?? room.fireplace);
    }
  }

  setMonth(month: number): void {
    this.month = month;
    applySeason(this.current, month, this.hemisphere);
  }

  pickStation(clientX: number, clientY: number): StationId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.stations.pick(this.raycaster);
  }

  get nearestDoor(): Door | null {
    return this.doors.nearest;
  }

  useDoor(door: Door): boolean {
    this.enterRoom(door.to);
    return true;
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.loop.resize();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.stations.setLabelScale(w < 620 ? 0.66 : 1);
  };

  start(): void {
    this.loop.start();
  }

  get composerActive(): boolean {
    return this.loop.active;
  }

  stop(): void {
    this.loop.stop();
  }
}
