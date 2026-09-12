import * as THREE from "three";
import { STATION_INFO } from "../game/actions.ts";
import type { StationId } from "../game/types.ts";
import type { StationAnchor } from "./roomkit.ts";

function labelTexture(title: string, hint: string, active: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const radius = 26;
  ctx.beginPath();
  ctx.roundRect(6, 34, 500, 92, radius);
  ctx.fillStyle = active ? "rgba(20,28,44,0.92)" : "rgba(16,20,30,0.62)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? "rgba(226,193,110,0.95)" : "rgba(226,220,205,0.28)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = active ? "#f6e9c8" : "rgba(238,232,220,0.72)";
  ctx.font = "600 34px Georgia, 'Times New Roman', serif";
  ctx.fillText(title, 256, 74);

  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillStyle = active ? "rgba(226,193,110,0.95)" : "rgba(238,232,220,0.42)";
  ctx.fillText(hint, 256, 108);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface StationVisual {
  anchor: StationAnchor;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  sprite: THREE.Sprite;
  /** Invisible volume so a tap or click can open the station directly. */
  hit: THREE.Mesh;
  badge: number;
  active: boolean;
}

/** Floor markers that make the room's interactive points legible. */
export class Stations {
  private visuals: StationVisual[] = [];
  private clock = 0;
  private labelScale = 1;
  private touch: boolean;
  nearest: StationId | null = null;

  private scene: THREE.Scene;
  private group = new THREE.Group();

  constructor(scene: THREE.Scene, anchors: StationAnchor[], touch = false) {
    this.touch = touch;
    this.scene = scene;
    this.scene.add(this.group);
    this.rebuild(anchors);
  }

  /** Replaces every marker, for when the president switches rooms or viewpoints. */
  rebuild(anchors: StationAnchor[]): void {
    for (const v of this.visuals) {
      v.ring.geometry.dispose();
      v.ring.material.dispose();
      (v.sprite.material.map as THREE.Texture | null)?.dispose();
      v.sprite.material.dispose();
      v.hit.geometry.dispose();
    }
    this.group.clear();
    this.visuals = [];
    this.nearest = null;
    for (const anchor of anchors) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 40),
        new THREE.MeshBasicMaterial({
          color: 0xe2c16e,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(anchor.position).setY(0.02);
      this.group.add(ring);

      const info = STATION_INFO[anchor.id];
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: labelTexture(info.name, "tap to open", false),
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.copy(anchor.position).setY(1.62);
      sprite.scale.set(1.5, 0.47, 1);
      sprite.userData.baseScale = [1.5, 0.47];
      sprite.renderOrder = 10;
      this.group.add(sprite);

      // Fully transparent rather than `visible: false`, which the raycaster skips.
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 2.4, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.copy(anchor.position).setY(1.2);
      hit.userData.stationId = anchor.id;
      this.group.add(hit);

      this.visuals.push({ anchor, ring, sprite, hit, badge: 0, active: false });
    }
  }

  /** Marks a station as demanding attention (a pending crisis, a due budget). */
  setBadge(id: StationId, count: number): void {
    const v = this.visuals.find((s) => s.anchor.id === id);
    if (!v || v.badge === count) return;
    v.badge = count;
    this.refreshLabel(v);
  }

  private refreshLabel(v: StationVisual): void {
    const info = STATION_INFO[v.anchor.id];
    const hint = v.badge > 0 ? "NEEDS YOU NOW" : "tap to open";
    v.sprite.material.map?.dispose();
    v.sprite.material.map = labelTexture(info.name, hint, v.badge > 0);
    v.sprite.material.needsUpdate = true;
  }

  update(dt: number): void {
    this.clock += dt;
    for (const v of this.visuals) {
      const urgent = v.badge > 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * (urgent ? 5 : 2) + v.anchor.position.x);
      v.ring.material.opacity = (urgent ? 0.4 : 0.18) + pulse * (urgent ? 0.35 : 0.14);
      v.ring.material.color.setHex(urgent ? 0xe06a4a : 0xe2c16e);
      v.ring.scale.setScalar(1 + pulse * 0.03);
      v.sprite.position.y = 1.62 + Math.sin(this.clock * 1.4 + v.anchor.position.z) * 0.03;
      v.sprite.material.opacity = urgent ? 0.95 : 0.6;
    }
  }

  /** Shrinks the floating labels on small screens. */
  setLabelScale(factor: number): void {
    if (this.labelScale === factor) return;
    this.labelScale = factor;
    for (const v of this.visuals) {
      const [x, y] = v.sprite.userData.baseScale as [number, number];
      v.sprite.scale.set(x * factor, y * factor, 1);
    }
  }

  /** The station under a screen point, if any. */
  pick(raycaster: THREE.Raycaster): StationId | null {
    const hits = raycaster.intersectObjects(this.visuals.map((v) => v.hit), false);
    const id = hits[0]?.object.userData.stationId;
    return typeof id === "string" ? (id as StationId) : null;
  }

  focusOf(id: StationId): THREE.Vector3 | null {
    return this.visuals.find((v) => v.anchor.id === id)?.anchor.focus ?? null;
  }
}
