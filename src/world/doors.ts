import * as THREE from "three";
import { fitFont, withTextShadow } from "./labelText.ts";
import type { Door } from "./roomkit.ts";

/** Inset from the plate's edge that the text is not allowed to cross. */
const PAD = 34;

function labelTexture(label: string, active: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.roundRect(6, 22, 500, 84, 22);
  // The plate carries the text, so it has to hold up against a sunlit wall as
  // well as a dark corner. A half-transparent plate does not.
  ctx.fillStyle = active ? "rgba(14,20,32,0.95)" : "rgba(10,13,20,0.82)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? "rgba(226,193,110,0.95)" : "rgba(226,220,205,0.3)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = active ? "#f6e9c8" : "rgba(240,235,224,0.88)";
  fitFont(ctx, label, 500 - PAD * 2, "600", 30, "Georgia, 'Times New Roman', serif");
  withTextShadow(ctx, () => ctx.fillText(label, 256, 58));

  // Not "walk here": in the Oval the camera is on a seat rig and never walks,
  // which the class comment below says outright. The player looks at a door
  // and taps it, so that is what the sign says in both states.
  const hint = active ? "go through" : "tap to go through";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillStyle = active ? "rgba(226,193,110,0.95)" : "rgba(238,232,220,0.62)";
  withTextShadow(ctx, () => ctx.fillText(hint, 256, 88));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The plaque's size in metres, resting and while the crosshair is on it.
 *
 * These live here because `update` re-applies them every frame: setting a
 * size at rebuild time alone does nothing, it is overwritten on the next
 * tick. Narrow, because the Oval's west side has three openings inside eighty
 * degrees and the closest pair of plaques is under two metres apart.
 */
const PLAQUE = { w: 1.26, h: 0.315 };
const PLAQUE_ACTIVE = { w: 1.43, h: 0.357 };

interface DoorVisual {
  door: Door;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  sprite: THREE.Sprite;
  active: boolean;
}

/**
 * The markers on the floor at each way out of a room. They work the same way
 * the station markers do, so leaving a room feels like using anything else.
 *
 * Seated, the camera never walks, so proximity is meaningless: the player
 * looks at a door and taps it. `pick` does the raycast; `update` only drives
 * the pulse and the highlight.
 */
export class Doors {
  private visuals: DoorVisual[] = [];
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private clock = 0;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
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
      // Above the eye line, like the station labels, so a plaque across the
      // room reads as a sign on a wall rather than a slab across the view.
      sprite.position.copy(door.position).setY(1.95);
      sprite.scale.set(PLAQUE.w, PLAQUE.h, 1);
      sprite.renderOrder = 8;
      this.group.add(sprite);

      this.visuals.push({ door, ring, sprite, active: false });
    }
  }

  /**
   * Returns the door under a screen point, or null. The sprite is the target
   * rather than the ring on the floor: it is over a metre wide and stands just
   * above the eye line, which is a far easier thing to hit with a thumb than a
   * ring lying flat at the far side of the room.
   */
  pick(clientX: number, clientY: number, camera: THREE.Camera, dom: HTMLElement): Door | null {
    if (!this.visuals.length) return null;
    const rect = dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(
      this.visuals.map((v) => v.sprite),
      false,
    );
    if (!hits.length) return null;
    const hit = hits[0].object;
    const visual = this.visuals.find((v) => v.sprite === hit);
    return visual?.door ?? null;
  }

  /** Drives the pulse and the highlight. The camera position is not used. */
  update(dt: number, camera: THREE.Camera): void {
    this.clock += dt;
    this.raycaster.setFromCamera(this.ndc.set(0, 0), camera);
    const hits = this.raycaster.intersectObjects(
      this.visuals.map((v) => v.sprite),
      false,
    );
    const focused = hits.length ? hits[0].object : null;

    for (const v of this.visuals) {
      const active = v.sprite === focused;
      if (active !== v.active) {
        v.active = active;
        (v.sprite.material.map as THREE.Texture | null)?.dispose();
        v.sprite.material.map = labelTexture(v.door.label, active);
        v.sprite.material.needsUpdate = true;
        v.ring.material.color.setHex(active ? 0xe2c16e : 0x9fb8d8);
      }
      const pulse = active ? 0.5 + Math.sin(this.clock * 3.2) * 0.16 : 0.24;
      v.ring.material.opacity = pulse;
      const size = active ? PLAQUE_ACTIVE : PLAQUE;
      v.sprite.scale.set(size.w, size.h, 1);
    }

    this.nearest = focused
      ? (this.visuals.find((v) => v.sprite === focused)?.door ?? null)
      : null;
  }
}
