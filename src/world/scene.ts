import * as THREE from "three";
import { buildOffice } from "./office.ts";
import type { OfficeBuild } from "./office.ts";
import { PlayerController } from "./controls.ts";
import { Stations } from "./stations.ts";
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

  onNearestChange: (station: StationId | null) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;

    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.Fog(0x1a1712, 14, 30);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.office = buildOffice();
    this.scene.add(this.office.group);

    this.hemisphere = new THREE.HemisphereLight(0xf6f1e4, 0x6b5a44, 0.42);
    this.scene.add(this.hemisphere);

    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.stations = new Stations(this.scene, this.office.anchors);

    this.resize();
    window.addEventListener("resize", this.resize);
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

  focus(station: StationId): void {
    const target = this.stations.focusOf(station);
    if (target) this.player.lookAt(target);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.player.update(dt);
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
