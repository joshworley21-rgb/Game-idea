import * as THREE from "three";
import type { Door } from "./roomkit.ts";

const REACH = 1.6;

function labelTexture(label: string, active: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.roundRect(6, 22, 500, 84, 22);
  ctx.fillStyle = active ? "rgba(18,26,40,0.94)" : "rgba(14,18,28,0.55)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? "rgba(226,193,110,0.95)" : "rgba(226,220,205,0.24)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = active ? "#f6e9c8" : "rgba(238,232,220,0.68)";
  ctx.font = "600 30px Georgia, 'Times New Roman', serif";
  ctx.fillText(label, 256, 58);
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillStyle = active ? "rgba(226,193,110,0.95)" : "rgba(238,232,220,0.4)";
  ctx.fillText(active ? "tap to go through" : "walk here", 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface DoorVisual {
  door: Door;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  sprite: THREE.Sprite;
  active: boolean;
}

/**
 * The markers on the floor at each way out of a room. They work the same way
 * the station markers do, so leaving a room feels like using anything else.
 */
export class Doors {
  private visuals: DoorVisual[] = [];
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private clock = 0;
  nearest: Door | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.group);
  }

  rebuild(doors: Door[]): void {
    for (const v of this.visuals) {
      v.ring.geometry.dispose();
      v.ring.material.dispose();
      (v.sprite.material.map as THREE.Texture | null)?.dispose();
      v.sprite.material.dispose();
    }
    this.group.clear();
    this.visuals = [];
    this.nearest = null;

    for (const door of doors) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.44, 0.56, 40),
        new THREE.MeshBasicMaterial({
          color: 0x9fb8d8,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(door.position).setY(0.02);
      this.group.add(ring);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: labelTexture(door.label, false),
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.copy(door.position).setY(1.65);
      sprite.scale.set(1.5, 0.375, 1);
      sprite.renderOrder = 8;
      this.group.add(sprite);

      this.visuals.push({ door, ring, sprite, active: false });
    }
  }

  update(dt: number, player: THREE.Vector3): Door | null {
    this.clock += dt;
    let best: DoorVisual | null = null;
    let bestDistance = REACH;

    for (const v of this.visuals) {
      const d = v.door.position.distanceTo(new THREE.Vector3(player.x, 0, player.z));
      if (d < bestDistance) {
        bestDistance = d;
        best = v;
      }
    }

    for (const v of this.visuals) {
      const active = v === best;
      if (active !== v.active) {
        v.active = active;
        (v.sprite.material.map as THREE.Texture | null)?.dispose();
        v.sprite.material.map = labelTexture(v.door.label, active);
        v.sprite.material.needsUpdate = true;
        v.ring.material.color.setHex(active ? 0xe2c16e : 0x9fb8d8);
      }
      const pulse = active ? 0.5 + Math.sin(this.clock * 3.2) * 0.16 : 0.24;
      v.ring.material.opacity = pulse;
      v.sprite.scale.set(active ? 1.7 : 1.5, active ? 0.425 : 0.375, 1);
    }

    this.nearest = best?.door ?? null;
    return this.nearest;
  }
}
