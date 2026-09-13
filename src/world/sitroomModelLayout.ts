import * as THREE from "three";
import type { StationId } from "../game/types.ts";
import type { CastSlot, Door, StationAnchor } from "./roomkit.ts";

/**
 * Where the signs, seats and people go in the loaded Situation Room model.
 *
 * The model is the White House Situation Room — the JFK Conference Room — and
 * it is a plain rectangle, so unlike the Oval there are no bearings to survey.
 * Everything below was measured by raycasting the converted model, and is
 * written as an offset from the bounds it was measured against, so the layout
 * still lands if the room is ever re-exported at a different size.
 *
 * The room, with the floor at y = 0:
 *
 *     x  -3.67 .. 3.67    7.34m wide
 *     y   0.00 .. 2.60    a 2.6m ceiling, the lowest in the game
 *     z  -4.85 .. 5.13    9.98m long
 *
 * The long axis is z. The presidential seal is on the wall at z = -4.73 and
 * the president's chair sits under it, so the head of the table is the -z end
 * and the room faces +z, where the main display hangs on the far wall. The
 * table top is at y = 0.78 and runs from z = -2.8 to z = 3.2; its centre line
 * is x = -0.13, not 0, because the model is not quite symmetrical. Chairs sit
 * at x = +1.0 and x = -1.35.
 *
 * The two walls are not interchangeable. The +x wall carries the two big
 * displays and a pair of status boards; the -x wall carries three sets of
 * panelled double doors with a display between each. So the way out is on -x
 * and the thing worth looking at is on +x, which is why the Watch Floor sits
 * on the -x side of the table facing across it.
 */

/** The table's centre line, as an offset from the middle of the room. */
const TABLE_X = -0.13;
/** The two rows of chairs at the table, as offsets from the table's centre. */
const CHAIR_X = [1.13, -1.22];
/** How far down the room the head of the table is, from the seal wall. */
const HEAD_INSET = 1.65;
/**
 * Which of the -x wall's three doorways is the way out, as a distance from
 * the far wall. The one at the seal end would put the plaque a foot from the
 * president's chair, so it is the far one that is marked.
 */
const DOOR_INSET = 2.1;
/** How far off a wall a marker or seat stands. */
const STAND_BACK = 0.95;
/** Seat height of the model's chairs, for the cast. */
const SEAT_Y = 0.0;

export interface SitroomMeasure {
  centre: THREE.Vector3;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  /** The table's centre line in x. */
  tableX: number;
}

/** Measures the room from the model's own bounds. Null if it is empty. */
export function measureSitroom(model: THREE.Object3D): SitroomMeasure | null {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return null;
  const centre = box.getCenter(new THREE.Vector3());
  centre.y = box.min.y;
  return {
    centre,
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
    floorY: box.min.y,
    tableX: centre.x + TABLE_X,
  };
}

/**
 * The two stations.
 *
 * The Situation Table is the president's own chair at the head, with the seal
 * behind you and the main display the length of the room away. The Watch Floor
 * is a seat down the near side, turned to the displays on the opposite wall —
 * the seat of someone working one situation rather than chairing the meeting.
 *
 * They are put at opposite ends of the room on purpose. Both markers and the
 * door plaque started out within two metres of each other on the same wall,
 * and the three of them drew on top of one another.
 */
export function sitroomModelAnchors(model: THREE.Object3D): StationAnchor[] | null {
  const room = measureSitroom(model);
  if (!room) return null;

  const headZ = room.minZ + HEAD_INSET;
  const watchZ = room.centre.z - 0.5;

  return [
    {
      id: "brief" as StationId,
      position: new THREE.Vector3(room.tableX, room.floorY, headZ),
      camera: new THREE.Vector3(room.tableX, room.floorY, headZ),
      // Aimed below the far display, not at it: the ceiling here is 2.6m, and
      // a focus at screen height tips the frame up into the chandeliers.
      focus: new THREE.Vector3(room.tableX, room.floorY + 1.1, room.maxZ),
    },
    {
      id: "watch" as StationId,
      position: new THREE.Vector3(room.tableX + CHAIR_X[1] - 0.45, room.floorY, watchZ),
      camera: new THREE.Vector3(room.tableX + CHAIR_X[1] - 0.45, room.floorY, watchZ),
      focus: new THREE.Vector3(room.maxX - 0.3, room.floorY + 1.5, watchZ - 0.4),
    },
  ];
}

/** The one way out: the panelled doors in the -x wall, back up to the Cabinet Room. */
export function sitroomModelDoors(model: THREE.Object3D): Door[] | null {
  const room = measureSitroom(model);
  if (!room) return null;

  const doorZ = room.maxZ - DOOR_INSET;
  return [
    {
      to: "cabinet",
      label: "Up to the Cabinet Room",
      position: new THREE.Vector3(room.minX + STAND_BACK + 0.6, room.floorY, doorZ),
      facing: new THREE.Vector3(room.minX, room.floorY + 1.5, doorZ),
    },
  ];
}

/**
 * Where the player arrives: inside the doors, looking the length of the room
 * at the seal and the president's chair under it.
 */
export function sitroomModelSpawn(
  model: THREE.Object3D,
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const room = measureSitroom(model);
  if (!room) return null;
  return {
    position: new THREE.Vector3(room.minX + 1.6, room.floorY + 1.55, room.maxZ - 2.1),
    target: new THREE.Vector3(room.tableX, room.floorY + 1.15, room.minZ + 1.0),
  };
}

/**
 * Your cabinet, in the model's own chairs.
 *
 * The procedural room seated six people round a 3.4m table; this one is 6m
 * long with fourteen chairs at it, so the stand-in's seats put half the
 * cabinet inside the model's furniture and the other half in the aisle.
 * Three a side, down the half of the table the president can see.
 */
export function sitroomModelCast(model: THREE.Object3D): CastSlot[] | null {
  const room = measureSitroom(model);
  if (!room) return null;

  const cast: CastSlot[] = [];
  const rows = [
    { x: room.tableX + CHAIR_X[0], facing: -Math.PI / 2 },
    { x: room.tableX + CHAIR_X[1], facing: Math.PI / 2 },
  ];
  const zs = [room.minZ + 3.1, room.minZ + 4.9, room.minZ + 6.7];

  let index = 0;
  for (const z of zs) {
    for (const row of rows) {
      cast.push({
        role: "cabinet",
        index,
        position: new THREE.Vector3(row.x, room.floorY + SEAT_Y, z),
        rotationY: row.facing,
        pose: index % 2 === 0 ? "sit-forward" : "sit",
      });
      index += 1;
    }
  }
  return cast;
}

/**
 * The lights the model does not carry.
 *
 * A SketchUp export is geometry and nothing else, so the room arrives pitch
 * dark but for the scene's environment map. These are the three chandeliers
 * down the centre line, plus a cold fill so the corners under a 2.6m ceiling
 * are not black, and a downlight on the seal wall so the one piece of gold in
 * the room reads from the far end.
 */
export function sitroomModelLights(model: THREE.Object3D): THREE.Object3D[] {
  const room = measureSitroom(model);
  if (!room) return [];
  const lights: THREE.Object3D[] = [];

  for (const t of [0.26, 0.5, 0.74]) {
    const lamp = new THREE.PointLight(0xffe9c8, 9, 9.5, 2);
    lamp.position.set(room.tableX, room.floorY + 2.24, room.minZ + (room.maxZ - room.minZ) * t);
    lights.push(lamp);
  }

  const seal = new THREE.SpotLight(0xfff0d6, 9, 6, 0.6, 0.6, 1.6);
  seal.position.set(room.tableX, room.floorY + 2.35, room.minZ + 1.5);
  seal.target.position.set(room.tableX, room.floorY + 1.8, room.minZ);
  lights.push(seal, seal.target);

  const fill = new THREE.HemisphereLight(0xa8bcd4, 0x2a2f38, 0.75);
  fill.position.set(room.tableX, room.floorY + 2.5, room.centre.z);
  lights.push(fill);

  return lights;
}
