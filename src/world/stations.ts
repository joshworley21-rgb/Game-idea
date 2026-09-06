import * as THREE from "three";
import { STATION_INFO } from "../game/actions.ts";
import type { StationId } from "../game/types.ts";
import type { StationAnchor } from "./office.ts";

const REACH = 1.9;

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
  badge: number;
  active: boolean;
}

/** Floor markers that make the room's interactive points legible. */
export class Stations {
  private visuals: StationVisual[] = [];
  private clock = 0;
  nearest: StationId | null = null;

  constructor(scene: THREE.Scene, anchors: Record<StationId, StationAnchor>) {
    for (const anchor of Object.values(anchors)) {
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
      scene.add(ring);

      const info = STATION_INFO[anchor.id];
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: labelTexture(info.name, "walk closer", false),
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.copy(anchor.position).setY(1.62);
      sprite.scale.set(1.5, 0.47, 1);
      sprite.renderOrder = 10;
      scene.add(sprite);

      this.visuals.push({ anchor, ring, sprite, badge: 0, active: false });
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
    const hint = v.badge > 0 ? "NEEDS YOU NOW" : v.active ? "press E to open" : "walk closer";
    v.sprite.material.map?.dispose();
    v.sprite.material.map = labelTexture(info.name, hint, v.active || v.badge > 0);
    v.sprite.material.needsUpdate = true;
  }

  update(dt: number, playerPosition: THREE.Vector3): StationId | null {
    this.clock += dt;
    let best: StationVisual | null = null;
    let bestDist = REACH;

    for (const v of this.visuals) {
      const dist = v.anchor.position.distanceTo(
        new THREE.Vector3(playerPosition.x, 0, playerPosition.z),
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = v;
      }
    }

    for (const v of this.visuals) {
      const active = v === best;
      if (active !== v.active) {
        v.active = active;
        this.refreshLabel(v);
      }
      const urgent = v.badge > 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * (urgent ? 5 : 2) + v.anchor.position.x);
      v.ring.material.opacity = (active ? 0.55 : urgent ? 0.4 : 0.18) + pulse * (urgent ? 0.35 : 0.14);
      v.ring.material.color.setHex(urgent ? 0xe06a4a : 0xe2c16e);
      const scale = active ? 1.12 : 1;
      v.ring.scale.setScalar(scale + pulse * 0.03);
      v.sprite.position.y = 1.62 + Math.sin(this.clock * 1.4 + v.anchor.position.z) * 0.03;
      v.sprite.material.opacity = active ? 1 : urgent ? 0.95 : 0.6;
    }

    this.nearest = best?.anchor.id ?? null;
    return this.nearest;
  }

  focusOf(id: StationId): THREE.Vector3 | null {
    return this.visuals.find((v) => v.anchor.id === id)?.anchor.focus ?? null;
  }
}
