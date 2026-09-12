import * as THREE from "three";
import { MODEL_URL } from "./modelUrl.ts";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SeatRig, seatsForRoom } from "./seats.ts";
import { buildOffice } from "./office.ts";
import { buildCabinetRoom, buildCapitol, buildPressRoom, buildResidence, buildStudy } from "./rooms.ts";
import { ROOM_INFO } from "./roomkit.ts";
import type { CastSlot, Door, RoomBuild, RoomId } from "./roomkit.ts";
import { CharacterAnimator, buildCharacter, buildCrowd } from "./character.ts";
import type { CrowdMember } from "./character.ts";
import { Stations } from "./stations.ts";
import { Doors } from "./doors.ts";
import { Sound } from "../audio/sound.ts";
import { loadProps } from "./assetLoader.ts";
import type { Footprint, LoadProgress } from "./assetLoader.ts";
import { PROPS_BY_ROOM } from "./props.ts";
import type { GameState, StationId } from "../game/types.ts";

/** Window light and mood shift with the season, so the term visibly passes. */
const SEASONS = [
  { color: 0xbfd4ea, intensity: 1.1, ambient: 0xd8e2f0 }, // winter
  { color: 0xf6ecd2, intensity: 1.6, ambient: 0xf2ecdc }, // spring
  { color: 0xfff2d2, intensity: 2.0, ambient: 0xfaf2df }, // summer
  { color: 0xf3d9a8, intensity: 1.4, ambient: 0xefe2cb }, // autumn
];

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

/** Ambient occlusion renders at half resolution; it is low-frequency anyway. */
const AO_SCALE = 0.5;

/** The five factions, left to right across the chamber. */
const FACTION_COLOURS = [0x5b7fb4, 0x6a8cbd, 0x87858c, 0xa8836d, 0xb26f68];

/** Textures that are data maps, not colour maps, and must stay linear. */
const DATA_TEXTURE_KEYS = new Set([
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "displacementMap",
  "bumpMap",
  "alphaMap",
  "clearcoatMap",
  "clearcoatRoughnessMap",
  "clearcoatNormalMap",
  "sheenRoughnessMap",
  "thicknessMap",
  "transmissionMap",
  "specularIntensityMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
]);

/** Sets colour-space textures to sRGB while leaving data maps linear. */
function applySRGB(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!material) continue;
    for (const [key, value] of Object.entries(material)) {
      if (value instanceof THREE.Texture && !DATA_TEXTURE_KEYS.has(key)) {
        value.colorSpace = THREE.SRGBColorSpace;
        value.needsUpdate = true;
      }
    }
  }
}

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
  private clock = new THREE.Clock();
  private ambient: THREE.AmbientLight;
  private hemisphere: THREE.HemisphereLight;
  private modelKey: THREE.DirectionalLight | null = null;
  private raf = 0;
  private raycaster = new THREE.Raycaster();
  private listener = new THREE.AudioListener();
  private month = 1;
  private state: GameState | null = null;
  /** Ambient occlusion and anti-aliasing, on hardware that can afford them. */
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  /** A rolling frame-time sample, used to drop the extra passes if needed. */
  private frameCost = 0;
  private frameSamples = 0;
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

    const plain = new URLSearchParams(location.search).has("plain");
    if (!plain) this.buildComposer();
    this.resize();
    window.addEventListener("resize", this.resize);

    void this.loadOvalOffice(MODEL_URL);
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

  /**
   * Loads the bundled Oval Office GLB from the release URL and replaces the
   * procedural Oval model.
   */
  private async loadOvalOffice(url: string): Promise<void> {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            applySRGB(mesh);
          }
        });

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

        this.addModelKeyLight(this.current.spawnLook);
        this.renderer.toneMappingExposure = ROOM_PRESENTATION.oval.exposure;
        this.syncPeople(this.state);
        this.onReady();

        console.log(
          `Oval Office model loaded (${model.children.length} root nodes, ${this.rig.seats.length} seats, at ${this.rig.currentId})`,
        );
      },
      (progress) => {
        const loadedMB = progress.loaded / 1048576;
        if (progress.total > 0) {
          const totalMB = progress.total / 1048576;
          const pct = (progress.loaded / progress.total) * 100;
          console.log(
            `Oval Office loading… ${pct.toFixed(1)}% (${loadedMB.toFixed(1)} MB / ${totalMB.toFixed(1)} MB)`,
          );
        } else {
          console.log(`Oval Office loading… ${loadedMB.toFixed(1)} MB`);
        }
      },
      (error) => {
        // The model is scenery. If it never arrives, show the procedural room
        // rather than leaving the player on a black screen.
        console.error("Oval Office model failed to load — showing procedural room", error);
        this.ovalPending = false;
        this.current.group.visible = true;
        this.onReady();
      },
    );
  }

  /** Adds a diffuse key light anchored to the discovered interior viewpoint. */
  private addModelKeyLight(target: THREE.Vector3): void {
    if (this.modelKey) return;
    const key = new THREE.DirectionalLight(0xfff2dc, 2.25);
    key.position.set(target.x + 4.5, target.y + 7.5, target.z + 6);
    key.target.position.copy(target);
    key.castShadow = false;
    this.scene.add(key);
    this.scene.add(key.target);
    this.modelKey = key;
  }

  private buildComposer(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const gtao = new GTAOPass(this.scene, this.camera, w * AO_SCALE, h * AO_SCALE);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.updateGtaoMaterial({
      radius: 0.3,
      distanceExponent: 1.4,
      thickness: 0.6,
      scale: 1.05,
      samples: 8,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
    this.gtao = gtao;

    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.4, 0.86);
    composer.addPass(bloom);
    this.bloom = bloom;

    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass(w, h));
    this.composer = composer;
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
    const key = this.castFingerprint(state);
    if (key === this.cast
