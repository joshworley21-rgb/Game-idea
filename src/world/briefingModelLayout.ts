import * as THREE from "three";
import type { StationId } from "../game/types.ts";
import type { CastSlot, Door, StationAnchor } from "./roomkit.ts";

/**
 * Where the podium, the press corps and the way out go in the loaded Briefing
 * Room model.
 *
 * The model is the James S. Brady Press Briefing Room, converted from a Unity
 * scene of 149 placed prefabs, so unlike the Oval and the Situation Room this
 * one arrives with its own furniture: seven rows of seven seats, a stage with
 * the blue drape and the seal behind it, the camera platform at the back, and
 * five sets of double doors down one wall. Nothing below adds anything to the
 * room — it only says where in it the game's own pieces belong.
 *
 * The room, with the floor at y = 0:
 *
 *     x  -4.22 ..  4.14    8.36m wide
 *     y   0.00 ..  4.32    a 4.3m ceiling, the tallest in the game
 *     z -10.41 .. 10.39   20.80m long
 *
 * The long axis is z and the stage is at -z: the drape is at z = -9.6, the
 * podium stands on a 0.57m riser at z = -7.2, and the seats run from z = -4.5
 * back to z = 2.7. Behind them the room keeps going for another eight metres
 * of camera platform, monitors and equipment racks, which is why it measures
 * twice the length of the room a photograph of it suggests.
 *
 * The two long walls are not interchangeable. The -x wall is the glazed one,
 * with five sets of double doors and daylight and a tree behind it; the +x
 * wall carries the seal, the Brady plaque and the single door that leads back
 * into the West Wing. So the way out is on +x.
 *
 * Every measurement is written as an offset from the room's own walls rather
 * than as a world coordinate, so the layout still lands if the model is
 * re-exported at a different origin or scale.
 */

/** How far in from the -z wall the podium stands. */
const PODIUM_Z = 3.22;
/** The podium's centre line, from the -x wall. The room is not symmetrical. */
const PODIUM_X = 4.14;
/** The top of the stage riser, above the floor. */
const STAGE_Y = 0.57;
/** How far behind the podium the speaker stands. */
const STAND_BACK = 0.62;
/** How far in from the -z wall the way out is, and which wall it is in. */
const DOOR_Z = 9.15;
/** How far off a wall a door marker stands. */
const DOOR_INSET = 0.95;

/**
 * The seven seats in a row, as offsets from the middle of the room, and the
 * seven rows, as distances from the -z wall.
 *
 * These are the model's own chairs, read back out of the Unity scene rather
 * than invented: a press corps sitting anywhere else sits inside the furniture.
 */
const SEAT_X = [-2.35, -1.66, -0.97, -0.27, 0.42, 1.11, 1.8];
const SEAT_Z = [5.91, 6.99, 8.13, 9.37, 10.67, 11.93, 13.07];

export interface BriefingMeasure {
  centre: THREE.Vector3;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  /** The podium's centre line. */
  podiumX: number;
  /** The top of the stage riser. */
  stageY: number;
}

/**
 * Measures the room from its walls, not from its bounding box.
 *
 * The pack plants a tree three metres outside the glazed wall so there is
 * something to see through the windows, and it is in the model: measure the
 * bounding box and the room's centre line comes out 1.6m off, which puts the
 * podium in the aisle. The wall mesh is the room.
 */
export function measureBriefing(model: THREE.Object3D): BriefingMeasure | null {
  model.updateMatrixWorld(true);
  const walls = model.getObjectByName("wall");
  const box = new THREE.Box3().setFromObject(walls ?? model);
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
    podiumX: box.min.x + PODIUM_X,
    stageY: box.min.y + STAGE_Y,
  };
}

/**
 * The one station: the podium.
 *
 * You stand behind it on the riser, looking down the length of the room at the
 * press corps. The eye is written above the stage rather than above the floor,
 * because a briefing given from 1.42m has the lectern across the bottom third
 * of the frame — the riser is half a metre and it is there to be stood on.
 */
export function briefingModelAnchors(model: THREE.Object3D): StationAnchor[] | null {
  const room = measureBriefing(model);
  if (!room) return null;

  const podiumZ = room.minZ + PODIUM_Z;
  return [
    {
      id: "press" as StationId,
      position: new THREE.Vector3(room.podiumX, room.stageY, podiumZ - STAND_BACK),
      camera: new THREE.Vector3(room.podiumX, room.stageY, podiumZ - STAND_BACK),
      // Aimed at the middle of the seating, not at the back wall: focusing on
      // the far wall tips the frame up over the heads of everyone asking the
      // questions.
      focus: new THREE.Vector3(room.podiumX, room.floorY + 1.3, room.minZ + 9.5),
    },
  ];
}

/** The one way out: the single door in the +x wall, back to the Cabinet Room. */
export function briefingModelDoors(model: THREE.Object3D): Door[] | null {
  const room = measureBriefing(model);
  if (!room) return null;

  const doorZ = room.minZ + DOOR_Z;
  return [
    {
      to: "cabinet",
      label: "The Cabinet Room",
      position: new THREE.Vector3(room.maxX - DOOR_INSET, room.floorY, doorZ),
      facing: new THREE.Vector3(room.maxX, room.floorY + 1.5, doorZ),
    },
  ];
}

/**
 * Where the player arrives: inside the door, at the back of the seating,
 * looking up the aisle at the podium and the seal behind it.
 */
export function briefingModelSpawn(
  model: THREE.Object3D,
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const room = measureBriefing(model);
  if (!room) return null;
  return {
    position: new THREE.Vector3(room.maxX - 1.5, room.floorY + 1.55, room.minZ + DOOR_Z),
    target: new THREE.Vector3(room.podiumX, room.floorY + 1.5, room.minZ + PODIUM_Z),
  };
}

/**
 * The press corps, in the model's own chairs.
 *
 * Seven rows of seven, with every fourth seat left empty the way a briefing
 * room always is — nobody fills the room, and a full grid of identical seated
 * figures reads as a stadium rather than as a press corps.
 */
export function briefingModelCast(model: THREE.Object3D): CastSlot[] | null {
  const room = measureBriefing(model);
  if (!room) return null;

  const cast: CastSlot[] = [];
  let index = 0;
  SEAT_Z.forEach((dz, row) => {
    SEAT_X.forEach((dx, col) => {
      if ((row * SEAT_X.length + col) % 4 === 3) return;
      cast.push({
        role: "press",
        index: index++,
        position: new THREE.Vector3(room.centre.x + dx, room.floorY, room.minZ + dz),
        // The chairs face the stage, which is -z, and so does everyone in them.
        rotationY: 0,
        pose: (row + col) % 4 === 0 ? "sit-forward" : "sit",
      });
    });
  });
  return cast;
}

/**
 * The lights the model does not carry.
 *
 * The pack models the ceiling fixtures — a run of tilted housings over the
 * stage and recessed cans over the seating — but they are geometry, not
 * lights, so the room arrives lit only by the scene's environment map. These
 * put light where the fixtures point: a key on the podium from the housings
 * above it, a line of practicals down the seating, and a cold fill so that a
 * 20m room does not fall away to black at the far end.
 */
export function briefingModelLights(model: THREE.Object3D): THREE.Object3D[] {
  const room = measureBriefing(model);
  if (!room) return [];
  const lights: THREE.Object3D[] = [];

  const podiumZ = room.minZ + PODIUM_Z;
  const key = new THREE.SpotLight(0xfff4e2, 14, 11, 0.66, 0.5, 1.6);
  key.position.set(room.podiumX, room.floorY + 3.5, podiumZ + 2.6);
  key.target.position.set(room.podiumX, room.stageY + 1.2, podiumZ);
  lights.push(key, key.target);

  // A wash on the drape, so the seal reads from the back of the room.
  const wash = new THREE.SpotLight(0xdce6ff, 6, 8, 0.8, 0.7, 1.4);
  wash.position.set(room.podiumX, room.floorY + 3.8, room.minZ + 2.4);
  wash.target.position.set(room.podiumX, room.floorY + 2.4, room.minZ);
  lights.push(wash, wash.target);

  for (const dz of [6.5, 10.5, 14.5, 18.0]) {
    const lamp = new THREE.PointLight(0xfff0d8, 3.2, 11, 2);
    lamp.position.set(room.centre.x, room.floorY + 3.4, room.minZ + dz);
    lights.push(lamp);
  }

  const fill = new THREE.HemisphereLight(0xc4d2e4, 0x2f3138, 0.35);
  fill.position.set(room.centre.x, room.floorY + 4, room.centre.z);
  lights.push(fill);

  return lights;
}
