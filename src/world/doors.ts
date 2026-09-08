import * as THREE from "three";
import type { Door } from "./roomkit.ts";

function labelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.roundRect(6, 22, 500, 84, 22);
  ctx.fillStyle = "rgba(18,26,40,0.88)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(159,184,216,0.85)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f6e9c8";
  ctx.font = "600 30px Georgia, 'Times New Roman', serif";
  ctx.fillText(label, 256, 58);
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillStyle = "rgba(159,184,216,0.9)";
  ctx.fillText("tap to go through", 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface DoorVisual {
  door: Door;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  sprite: THREE.Sprite;
  /** Invisible volume so a tap or click can use the door directly. */
  hit: THREE.Mesh;
}

/**
 * The markers at each way out of a room — always tappable, wherever the
 * camera happens to be looking, the same as a station.
 */
export class Doors {
  private visuals: DoorVisual[] = [];
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private clock = 0;

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
      v.hit.geometry.dispose();
    }
    this.group.clear();
    this.visuals = [];

    doors.forEach((door, index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.44, 0.56, 40),
        new THREE.MeshBasicMaterial({
          color: 0x9fb8d8,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(door.position).setY(0.02);
      this.group.add(ring);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture(door.label), transparent: true, depthTest: false }),
      );
      sprite.position.copy(door.position).setY(1.65);
      sprite.scale.set(1.5, 0.375, 1);
      sprite.renderOrder = 8;
      this.group.add(sprite);

      // Fully transparent rather than `visible: false`, which the raycaster skips.
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 2.4, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.copy(door.position).setY(1.2);
      hit.userData.doorIndex = index;
      this.group.add(hit);

      this.visuals.push({ door, ring, sprite, hit });
    });
  }

  /** Idle pulse on the floor rings, so the room does not feel static. */
  update(dt: number): void {
    this.clock += dt;
    for (const v of this.visuals) {
      v.ring.material.opacity = 0.32 + (0.5 + 0.5 * Math.sin(this.clock * 2.4 + v.door.position.x)) * 0.16;
    }
  }

  /** The door under a screen point, if any. */
  pick(raycaster: THREE.Raycaster): Door | null {
    const hits = raycaster.intersectObjects(this.visuals.map((v) => v.hit), false);
    const index = hits[0]?.object.userData.doorIndex;
    return typeof index === "number" ? this.visuals[index].door : null;
  }
}
