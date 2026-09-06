import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildOffice } from "./office.ts";
import type { OfficeBuild } from "./office.ts";
import { PlayerController } from "./controls.ts";
import { Stations } from "./stations.ts";
import { Sound } from "../audio/sound.ts";
import { loadProps } from "./assetLoader.ts";
import type { Footprint, LoadProgress } from "./assetLoader.ts";
import type { StationId } from "../game/types.ts";

/** Window light and mood shift with the season, so the term visibly passes. */
const SEASONS = [
  { color: 0xbfd4ea, intensity: 1.1, ambient: 0xd8e2f0 }, // winter
  { color: 0xf6ecd2, intensity: 1.6, ambient: 0xf2ecdc }, // spring
  { color: 0xfff2d2, intensity: 2.0, ambient: 0xfaf2df }, // summer
  { color: 0xf3d9a8, intensity: 1.4, ambient: 0xefe2cb }, // autumn
];

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly player: PlayerController;
  readonly stations: Stations;
  private office: OfficeBuild;
  private clock = new THREE.Clock();
  private hemisphere: THREE.HemisphereLight;
  private raf = 0;
  private raycaster = new THREE.Raycaster();
  private listener = new THREE.AudioListener();
  private lastPosition = new THREE.Vector3();
  readonly sound = new Sound();
  /** True on phones and tablets, where the GPU budget is much smaller. */
  readonly lowPower: boolean;

  onNearestChange: (station: StationId | null) => void = () => {};
  /** A tap or click that landed on a station. */
  onStationTap: (station: StationId) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.lowPower = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.lowPower,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.lowPower ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x1a1712, 14, 30);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.office = buildOffice(this.lowPower);
    this.scene.add(this.office.group);

    this.hemisphere = new THREE.HemisphereLight(0xf6f1e4, 0x6b5a44, 0.42);
    this.scene.add(this.hemisphere);

    // The furniture models are physically based, and PBR materials go flat and
    // dark without something to reflect. A generated room environment gives
    // them that, and it costs one texture rather than a light rig.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera.add(this.listener);
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.lastPosition.copy(this.camera.position);
    this.stations = new Stations(this.scene, this.office.anchors, this.lowPower);
    this.player.onTap = ({ x, y }) => {
      const station = this.pickStation(x, y);
      if (station) this.onStationTap(station);
      else this.player.lock();
    };

    this.resize();
    // A tall screen otherwise opens on a wall of ceiling; frame the desk.
    if (window.innerHeight > window.innerWidth) {
      this.player.lookAt(new THREE.Vector3(0, 1.0, -2.75));
    }
    window.addEventListener("resize", this.resize);
  }

  /** Fetches the furniture models, adds them, and makes them solid. */
  async loadAssets(onProgress?: (progress: LoadProgress) => void): Promise<number> {
    const footprints: Footprint[] = [];
    const count = await loadProps(this.scene, onProgress, footprints);
    // The Resolute desk is built in code rather than loaded, so it needs its
    // footprint added by hand.
    footprints.push({ minX: -1.25, maxX: 1.25, minZ: -3.5, maxZ: -2.1 });
    this.player.colliders = footprints;
    return count;
  }

  /**
   * Starts audio. Must be called from a user gesture: browsers refuse to open
   * an AudioContext any other way.
   */
  startAudio(): void {
    this.sound.start(this.listener);
    this.sound.attachRoom(this.listener, this.office.fireplace, this.office.clockSpot);
  }

  /** Repaints the light for the month, 1-48. */
  setMonth(month: number): void {
    const season = SEASONS[Math.floor(((month - 1) % 12) / 3) % 4];
    this.office.daylight.color.setHex(season.color);
    this.office.daylight.intensity = season.intensity;
    this.hemisphere.color.setHex(season.ambient);
    for (const light of this.office.windowLights.children) {
      if (light instanceof THREE.PointLight) {
        light.color.setHex(season.color);
        light.intensity = 2.5 + season.intensity * 1.6;
      }
    }
  }

  /** The station under a screen point, for tap and click to open. */
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

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // three's fov is vertical, so a portrait phone would crush the horizontal
    // view to a slot. Hold the horizontal field steady and derive the vertical.
    const targetHorizontal = (88 * Math.PI) / 180;
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
      const before = this.stations.nearest;
      const nearest = this.stations.update(dt, this.camera.position);
      if (nearest !== before) this.onNearestChange(nearest);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
