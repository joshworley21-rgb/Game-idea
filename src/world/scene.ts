import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
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
import type { LoadProgress } from "./assetLoader.ts";
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

/** How long an in-room camera move to a different station takes. */
const PAN_DURATION = 0.7;

/** The five factions, left to right across the chamber. */
const FACTION_COLOURS = [0x5b7fb4, 0x6a8cbd, 0x87858c, 0xa8836d, 0xb26f68];

const ROOM_PRESENTATION: Record<RoomId, {
  horizontalFov: number;
  exposure: number;
  fogNear: number;
  fogFar: number;
}> = {
  oval: { horizontalFov: 82, exposure: 1.08, fogNear: 18, fogFar: 44 },
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
  private hemisphere: THREE.HemisphereLight;
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
  readonly sound = new Sound();

  /** A tap or click that landed on a station. */
  onStationTap: (station: StationId) => void = () => {};
  /** A tap or click that landed on a door. */
  onDoorTap: (door: Door) => void = () => {};
  /** The room changed — a cut, not something the player walked through. */
  onRoomChange: (room: RoomId, name: string) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    // The game only ships as an Android app now, on hardware at or above a
    // Galaxy S22+: no browser fallback to keep light for, so the renderer
    // asks for the full picture and leans on the frame-time watchdog below
    // (see `measure`) rather than a device guess to catch anything that
    // actually can't keep up.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // The composer's SMAA pass handles anti-aliasing; MSAA on top of that
      // would just double the cost for no visible gain.
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x1a1712, 18, 46);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.scene.add(this.people);

    this.hemisphere = new THREE.HemisphereLight(0xf6f1e4, 0x6b5a44, 0.42);
    this.scene.add(this.hemisphere);

    // The furniture models are physically based, and PBR materials go flat and
    // dark without something to reflect. A generated room environment gives
    // them that, and it costs one texture rather than a light rig.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();

    this.camera.add(this.listener);
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.lastPosition.copy(this.camera.position);
    this.stations = new Stations(this.scene, []);
    this.doors = new Doors(this.scene);
    this.player.onTap = ({ x, y }) => {
      const station = this.pickStation(x, y);
      if (station) {
        this.onStationTap(station);
        return;
      }
      const door = this.pickDoor(x, y);
      if (door) this.onDoorTap(door);
    };

    this.enterRoom("oval");
    // `?plain` turns the extra passes off, for local debugging.
    const plain = new URLSearchParams(location.search).has("plain");
    if (!plain) this.buildComposer();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  /**
   * Ambient occlusion is what stops furniture looking like it is hovering: the
   * darkening where a chair leg meets the floor is doing more for the picture
   * than another thousand polygons would. Every device gets the full chain;
   * `measure` below is what actually catches hardware that cannot afford it.
   */
  private buildComposer(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    // Half resolution: occlusion is low-frequency, and the denoise pass is
    // what actually sells it, so the extra pixels buy nothing.
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

    // A light bloom, so the windows, the fire and the chandeliers actually
    // glow instead of just being a bright flat patch. Threshold is high and
    // strength is low: this should only catch real highlights, not wash out
    // the room.
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

  /** Builds a room the first time the president walks into it. */
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

  /**
   * Cuts straight to a room: swaps the geometry, places the camera at the
   * room's establishing shot, and rebuilds the markers and the people
   * inside. Instant — a caller taking the player through a cutscene calls
   * this while the screen is hidden behind a fade.
   */
  enterRoom(id: RoomId): void {
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

    this.player.teleport(room.spawn, room.spawnEyeHeight);
    this.player.lookAt(room.spawnLook);
    // A teleport is a cut, not a step: the footstep-by-distance sound would
    // otherwise read the jump itself as one very long stride.
    this.lastPosition.copy(this.camera.position);
    this.resize();

    this.stations.rebuild(room.anchors);
    this.doors.rebuild(room.doors);
    this.castKey = "";
    this.syncPeople(this.state);
    this.setMonth(this.month);
    if (room.fireplace) this.sound.attachRoom(this.listener, room.fireplace, room.clockSpot ?? room.fireplace);
    this.onRoomChange(id, ROOM_INFO[id].name);
  }

  /** Which room a station lives in — for a caller deciding pan vs. cutscene. */
  roomOfStation(station: StationId): RoomId {
    return STATION_ROOM[station];
  }

  /** Animates the camera to a station's vantage within the current room. */
  panToStation(station: StationId): void {
    const anchor = this.stations.anchorOf(station);
    if (anchor) this.player.panTo(anchor.position, anchor.focus, undefined, PAN_DURATION);
  }

  /** Cuts straight to a station's vantage — for right after enterRoom(), hidden by a fade. */
  snapToStation(station: StationId): void {
    const anchor = this.stations.anchorOf(station);
    if (!anchor) return;
    this.player.teleport(anchor.position);
    this.lastPosition.copy(this.camera.position);
    this.player.lookAt(anchor.focus);
  }

  // ------------------------------------------------------------------ people

  /**
   * Fills the current room with whoever belongs in it. Rebuilt whenever the
   * cast could have changed — a secretary resigns, a child's mood moves — and
   * skipped when nothing has.
   */
  syncPeople(state: GameState | null): void {
    this.state = state;
    const key = this.castFingerprint(state);
    if (key === this.castKey) return;
    this.castKey = key;

    this.people.clear();
    this.animator.clear();
    if (!this.current.cast.length) return;

    // Anonymous crowds are instanced; named people are built properly.
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

  /** Who a slot refers to in the current game state. */
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

  /** Changes worth rebuilding the cast for. */
  private castFingerprint(state: GameState | null): string {
    if (!state) return `${this.current.id}:empty`;
    const cabinet = state.cabinet?.map((c) => c.name).join(",") ?? "";
    const family = state.family?.map((f) => f.name).join(",") ?? "";
    return `${this.current.id}|${cabinet}|${family}`;
  }

  // ------------------------------------------------------------------ setup

  /** Fetches the furniture models and adds them to each room. */
  async loadAssets(onProgress?: (progress: LoadProgress) => void): Promise<number> {
    const propGroups = new Map<RoomId, THREE.Object3D>();
    for (const id of Object.keys(PROPS_BY_ROOM) as RoomId[]) {
      const room = this.roomOf(id);
      const props = new THREE.Group();
      props.name = `${id}-signature-props`;
      room.group.add(props);
      propGroups.set(id, props);
    }
    return loadProps(propGroups, onProgress);
  }

  /**
   * Starts audio. Must be called from a user gesture: browsers refuse to open
   * an AudioContext any other way.
   */
  startAudio(): void {
    this.sound.start(this.listener);
    const room = this.current;
    if (room.fireplace) {
      this.sound.attachRoom(this.listener, room.fireplace, room.clockSpot ?? room.fireplace);
    }
  }

  /** Repaints the light for the month, 1-48. */
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

  /** The screen-to-world raycast shared by pickStation and pickDoor. */
  private ndcAt(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  /** The station under a screen point, for tap and click to open. */
  pickStation(clientX: number, clientY: number): StationId | null {
    this.raycaster.setFromCamera(this.ndcAt(clientX, clientY), this.camera);
    return this.stations.pick(this.raycaster);
  }

  /** The door under a screen point, for tap and click to go through. */
  pickDoor(clientX: number, clientY: number): Door | null {
    this.raycaster.setFromCamera(this.ndcAt(clientX, clientY), this.camera);
    return this.doors.pick(this.raycaster);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.gtao?.setSize(w * AO_SCALE, h * AO_SCALE);
    this.bloom?.setSize(w, h);
    this.camera.aspect = w / h;
    // three's fov is vertical, so a portrait phone would crush the horizontal
    // view to a slot. Hold the horizontal field steady and derive the vertical.
    const targetHorizontal = (this.horizontalFov * Math.PI) / 180;
    const vertical = 2 * Math.atan(Math.tan(targetHorizontal / 2) / this.camera.aspect);
    this.camera.fov = Math.min(86, Math.max(52, (vertical * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
    // World-space labels need to shrink on a small screen or they swamp it.
    this.stations.setLabelScale(w < 620 ? 0.66 : 1);
  };

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.player.update(dt);
      this.sound.update(this.camera.position.distanceTo(this.lastPosition));
      this.lastPosition.copy(this.camera.position);
      this.stations.update(dt);
      this.doors.update(dt);
      this.animator.update(dt, this.camera.position);
      this.current.animate?.(dt, this.clock.elapsedTime);
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

  /**
   * Watches what the extra passes actually cost on this machine. Software
   * renderers and weak integrated GPUs cannot afford ambient occlusion, and a
   * beautiful eight-frames-a-second is worse than a plain thirty, so if the
   * first second of rendering is slow the composer is dropped for good.
   */
  private measure(ms: number): void {
    if (!this.composer) return;
    // Skip the first few frames: shader compilation lands in those.
    this.frameSamples += 1;
    if (this.frameSamples < 8) return;
    // A single catastrophic frame is enough: a software renderer does not need
    // twenty more samples to prove it cannot afford this.
    if (ms > 120) {
      this.dropComposer();
      return;
    }
    if (this.frameSamples > 32) return;
    this.frameCost += ms;
    if (this.frameSamples === 32 && this.frameCost / 24 > 22) this.dropComposer();
  }

  /** Whether the extra passes are still running on this machine. */
  get composerActive(): boolean {
    return this.composer !== null;
  }

  /** Falls back to rendering straight to the canvas, for good. */
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
