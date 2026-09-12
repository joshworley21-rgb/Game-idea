import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Fixed-camera rig for the loaded Oval Office.
 *
 * The president does not walk. They sit at the Resolute Desk, and the view
 * moves between a handful of authored seats: the desk, the seating group, the
 * secure line, and the door. Each seat is a position plus a look-at target,
 * and moving between them is a short eased glide rather than a teleport, so
 * the room reads as one continuous space.
 *
 * Seats are discovered from the model's own named nodes where possible (the
 * desk, the chair behind it, the sofas) and fall back to offsets from the
 * room's bounding box where the GLB does not name anything useful.
 */

export interface Seat {
  id: string;
  label: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const BOX_SIZE = new THREE.Vector3();

/** How long a move between two seats takes, in seconds. */
const GLIDE_SECONDS = 0.85;

/** Seated eye height above the room floor. */
const SEATED_EYE = 1.42;

/** Standing eye height, for the door seat. */
const STANDING_EYE = 1.66;

/** Field of view bounds for pinch/wheel zooming while seated. */
const MIN_FOV = 35;
const MAX_FOV = 75;

/** Limits on how far up and down the player can crane their neck. */
const MIN_PITCH = -Math.PI * 0.38;
const MAX_PITCH = Math.PI * 0.38;

/**
 * The GLB contains the whole White House and its grounds, so the model's own
 * bounding box floor is the lawn, several metres below the Oval Office carpet.
 * The interior floor is found instead from the desk: the desk sits on the
 * carpet, so its base is the floor, give or take its own thickness.
 */
const DESK_BASE_LIFT = 0.02;

interface NamedBox {
  node: THREE.Object3D;
  box: THREE.Box3;
  name: string;
}

function collectNamedBoxes(root: THREE.Object3D): NamedBox[] {
  const boxes: NamedBox[] = [];
  root.traverse((obj) => {
    const name = obj.name.trim();
    if (!name) return;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(BOX_SIZE);
    if (box.isEmpty() || size.x <= 0 || size.y <= 0 || size.z <= 0) return;
    boxes.push({ node: obj, box, name });
  });
  return boxes;
}

function bestMatch(
  candidates: NamedBox[],
  pattern: RegExp,
  reject: RegExp | null,
  minVolume: number,
  maxVolume: number,
): NamedBox | null {
  let best: NamedBox | null = null;
  let bestVolume = Infinity;
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    if (!pattern.test(name)) continue;
    if (reject && reject.test(name)) continue;
    const size = candidate.box.getSize(BOX_SIZE);
    const volume = size.x * size.y * size.z;
    if (volume < minVolume || volume > maxVolume) continue;
    // The tightest node that matches is the actual object, not a group
    // containing it and half the room.
    if (volume < bestVolume) {
      best = candidate;
      bestVolume = volume;
    }
  }
  return best;
}

/**
 * Finds the interior floor height. The desk is the anchor: it stands on the
 * carpet, so its base is the floor. Falls back to the tallest furniture we can
 * find, then to the model floor only as a last resort.
 */
function findFloorY(
  modelBox: THREE.Box3,
  desk: NamedBox | null,
  chair: NamedBox | null,
  sofa: NamedBox | null,
): number {
  const anchors = [desk, chair, sofa].filter((b): b is NamedBox => b !== null);
  if (anchors.length) {
    // The highest base among the furniture is the one standing on the carpet;
    // anything lower is a rug, a step, or part of the exterior.
    let floor = Number.NEGATIVE_INFINITY;
    for (const anchor of anchors) floor = Math.max(floor, anchor.box.min.y);
    return floor + DESK_BASE_LIFT;
  }
  return modelBox.min.y;
}

/** Logs every node whose name suggests furniture we might want to sit at. */
export function logSeatCandidates(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (/desk|resolute|chair|table|sofa|couch|seat/i.test(child.name)) {
      console.log(
        "Found desk/chair candidate:",
        child.name,
        "local:",
        child.position.toArray(),
        "world:",
        child.getWorldPosition(new THREE.Vector3()).toArray(),
      );
    }
  });
}

/**
 * Builds the seat list for the loaded model. The desk seat is the important
 * one: it is where the game opens, and it is derived from the desk and the
 * chair behind it rather than from a hard-coded coordinate.
 */
export function buildSeats(model: THREE.Object3D): Seat[] {
  const candidates = collectNamedBoxes(model);
  const modelBox = new THREE.Box3().setFromObject(model);

  const desk = bestMatch(candidates, /desk|resolute/, null, 0.2, 40);
  const chair = bestMatch(candidates, /chair|seat|stool/, /armchair|sofa/, 0.05, 8);
  const sofa = bestMatch(candidates, /sofa|couch|settee/, null, 0.3, 30);

  const floorY = findFloorY(modelBox, desk, chair, sofa);

  const roomCenter = modelBox.getCenter(new THREE.Vector3());
  const roomSize = modelBox.getSize(BOX_SIZE);
  const span = Math.max(roomSize.x, roomSize.z);

  const deskCenter = new THREE.Vector3();
  if (desk) desk.box.getCenter(deskCenter);
  else deskCenter.copy(roomCenter).setY(floorY);

  // The desk faces away from its chair. Without a chair, it faces the room.
  const forward = new THREE.Vector3();
  if (chair) {
    const chairCenter = chair.box.getCenter(new THREE.Vector3());
    forward.set(deskCenter.x - chairCenter.x, 0, deskCenter.z - chairCenter.z);
  }
  if (forward.lengthSq() < 0.01) {
    forward.set(roomCenter.x - deskCenter.x, 0, roomCenter.z - deskCenter.z);
  }
  if (forward.lengthSq() < 0.01) forward.set(0, 0, 1);
  forward.normalize();

  const seats: Seat[] = [];

  // --- The desk. Seated behind it, looking out across the room. -----------
  const deskSeat = new THREE.Vector3();
  if (chair) {
    chair.box.getCenter(deskSeat);
  } else {
    deskSeat.copy(deskCenter).addScaledVector(forward, -0.72);
  }
  deskSeat.y = floorY + SEATED_EYE;

  const deskLook = new THREE.Vector3()
    .copy(deskCenter)
    .addScaledVector(forward, THREE.MathUtils.clamp(span * 0.34, 2.4, 4.6));
  deskLook.y = floorY + 1.05;

  seats.push({ id: "desk", label: "The Resolute Desk", position: deskSeat, target: deskLook });

  // --- The seating group, from the far side of the coffee table. ----------
  const sofaSeat = new THREE.Vector3();
  if (sofa) {
    const sofaCenter = sofa.box.getCenter(new THREE.Vector3());
    sofaSeat.copy(sofaCenter).addScaledVector(forward, -0.55);
  } else {
    sofaSeat.copy(deskCenter).addScaledVector(forward, 2.6);
  }
  sofaSeat.y = floorY + SEATED_EYE;
  const sofaLook = new THREE.Vector3(deskCenter.x, floorY + 1.05, deskCenter.z);
  seats.push({ id: "seating", label: "The seating group", position: sofaSeat, target: sofaLook });

  // --- The secure line, standing at the credenza on the east side. --------
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  const phoneSeat = new THREE.Vector3()
    .copy(deskCenter)
    .addScaledVector(side, THREE.MathUtils.clamp(span * 0.3, 2.2, 4.2))
    .addScaledVector(forward, 0.4);
  phoneSeat.y = floorY + STANDING_EYE;
  const phoneLook = new THREE.Vector3()
    .copy(phoneSeat)
    .addScaledVector(side, 1.4);
  phoneLook.y = floorY + 1.15;
  seats.push({ id: "phone", label: "The Secure Line", position: phoneSeat, target: phoneLook });

  // --- The door, standing, looking back into the room. --------------------
  const doorSeat = new THREE.Vector3()
    .copy(deskCenter)
    .addScaledVector(forward, -THREE.MathUtils.clamp(span * 0.3, 2.2, 4.2));
  doorSeat.y = floorY + STANDING_EYE;
  const doorLook = new THREE.Vector3(deskCenter.x, floorY + 1.2, deskCenter.z);
  seats.push({ id: "door", label: "The door", position: doorSeat, target: doorLook });

  console.log("Oval Office seats", {
    desk: desk?.name ?? null,
    chair: chair?.name ?? null,
    sofa: sofa?.name ?? null,
    modelFloorY: modelBox.min.y,
    floorY,
    seats: seats.map((s) => ({
      id: s.id,
      position: s.position.toArray().map((n) => Number(n.toFixed(2))),
      target: s.target.toArray().map((n) => Number(n.toFixed(2))),
    })),
  });

  return seats;
}

/**
 * Keeps the camera in the seat and pivots in place.
 * Translates purely between authored seats; drags rotate the head,
 * and pinch changes field of view rather than dolly distance.
 * OrbitControls is kept idle as a dummy so scene.ts doesn't break.
 */
export class SeatRig {
  readonly seats: Seat[];
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private dom: HTMLElement;
  private fromPosition = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toPosition = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private look = new THREE.Vector3();
  private elapsed = GLIDE_SECONDS;
  private current: Seat;

  // Head rotation in radians. Yaw is horizontal, pitch is vertical.
  private yaw = 0;
  private pitch = 0;

  // Touch tracking for look and pinch-zoom
  private pointers = new Map<number, { x: number; y: number }>();
  private lookPointer: number | null = null;
  private pinchDistance = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    seats: Seat[],
    dom: HTMLElement,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.seats = seats;
    this.dom = dom;
    this.current = seats[0];

    // Disable orbit so it doesn't fight the head-turn
    this.controls.enabled = false;

    this.snapTo(seats[0]);
    this.dom.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
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
    this.fromPosition.copy(seat.position);
    this.fromTarget.copy(seat.target);
    this.toPosition.copy(seat.position);
    this.toTarget.copy(seat.target);
    this.elapsed = GLIDE_SECONDS;
    this.aimAt(seat.target);
  }

  /** Eases to a seat by id. Unknown ids are ignored. */
  goTo(id: string): boolean {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || seat === this.current) return false;
    this.current = seat;
    this.fromPosition.copy(this.camera.position);
    this.fromTarget.copy(this.current.target);
    this.toPosition.copy(seat.position);
    this.toTarget.copy(seat.target);
    this.elapsed = 0;
    return true;
  }

  /** Advances the glide. Called once per frame. */
  update(dt: number): void {
    if (this.elapsed >= GLIDE_SECONDS) return;
    this.elapsed = Math.min(GLIDE_SECONDS, this.elapsed + dt);
    const t = this.elapsed / GLIDE_SECONDS;
    const k = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, k);
    this.look.lerpVectors(this.fromTarget, this.toTarget, k);
    this.aimAt(this.look);
  }

  /** Points the head at a world-position target. */
  private aimAt(target: THREE.Vector3): void {
    const dx = target.x - this.camera.position.x;
    const dy = target.y - this.camera.position.y;
    const dz = target.z - this.camera.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = THREE.MathUtils.clamp(
      Math.atan2(dy, Math.hypot(dx, dz)),
      MIN_PITCH,
      MAX_PITCH,
    );
    this.applyRotation();
  }

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  dispose(): void {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.dom.removeEventListener("wheel", this.onWheel);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.lookPointer = e.pointerId;
      return;
    }
    if (this.pointers.size === 2) {
      this.lookPointer = null;
      this.pinchDistance = this.getDistance();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) return;
    const dx = e.clientX - tracked.x;
    const dy = e.clientY - tracked.y;
    tracked.x = e.clientX;
    tracked.y = e.clientY;

    if (this.pointers.size >= 2) {
      const dist = this.getDistance();
      if (this.pinchDistance > 0) {
        const delta = dist - this.pinchDistance;
        this.camera.fov = THREE.MathUtils.clamp(
          this.camera.fov - delta * 0.1,
          MIN_FOV,
          MAX_FOV,
        );
        this.camera.updateProjectionMatrix();
      }
      this.pinchDistance = dist;
      return;
    }

    if (e.pointerId === this.lookPointer) {
      const sens = e.pointerType === "touch" ? 0.0032 : 0.0022;
      this.yaw -= dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - dy * sens,
        MIN_PITCH,
        MAX_PITCH,
      );
      this.applyRotation();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
      // If one finger remains, promote it to lookPointer
      if (this.pointers.size === 1) {
        this.lookPointer = this.pointers.keys().next().value ?? null;
      }
    }
    if (this.pointers.size < 2) {
      this.pinchDistance = 0;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.camera.fov = THREE.MathUtils.clamp(
      this.camera.fov + e.deltaY * 0.04,
      MIN_FOV,
      MAX_FOV,
    );
    this.camera.updateProjectionMatrix();
  };

  private getDistance(): number {
    if (this.pointers.size < 2) return 0;
    const [a, b] = Array.from(this.pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

