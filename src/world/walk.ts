import * as THREE from "three";
import type { Character } from "./character.ts";

/**
 * Walking.
 *
 * The rig in `character.ts` already has every joint a walk needs — hips, two
 * legs with knees, two arms with elbows. Nothing was driving them, so the cast
 * stood where the room definition put them and never arrived anywhere.
 *
 * This is a procedural walk cycle rather than a baked clip, for the same
 * reason the characters are built in code: there is no source of good human
 * animation here, and a cycle driven from a phase is a few dozen lines that
 * work for every body the seed produces. It is not mocap. It is a person
 * crossing a room, which is all it has to be.
 *
 * Movement is a straight line from a door to a slot. The rooms are convex
 * rectangles with a `clamp`, so a straight line between two points inside one
 * is always inside it — no pathfinding, no navmesh, no steering.
 */

/** How fast a person walks, in metres per second. */
const WALK_SPEED = 1.15;

/** Strides per second at walking pace. */
const CADENCE = 1.75;

/** How far the hips drop and rise over a stride, in metres. */
const BOB = 0.022;

/** How far the hips swing side to side over a stride, in metres. */
const SWAY = 0.016;

/**
 * A walk cycle for one character. Holds the phase and applies the joint
 * rotations each frame. The character's own `applyPose` sets the resting
 * stance; this overwrites the joints it owns and leaves the rest alone.
 */
export class WalkCycle {
  private phase: number;
  /** The hip height this person stands at, so the bob is relative to it. */
  private readonly standY: number;

  constructor(character: Character, phase = 0) {
    this.phase = phase;
    this.standY = character.hips.position.y;
  }

  /**
   * Advances the cycle and poses the legs and arms. `speed` is in metres per
   * second, so a person walking faster takes quicker steps rather than
   * sliding along the floor.
   */
  update(character: Character, dt: number, speed = WALK_SPEED): void {
    this.phase += dt * CADENCE * (speed / WALK_SPEED) * Math.PI * 2;
    this.apply(character);
  }

  /** Poses the character at the current phase without advancing it. */
  apply(character: Character): void {
    const { legs, arms, hips, chest, neck } = character;
    const p = this.phase;

    // --- Legs. A sine per leg, half a cycle apart, so one is always planted.
    const swingL = Math.sin(p);
    const swingR = Math.sin(p + Math.PI);

    legs.left.rotation.x = swingL * 0.52;
    legs.right.rotation.x = swingR * 0.52;
    // A little outward set, so the feet do not cross.
    legs.left.rotation.z = 0.045;
    legs.right.rotation.z = -0.045;

    // The knee folds when the leg is behind and lifting, never when it is
    // reaching forward to plant: a knee that bends on the forward swing reads
    // as a puppet.
    legs.leftShin.rotation.x = Math.max(0, -swingL) * 1.05 + 0.06;
    legs.rightShin.rotation.x = Math.max(0, -swingR) * 1.05 + 0.06;

    // --- Arms counter-swing against the legs, which is what makes a walk
    // read as a walk rather than a march.
    arms.left.rotation.x = -swingL * 0.42;
    arms.right.rotation.x = -swingR * 0.42;
    arms.left.rotation.z = 0.14;
    arms.right.rotation.z = -0.14;
    // Elbows stay slightly bent and flex a little with the swing.
    arms.leftFore.rotation.x = -0.28 - Math.max(0, swingL) * 0.22;
    arms.rightFore.rotation.x = -0.28 - Math.max(0, swingR) * 0.22;

    // --- The body. Two bobs per stride, one sway per stride, and a small
    // counter-rotation in the shoulders.
    const bob = Math.abs(Math.sin(p)) * BOB;
    hips.position.y = this.standY + bob - BOB * 0.5;
    hips.position.x = Math.sin(p) * SWAY;
    hips.rotation.y = Math.sin(p) * 0.09;
    chest.rotation.y = -Math.sin(p) * 0.13;
    // A slight forward lean, because nobody walks bolt upright.
    chest.rotation.x = 0.045;
    neck.rotation.x = -0.03;
  }
}

/**
 * One person walking from where they came in to where they are going.
 *
 * The walk is a straight line, eased at both ends so nobody starts or stops
 * at full speed. When it finishes, the character is handed back to the idle
 * animator in the pose their slot asked for.
 */
export class WalkIn {
  readonly character: Character;
  private readonly cycle: WalkCycle;
  private readonly from: THREE.Vector3;
  private readonly to: THREE.Vector3;
  private readonly duration: number;
  private readonly endPose: "stand" | "sit" | "sit-forward" | "lean";
  private readonly endRotationY: number;
  private readonly startRotationY: number;
  private elapsed = 0;
  private done = false;
  /** Set once the walk has finished, so the caller can hand off to idle. */
  onArrive: ((c: Character) => void) | null = null;

  constructor(
    character: Character,
    from: THREE.Vector3,
    to: THREE.Vector3,
    endRotationY: number,
    endPose: "stand" | "sit" | "sit-forward" | "lean",
    phase = 0,
  ) {
    this.character = character;
    this.cycle = new WalkCycle(character, phase);
    this.from = from.clone();
    this.to = to.clone();
    this.endRotationY = endRotationY;
    this.endPose = endPose;
    const distance = this.from.distanceTo(this.to);
    // Never instant, never a crawl: a short crossing still takes a moment.
    this.duration = Math.max(0.45, distance / WALK_SPEED);
    this.startRotationY = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);

    character.group.position.copy(this.from);
    character.group.rotation.y = this.startRotationY;
  }

  get finished(): boolean {
    return this.done;
  }

  /** Advances the walk. Returns true on the frame it arrives. */
  update(dt: number): boolean {
    if (this.done) return false;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    const t = this.elapsed / this.duration;

    // Ease in and out, so the first and last steps are shorter.
    const k = t * t * (3 - 2 * t);
    this.character.group.position.lerpVectors(this.from, this.to, k);

    // Turn to face the destination over the last quarter of the walk rather
    // than snapping at the end, so someone walking to a chair arrives already
    // facing it.
    const turn = t < 0.75 ? 0 : (t - 0.75) / 0.25;
    const eased = turn * turn * (3 - 2 * turn);
    this.character.group.rotation.y =
      this.startRotationY + shortestAngle(this.startRotationY, this.endRotationY) * eased;

    // The cycle slows as the walk eases out, so the feet do not skate.
    const speed = WALK_SPEED * (0.55 + 0.45 * (1 - Math.abs(t - 0.5) * 2));
    this.cycle.update(this.character, dt, speed);

    if (this.elapsed >= this.duration) {
      this.done = true;
      this.character.group.position.copy(this.to);
      this.character.group.rotation.y = this.endRotationY;
      this.onArrive?.(this.character);
      return true;
    }
    return false;
  }
}

/** The signed shortest way from one angle to another, in radians. */
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Runs the walks for a room. Owned by the world, ticked once a frame, and
 * emptied whenever the cast is rebuilt.
 */
export class WalkDirector {
  private walks: WalkIn[] = [];
  /** Called when someone arrives, so the idle animator can take them over. */
  onArrive: ((c: Character) => void) | null = null;

  add(walk: WalkIn): void {
    walk.onArrive = (c) => this.onArrive?.(c);
    this.walks.push(walk);
  }

  clear(): void {
    this.walks.length = 0;
  }

  get busy(): boolean {
    return this.walks.length > 0;
  }

  update(dt: number): void {
    if (!this.walks.length) return;
    // Iterate backwards so a finished walk can be removed in place.
    for (let i = this.walks.length - 1; i >= 0; i--) {
      if (this.walks[i].update(dt)) this.walks.splice(i, 1);
    }
  }
}
