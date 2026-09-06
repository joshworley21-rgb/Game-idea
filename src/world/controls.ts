import * as THREE from "three";
import { clampToRoom } from "./office.ts";

const EYE_HEIGHT = 1.62;
const SPEED = 3.1;
const SPRINT = 5.0;
const DAMPING = 11;

/**
 * First-person walker. Uses pointer lock where the browser allows it and
 * falls back to drag-to-look so the game still works if lock is refused.
 */
export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private yaw = 0;
  private pitch = 0;
  private velocity = new THREE.Vector3();
  private keys = new Set<string>();
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private bob = 0;
  /** Set false while a UI panel is open. */
  enabled = true;
  locked = false;
  onLockChange: (locked: boolean) => void = () => {};

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    camera.position.set(0, EYE_HEIGHT, 2.3);
    this.applyRotation();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    dom.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.releaseKeys);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.dom.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("blur", this.releaseKeys);
  }

  lock(): void {
    if (!this.enabled) return;
    this.dom.requestPointerLock?.();
  }

  unlock(): void {
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }

  private releaseKeys = (): void => {
    this.keys.clear();
    this.dragging = false;
  };

  private onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.dom;
    this.onLockChange(this.locked);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled || e.button !== 0) return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = (): void => {
    this.dragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;
    if (!this.locked && !this.dragging) return;
    // movementX/Y is only trustworthy under pointer lock; outside it, track
    // the pointer ourselves so drag-to-look behaves the same everywhere.
    let dx: number;
    let dy: number;
    if (this.locked) {
      dx = e.movementX;
      dy = e.movementY;
    } else {
      dx = e.clientX - this.lastPointer.x;
      dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    }
    const sensitivity = 0.0022;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    this.applyRotation();
  };

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  /** Turns the camera to face a point over the next few frames. */
  lookAt(target: THREE.Vector3): void {
    const dir = target.clone().sub(this.camera.position);
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.applyRotation();
  }

  update(dt: number): void {
    const forward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const strafe = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));

    if (this.enabled && (forward || strafe)) {
      const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? SPRINT : SPEED;
      const dir = new THREE.Vector3(strafe, 0, -forward).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.velocity.addScaledVector(dir, speed * DAMPING * dt);
    }

    this.velocity.multiplyScalar(Math.max(0, 1 - DAMPING * dt));
    this.camera.position.addScaledVector(this.velocity, dt);
    clampToRoom(this.camera.position);

    // A little head bob so walking has weight.
    const speed = this.velocity.length();
    this.bob += dt * speed * 2.4;
    this.camera.position.y = EYE_HEIGHT + Math.sin(this.bob * 2) * Math.min(0.035, speed * 0.012);
  }
}
