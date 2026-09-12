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
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SeatRig, buildSeats, logSeatCandidates } from "./seats.ts";
import { buildOffice } from "./office.ts";
import { buildCabinetRoom, buildCapitol, buildPressRoom, buildResidence, buildStudy } from "./rooms.ts";
import { ROOM_INFO } from "./roomkit.ts";
import type { CastSlot, Door, RoomBuild, RoomId } from "./roomkit.ts";
import { CharacterAnimator, buildCharacter, buildCrowd } from "./character.ts";
import type { CrowdMember } from "./character.ts";
import { PlayerController } from "./controls.ts";
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
  readonly player: PlayerController;
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
  private lastPosition = new THREE.Vector3();
  private month = 1;
  private state: GameState | null = null;
  /** Ambient occlusion and anti-aliasing, on hardware that can afford them. */
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  /** A rolling frame-time sample, used to drop the extra passes if needed. */
  private frameCost = 0;
  private frameSamples = 0;
  private horizontalFov = ROOM_PRESENTATION.oval.horizontalFov;
  /** Orbit controls for the loaded Oval Office viewer path. */
  private orbit: OrbitControls | null = null;
  /** Fixed seats in the loaded Oval Office. Null until the model arrives. */
  private rig: SeatRig | null = null;
  readonly sound = new Sound();
  /** Whether the player is on a touch screen, for UI sizing — not graphics quality. */
  readonly touch: boolean;

  onNearestChange: (station: StationId | null) => void = () => {};
  /** A tap or click that landed on a station. */
  onStationTap: (station: StationId) => void = () => {};
  /** A tap that landed near a door, with none open. */
  onDoorTap: () => void = () => {};
  /** The player has walked through a door into another room. */
  onRoomChange: (room: RoomId, name: string) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
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
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.lastPosition.copy(this.camera.position);
    this.stations = new Stations(this.scene, [], this.touch);
    this.doors = new Doors(this.scene);
    this.player.onTap = ({ x, y }) => {
      const station = this.pickStation(x, y);
      if (station) this.onStationTap(station);
      else if (this.doors.nearest) this.onDoorTap();
      else this.player.lock();
    };

    this.enterRoom("oval");
    const plain = new URLSearchParams(location.search).has("plain");
    if (!plain) this.buildComposer();
    this.resize();
    window.addEventListener("resize", this.resize);

    void this.loadOvalOffice(MODEL_URL);
  }

  /**
   * Loads the bundled Oval Office GLB from the release URL, replaces the
   * procedural Oval, and switches to orbit controls.
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

        if (this.current.id === "oval") this.current.group.visible = false;
        this.scene.add(model);
        model.updateMatrixWorld(true);

        logSeatCandidates(model);
        const seats = buildSeats(model);

        // The seated view is a head pivot, not an orbit: the eye is pinned to
        // the chair and drags rotate the head. OrbitControls is constructed
        // only so SeatRig can hold a handle; it is disabled immediately.
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.enabled = false;

        this.rig = new SeatRig(this.camera, this.orbit, seats, this.renderer.domElement);

        this.addModelKeyLight(seats[0].target);
        this.renderer.toneMappingExposure = 1.2;

        // Disable walker and release pointer/touch locks to OrbitControls
        this.player.setOrbitMode(true);

        console.log(
          `Oval Office model loaded (${model.children.length} root nodes, ${seats.length} seats, at ${this.rig.currentId})`,
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
        console.error("Oval Office model failed to load — keeping the procedural room", error);
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

  enterRoom(id: RoomId, arrivingFrom?: RoomId): void {
    const room = this.roomOf(id);
    if (this.current) this.current.group.visible = false;
    this.current = room;
    room.group.visible = true;
    const presentation = ROOM_PRESENTATION[id];
    this.horizontalFov = presentation.horizontalFov;
    this.renderer.toneMappingExposure = presentation.exposure;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = presentation.fogNear;
      this.scene.fog.far = presentation.fogFar;
    }

    const back = arrivingFrom ? room.doors.find((d) => d.to === arrivingFrom) : undefined;
    const spawn = back ? back.position.clone() : room.spawn.clone();
    const look = back ? room.spawnLook.clone() : room.spawnLook.clone();
    if (back) {
      const inward = spawn.clone().sub(back.facing).setY(0).normalize().multiplyScalar(1.1);
      spawn.add(inward);
    }
    this.player.teleport(spawn);
    this.player.lookAt(look);
    this.resize();

    this.player.colliders = room.colliders;
    this.player.clamp = room.clamp;
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
    // In the Oval the view moves between fixed seats.
    if (target === "oval" && this.rig) {
      this.rig.goTo(station === "phone" ? "phone" : "desk");
      return;
    }
    this.focus(station);
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
    if (key === this.castKey) return;
    this.castKey = key;

    this.people.clear();
    this.animator.clear();
    if (!this.current.cast.length) return;

    const crowd: CrowdMember[] = [];
    for (const slot of this.current.cast) {
      if (slot.role === "member" || slot.role === "press") {
        crowd.push({
          position: slot.position,
          rotationY: slot.rotationY,
          group: slot.role === "member" ? slot.index : 0,
          seed: Math.round(slot.position.x * 977 + slot.position.z * 131 + slot.position.y * 17),
        });
        continue;
      }
      const person = this.namedFor(slot, state);
      if (!person) continue;
      const character = buildCharacter({
        seed: person.seed,
        age: person.age,
        dress: person.dress,
        pose: slot.pose,
      });
      character.group.position.copy(slot.position);
      character.group.rotation.y = slot.rotationY;
      this.people.add(character.group);
      this.animator.add(character);
    }

    if (crowd.length) {
      const styles =
        this.current.id === "capitol"
          ? FACTION_COLOURS.map((suit) => ({ suit }))
          : [{ suit: 0x6d7382 }, { suit: 0x7a7263 }, { suit: 0x716577 }];
      this.people.add(buildCrowd(crowd, styles));
    }
  }

  private namedFor(
    slot: CastSlot,
    state: GameState | null,
  ): { seed: string; age?: number; dress?: "suit" | "smart" | "casual" } | null {
    if (slot.role === "cabinet") {
      const person = state?.cabinet?.[slot.index];
      return person ? { seed: person.name, dress: "suit" } : { seed: `secretary-${slot.index}`, dress: "suit" };
    }
    if (slot.role === "family") {
      const person = state?.family?.[slot.index];
      if (!person) return null;
      return {
        seed: person.name,
        age: person.age,
        dress: person.kind === "spouse" ? "smart" : "casual",
      };
    }
    return { seed: `aide-${slot.index}`, dress: "suit" };
  }

  private castFingerprint(state: GameState | null): string {
    if (!state) return `${this.current.id}:empty`;
    const cabinet = state.cabinet?.map((c) => c.name).join(",") ?? "";
    const family = state.family?.map((f) => f.name).join(",") ?? "";
    return `${this.current.id}|${cabinet}|${family}`;
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
    this.player.colliders = this.current.colliders;
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
    const season = SEASONS[Math.floor(((month - 1) % 12) / 3) % 4];
    const room = this.current;
    if (room.daylight) {
      room.daylight.color.setHex(season.color);
      room.daylight.intensity = season.intensity * (room.id === "study" ? 0.6 : 1);
    }
    this.hemisphere.color.setHex(season.ambient);
    for (const light of room.windowLights?.children ?? []) {
      if (light instanceof THREE.PointLight) {
        light.color.setHex(season.color);
        light.intensity = 2.5 + season.intensity * 1.6;
      }
    }
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

  focus(station: StationId): void {
    const target = this.stations.focusOf(station);
    if (target) this.player.lookAt(target);
  }

  get nearestDoor(): Door | null {
    return this.doors.nearest;
  }

  useDoor(): boolean {
    const door = this.doors.nearest;
    if (!door) return false;
    const from = this.current.id;
    this.enterRoom(door.to, from);
    return true;
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.gtao?.setSize(w * AO_SCALE, h * AO_SCALE);
    this.bloom?.setSize(w, h);
    this.camera.aspect = w / h;
    // While seated the rig owns the field of view; outside it,
    // derives it from the room's horizontal FOV.
    if (!this.rig) {
      const targetHorizontal = (this.horizontalFov * Math.PI) / 180;
      const vertical = 2 * Math.atan(Math.tan(targetHorizontal / 2) / this.camera.aspect);
      this.camera.fov = Math.min(86, Math.max(52, (vertical * 180) / Math.PI));
    }
    this.camera.updateProjectionMatrix();
    this.stations.setLabelScale(w < 620 ? 0.66 : 1);
  };

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());

      if (this.orbit) {
        this.rig?.update(dt);
      } else {
        this.player.update(dt);
        this.sound.update(this.camera.position.distanceTo(this.lastPosition));
        this.lastPosition.copy(this.camera.position);
      }

      const before = this.stations.nearest;
      const nearest = this.stations.update(dt, this.camera.position);
      if (nearest !== before) this.onNearestChange(nearest);
      this.doors.update(dt, this.camera.position);
      this.animator.update(dt, this.camera.position);
      if (this.composer) {
        const t0 = performance.now();
        this.composer.render();
        this.measure(performance.now() - t0);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  private measure(ms: number): void {
    if (!this.composer) return;
    this.frameSamples += 1;
    if (this.frameSamples < 8) return;
    if (ms > 120) {
      this.dropComposer();
      return;
    }
    if (this.frameSamples > 32) return;
    this.frameCost += ms;
    if (this.frameSamples === 32 && this.frameCost / 24 > 22) this.dropComposer();
  }

  get composerActive(): boolean {
    return this.composer !== null;
  }

  private dropComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    this.gtao = null;
    this.bloom = null;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
