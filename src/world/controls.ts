import * as THREE from "three";
import { resolveCollisions } from "./office.ts";

const EYE_HEIGHT = 1.62;
const SPEED = 3.1;
const SPRINT = 5.0;
const DAMPING = 11;
/** A pointer that moves less than this over a short time counts as a tap. */
const TAP_SLOP = 14;
const TAP_MS = 400;

export interface TapEvent {
  x: number;
  y: number;
}

/**
 * First-person walker driven by pointer events, so a mouse drag and a thumb
 * drag take the same path. Pointer lock is used when the browser grants it;
 * on a phone, and in an embedded frame, drag-to-look carries the whole game.
 */
export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private yaw = 0;
  private pitch = 0;
  private velocity = new THREE.Vector3();
  private keys = new Set<string>();
  private bob = 0;

  /** Look drag in progress, keyed by pointer id. */
  private lookPointer: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  private pressedAt = 0;
  private pressedPos = { x: 0, y: 0 };
  private moved = 0;

  /** Movement from an on-screen stick: x strafes, y walks forward. */
  moveInput = { x: 0, y: 0 };

  /** Furniture footprints the player cannot walk through. */
  colliders: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  /** Pushes the player back inside whichever room they are in. */
  clamp: (p: THREE.Vector3) => void = () => {};

  /** Set false while a UI panel is open. */
  enabled = true;
  /** True while a fixed-seat rig owns the camera; the walker goes quiet. */
  private orbitMode = false;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    camera.position.set(0, EYE_HEIGHT, 3.0);
    this.applyRotation();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    dom.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.release);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.release);
  }

  /** Requests pointer lock. Silently ignored where it is unavailable. */
  lock(): void {
    if (!this.enabled) return;
    if (matchMedia("(pointer: coarse)").matches) return;
    void this.dom.requestPointerLock?.();
  }

  unlock(): void {
  if (document.pointerLockElement === this.dom) document.exitPointerLock();
}

/**
 * Hands the camera to a fixed-seat rig, or takes it back. While seated the
 * walker ignores all pointer input, so OrbitControls gets every drag, and
 * the joystick is zeroed so the player cannot walk out of the chair.
 */
  setOrbitMode(on: boolean): void {
   this.orbitMode = on;
   this.enabled = !on;
   if (!on) return;
   this.keys.clear();
   this.moveInput = { x: 0, y: 0 };
   this.velocity.set(0, 0, 0);
   this.lookPointer = null;
   this.unlock();
}
  
  private release = (): void => {
    this.keys.clear();
    this.lookPointer = null;
    this.moveInput = { x: 0, y: 0 };
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

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.orbitMode || this.lookPointer !== null) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.lookPointer = e.pointerId;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.pressedPos = { x: e.clientX, y: e.clientY };
    this.pressedAt = performance.now();
    this.moved = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const dragging = this.lookPointer === e.pointerId;
    if (!this.locked && !dragging) return;

    // movementX/Y is only meaningful under pointer lock; outside it, track the
    // pointer ourselves so drag-to-look behaves the same everywhere.
    let dx: number;
    let dy: number;
    if (this.locked && !dragging) {
      dx = e.movementX;
      dy = e.movementY;
    } else {
      dx = e.clientX - this.lastPointer.x;
      dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.moved += Math.abs(dx) + Math.abs(dy);
    }

    const sensitivity = e.pointerType === "touch" ? 0.0034 : 0.0022;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    this.applyRotation();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.lookPointer !== e.pointerId) return;
    this.lookPointer = null;
    const quick = performance.now() - this.pressedAt < TAP_MS;
    const still =
      Math.abs(e.clientX - this.pressedPos.x) < TAP_SLOP &&
      Math.abs(e.clientY - this.pressedPos.y) < TAP_SLOP &&
      this.moved < TAP_SLOP * 2;
    if (this.enabled && quick && still) this.onTap({ x: e.clientX, y: e.clientY });
  };

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  /** Turns the camera to face a point. */
  /** Drops the player at a spot, killing any momentum they had. */
  teleport(position: THREE.Vector3): void {
    this.camera.position.set(position.x, EYE_HEIGHT, position.z);
    this.velocity.set(0, 0, 0);
  }

  lookAt(target: THREE.Vector3): void {
    const dir = target.clone().sub(this.camera.position);
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.applyRotation();
  }

  update(dt: number): void {
    const keyForward = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const keyStrafe = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));

    const forward = keyForward + this.moveInput.y;
    const strafe = keyStrafe + this.moveInput.x;

    if (this.enabled && (forward || strafe)) {
      const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      const speed = sprinting ? SPRINT : SPEED;
      const dir = new THREE.Vector3(strafe, 0, -forward);
      if (dir.lengthSq() > 1) dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.velocity.addScaledVector(dir, speed * DAMPING * dt);
    }

    this.velocity.multiplyScalar(Math.max(0, 1 - DAMPING * dt));
    this.camera.position.addScaledVector(this.velocity, dt);
    this.clamp(this.camera.position);
    resolveCollisions(this.camera.position, this.colliders);

    // A little head bob so walking has weight.
    const speed = this.velocity.length();
    this.bob += dt * speed * 2.4;
    this.camera.position.y = EYE_HEIGHT + Math.sin(this.bob * 2) * Math.min(0.035, speed * 0.012);
  }
}
