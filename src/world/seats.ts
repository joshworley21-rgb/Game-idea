import * as THREE from "three";
import type { Door, RoomBuild, StationAnchor } from "./roomkit.ts";

/** A fixed camera position, and what it looks at. */
export interface Seat {
  id: string;
  label: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** How long a move between two seats takes, in seconds. */
const GLIDE_SECONDS = 0.85;
/** Radians of head rotation per pixel of drag. */
const LOOK_SENSITIVITY = 0.0032;
/** How far the head can pitch before it feels wrong. */
const PITCH_LIMIT = Math.PI / 2 - 0.12;
/** FOV range for the seated zoom. */
const FOV_MIN = 35;
const FOV_MAX = 70;

/**
 * Builds the seat list for a procedural room: the spawn, then one seat per
 * station, then one per door. Every seat looks at the thing it is for.
 */
export function seatsForRoom(room: RoomBuild): Seat[] {
  const seats: Seat[] = [
    { id: "spawn", label: room.id, position: room.spawn.clone(), target: room.spawnLook.clone() },
  ];
  for (const anchor of room.anchors) seats.push(seatForStation(anchor));
  for (const door of room.doors) seats.push(seatForDoor(door));
  return seats;
}

function seatForStation(anchor: StationAnchor): Seat {
  return {
    id: anchor.id,
    label: anchor.id,
    position: anchor.position.clone().setY(1.42),
    target: anchor.focus.clone(),
  };
}

function seatForDoor(door: Door): Seat {
  return {
    id: `door:${door.to}`,
    label: door.label,
    position: door.position.clone().setY(1.66),
    target: door.position.clone().addScaledVector(door.facing, -2.4).setY(1.2),
  };
}

/**
 * Holds the camera at one seat and glides between them. The eye never
 * translates while seated: drags rotate the head in place, and pinch or wheel
 * changes field of view rather than distance.
 */
export class SeatRig {
  readonly seats: Seat[];
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private fromPosition = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toPosition = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private look = new THREE.Vector3();
  private elapsed = GLIDE_SECONDS;
  private current: Seat;

  private yaw = 0;
  private pitch = 0;
  private fov = 62;
  private pointers = new Map<number, { x: number; y: number }>();
  private lookPointer: number | null = null;
  private pinchDistance = 0;

  constructor(camera: THREE.PerspectiveCamera, seats: Seat[], dom: HTMLElement) {
    this.camera = camera;
    this.seats = seats;
    this.dom = dom;
    this.current = seats[0];
    this.snapTo(seats[0]);
    this.dom.addEventListener("pointerdown", this.onPointerDown);
    this.dom.addEventListener("pointermove", this.onPointerMove);
    this.dom.addEventListener("pointerup", this.onPointerUp);
    this.dom.addEventListener("pointercancel", this.onPointerUp);
    this.dom.addEventListener("wheel", this.onWheel, { passive: false });
  }

  get currentId(): string {
    return this.current.id;
  }

  get moving(): boolean {
    return this.elapsed < GLIDE_SECONDS;
  }

  /** Jumps straight to a seat, with no glide. */
  snapTo(seat: Seat): void {
    this.current = seat;
    this.camera.position.copy(seat.position);
    this.aimAt(seat.target);
    this.fromPosition.copy(seat.position);
    this.fromTarget.copy(seat.target);
    this.toPosition.copy(seat.position);
    this.toTarget.copy(seat.target);
    this.elapsed = GLIDE_SECONDS;
  }

  /** Eases to a seat by id. Unknown ids are ignored. */
  goTo(id: string): boolean {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || seat === this.current) return false;
    this.fromPosition.copy(this.camera.position);
    this.fromTarget.copy(this.current.target);
    this.current = seat;
    this.toPosition.copy(seat.position);
    this.toTarget.copy(seat.target);
    this.elapsed = 0;
    return true;
  }

  /** Advances the glide. Called once per frame from the render loop. */
  update(dt: number): void {
    if (this.elapsed >= GLIDE_SECONDS) return;
    this.elapsed = Math.min(GLIDE_SECONDS, this.elapsed + dt);
    const t = this.elapsed / GLIDE_SECONDS;
    const k = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, k);
    this.look.lerpVectors(this.fromTarget, this.toTarget, k);
    this.aimAt(this.look);
  }

  private aimAt(target: THREE.Vector3): void {
    const dx = target.x - this.camera.position.x;
    const dy = target.y - this.camera.position.y;
    const dz = target.z - this.camera.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.applyRotation();
  }

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  setFov(fov: number): void {
    this.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, fov));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    this.dom.removeEventListener("pointermove", this.onPointerMove);
    this.dom.removeEventListener("pointerup", this.onPointerUp);
    this.dom.removeEventListener("pointercancel", this.onPointerUp);
    this.dom.removeEventListener("wheel", this.onWheel);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.lookPointer = e.pointerId;
      return;
    }
    this.lookPointer = null;
    this.pinchDistance = this.pinchSpan();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) return;
    const dx = e.clientX - tracked.x;
    const dy = e.clientY - tracked.y;
    tracked.x = e.clientX;
    tracked.y = e.clientY;

    if (this.pointers.size >= 2) {
      const span = this.pinchSpan();
      if (this.pinchDistance > 0) this.setFov(this.fov - (span - this.pinchDistance) * 0.12);
      this.pinchDistance = span;
      return;
    }

    if (e.pointerId !== this.lookPointer) return;
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch -= dy * LOOK_SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this.applyRotation();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.lookPointer) this.lookPointer = null;
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.pointers.size === 1 && this.lookPointer === null) {
      this.lookPointer = this.pointers.keys().next().value ?? null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.setFov(this.fov + Math.sign(e.deltaY) * 2.5);
  };

  private pinchSpan(): number {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
