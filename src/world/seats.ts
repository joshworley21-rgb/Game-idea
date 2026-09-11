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
const SEATED_EYE = 1.18;

/** Standing eye height, for the door seat. */
const STANDING_EYE = 1.62;

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
  const floorY = modelBox.min.y;

  const desk = bestMatch(candidates, /desk|resolute/, null, 0.2, 40);
  const chair = bestMatch(candidates, /chair|seat|stool/, /armchair|sofa/, 0.05, 8);
  const sofa = bestMatch(candidates, /sofa|couch|settee/, null, 0.3, 30);

  const roomCenter = modelBox.getCenter(new THREE.Vector3());
  const roomSize = modelBox.getSize(BOX_SIZE);
  const span = Math.max(roomSize.x, roomSize.z);

  const deskCenter = new THREE.Vector3();
  if (desk) desk.box.getCenter(deskCenter);
  else roomCenter.clone().setY(floorY);

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
    sofaSeat.y = floorY + SEATED_EYE;
  } else {
    sofaSeat.copy(deskCenter).addScaledVector(forward, 2.6);
    sofaSeat.y = floorY + SEATED_EYE;
  }
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
 * Holds the camera at one seat and glides between them. There is no walking:
 * the only way the view changes is `goTo`, which eases position and target
 * together over a fixed duration.
 */
export class SeatRig {
  readonly seats: Seat[];
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private fromPosition = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toPosition = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private elapsed = GLIDE_SECONDS;
  private current: Seat;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls, seats: Seat[]) {
    this.camera = camera;
    this.controls = controls;
    this.seats = seats;
    this.current = seats[0];
    this.snapTo(seats[0]);
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
    this.controls.target.copy(seat.target);
    this.controls.update();
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
    this.current = seat;
    this.fromPosition.copy(this.camera.position);
    this.fromTarget.copy(this.controls.target);
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
    // Smoothstep, so the move settles rather than stopping dead.
    const k = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, k);
    this.controls.target.lerpVectors(this.fromTarget, this.toTarget, k);
    this.controls.update();
  }
}
