import * as THREE from "three";

const EYE_HEIGHT = 1.62;
/** A pointer that moves less than this over a short time counts as a tap. */
const TAP_SLOP = 14;
const TAP_MS = 400;

export interface TapEvent {
  x: number;
  y: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The camera: fixed wherever it was last put, free to look around by drag
 * (mouse or thumb, the same code path either way), and moved only by a
 * discrete `teleport` (a cut) or `panTo` (an animated camera move to a new
 * vantage). There is no walking — the president chooses where to be, and the
 * camera goes there for them.
 */
export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private yaw = 0;
  private pitch = 0;

  /** Look drag in progress, keyed by pointer id. */
  private lookPointer: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  private pressedAt = 0;
  private pressedPos = { x: 0, y: 0 };
  private moved = 0;

  /** Set false while a UI panel is open, so dragging cannot spin the view. */
  enabled = true;
  /** Fired for a press that did not turn into a drag. */
  onTap: (event: TapEvent) => void = () => {};
  /** Fired once an animated panTo() reaches its target. */
  onPanComplete: () => void = () => {};

  // A pan tweens position and orientation together over panDuration seconds;
  // panT === 1 means idle. Yaw is unwrapped to the shortest angular path so a
  // pan never spins the long way around to face somewhere just left of you.
  private panFromPos = new THREE.Vector3();
  private panFromYaw = 0;
  private panFromPitch = 0;
  private panDeltaYaw = 0;
  private panTargetPos = new THREE.Vector3();
  private panTargetPitch = 0;
  private panT = 1;
  private panDuration = 1;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    camera.position.set(0, EYE_HEIGHT, 3.0);
    this.applyRotation();

    dom.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.release);
  }

  dispose(): void {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.release);
  }

  get panning(): boolean {
    return this.panT < 1;
  }

  private release = (): void => {
    this.lookPointer = null;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.panning || this.lookPointer !== null) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    this.lookPointer = e.pointerId;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.pressedPos = { x: e.clientX, y: e.clientY };
    this.pressedAt = performance.now();
    this.moved = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled || this.panning || this.lookPointer !== e.pointerId) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.moved += Math.abs(dx) + Math.abs(dy);

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
    if (this.enabled && !this.panning && quick && still) this.onTap({ x: e.clientX, y: e.clientY });
  };

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  /** Cuts straight to a spot — no camera move, just there. */
  teleport(groundPos: THREE.Vector3, eyeHeight = EYE_HEIGHT): void {
    this.panT = 1;
    this.camera.position.set(groundPos.x, eyeHeight, groundPos.z);
  }

  /** Turns the camera to face a point, from wherever it currently is. */
  lookAt(target: THREE.Vector3): void {
    const dir = target.clone().sub(this.camera.position);
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.applyRotation();
  }

  /**
   * Animates the camera to a new spot and orientation over `duration`
   * seconds — the "walk over and look at this" of a game with no walking.
   */
  panTo(groundPos: THREE.Vector3, lookTarget: THREE.Vector3, eyeHeight = EYE_HEIGHT, duration = 0.7): void {
    this.panFromPos.copy(this.camera.position);
    this.panFromYaw = this.yaw;
    this.panFromPitch = this.pitch;
    this.panTargetPos.set(groundPos.x, eyeHeight, groundPos.z);

    const dir = lookTarget.clone().sub(this.panTargetPos);
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    this.panTargetPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dYaw = targetYaw - this.panFromYaw;
    dYaw = ((dYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.panDeltaYaw = dYaw;

    this.panT = 0;
    this.panDuration = Math.max(0.05, duration);
  }

  update(dt: number): void {
    if (this.panT >= 1) return;
    this.panT = Math.min(1, this.panT + dt / this.panDuration);
    const e = easeInOutCubic(this.panT);
    this.camera.position.lerpVectors(this.panFromPos, this.panTargetPos, e);
    this.yaw = this.panFromYaw + this.panDeltaYaw * e;
    this.pitch = THREE.MathUtils.lerp(this.panFromPitch, this.panTargetPitch, e);
    this.applyRotation();
    if (this.panT >= 1) this.onPanComplete();
  }
}
