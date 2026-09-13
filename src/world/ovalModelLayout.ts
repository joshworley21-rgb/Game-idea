import * as THREE from "three";
import type { StationId } from "../game/types.ts";
import type { Door, RoomId, StationAnchor } from "./roomkit.ts";

/**
 * Where the signs go in the loaded Oval Office model.
 *
 * The procedural room and the model are both ovals, and they are not the same
 * oval. The procedural one is 10.9m across and 8.8m deep; the model is 9.6
 * across and 11.3 deep — narrower, and half as long again the other way. So
 * every marker placed on the procedural ellipse lands somewhere else once the
 * model is on screen: the Residence plaque hung in the middle of a bookcase,
 * and the Cabinet Room's hung on a stretch of blank wall.
 *
 * The doors are written down as **bearings**, because a bearing is what was
 * actually surveyed. Raycasting the room's shell outward from its centre at
 * door height finds the gaps in the wall, and the gaps are the openings:
 *
 *     0.0°   a panelled door under a pediment          east
 *    28.3°   a bookcase alcove                         not a door
 *   127.8°   an open door beside the grandfather clock north-west
 *   151.8°   an arched door                            west
 *   180.0°   an open door through to a corridor        west
 *   208.3°   an arched door                            south-west
 *   247-293° the three windows behind the desk         not doors
 *   331.8°   a bookcase alcove                         not a door
 *
 * The radius is measured from the model at load time rather than written down
 * with them, so the markers follow the room if it is ever re-exported at a
 * different size. That is the whole failure this replaces: coordinates copied
 * out of one room and used in another.
 */

/** The node whose bounds are the room's own shell — floor, walls, ceiling. */
const ROOM_NODE = /interior/i;

/** The Resolute desk, by the names an export might give it. */
const DESK_PATTERNS = [/resolute/i, /desk/i];

/** How far in front of a door the player stands to use it. */
const DOOR_STAND_BACK = 1.05;

/** How far in front of the desk's near edge its marker sits. */
const DESK_STAND_BACK = 0.55;

export interface RoomMeasure {
  /** The centre of the floor. */
  centre: THREE.Vector3;
  /** Half-width along x and half-depth along z. */
  rx: number;
  rz: number;
  floorY: number;
}

/**
 * The four ways out, as bearings on the surveyed openings above.
 *
 * The game needs four and the model has five, so the odd one out is the
 * arched door at 151.8°: it sits between the other two on the west wall, and
 * leaving it unmarked spreads the four markers around the room instead of
 * crowding three of them onto one wall. An unmarked door is just scenery —
 * only these four are ever raycast.
 *
 * Each destination keeps the opening nearest the bearing it already had in
 * the procedural room, so the room reads the way it was laid out: the study
 * was at 207° and is now at 208.3°, the Capitol was at 133° and is now at
 * 127.8°.
 */
const MODEL_DOORS: { to: RoomId; label: string; bearing: number }[] = [
  { to: "cabinet", label: "The Cabinet Room", bearing: 0 },
  { to: "capitol", label: "The motorcade to the Capitol", bearing: 127.8 },
  { to: "residence", label: "Upstairs to the Residence", bearing: 180 },
  { to: "study", label: "The Private Study", bearing: 208.3 },
];

/**
 * The secure line, as a bearing too. It is a spot on the floor rather than a
 * piece of furniture the model names, so it is chosen to miss things: the
 * sofas down the middle of the room, the chairs along the east wall, and —
 * the one that actually bit — every door.
 *
 * At -24° it sat 1.6m from the Cabinet Room's marker and the two plaques were
 * drawn on top of each other. 75° puts it in the widest gap between doors,
 * by the side table at the fireplace end, three and a half metres clear of
 * the nearest one.
 */
const PHONE_BEARING = 75;
const PHONE_INSET = 1.9;

function findByPattern(model: THREE.Object3D, patterns: RegExp[]): THREE.Object3D | null {
  for (const pattern of patterns) {
    let best: THREE.Object3D | null = null;
    let bestArea = -1;
    model.traverse((obj) => {
      if (!pattern.test(obj.name)) return;
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      const area = size.x * size.z;
      if (area > bestArea) {
        bestArea = area;
        best = obj;
      }
    });
    if (best) return best;
  }
  return null;
}

/** Measures the room from its own shell. Null when the model has no shell. */
export function measureOvalRoom(model: THREE.Object3D): RoomMeasure | null {
  model.updateMatrixWorld(true);
  const shell = findByPattern(model, [ROOM_NODE]);
  if (!shell) return null;

  const box = new THREE.Box3().setFromObject(shell);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  centre.y = box.min.y;
  return { centre, rx: size.x / 2, rz: size.z / 2, floorY: box.min.y };
}

/**
 * Where a bearing meets the room's wall.
 *
 * This is the ray-ellipse intersection, not the ellipse's parametric point:
 * at 128° those are nearly a metre apart, and the survey was done by casting
 * rays, so the markers have to be placed the same way the openings were found.
 */
function wallPoint(room: RoomMeasure, bearingDeg: number): THREE.Vector3 {
  const a = (bearingDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const d = 1 / Math.hypot(cos / room.rx, sin / room.rz);
  return new THREE.Vector3(room.centre.x + cos * d, room.floorY, room.centre.z + sin * d);
}

/** The doors out of the loaded model, or null if it is not a room we know. */
export function ovalModelDoors(model: THREE.Object3D): Door[] | null {
  const room = measureOvalRoom(model);
  if (!room) return null;

  return MODEL_DOORS.map((spec) => {
    const onWall = wallPoint(room, spec.bearing);
    const inward = new THREE.Vector3(room.centre.x - onWall.x, 0, room.centre.z - onWall.z).normalize();
    return {
      to: spec.to,
      label: spec.label,
      position: onWall.clone().addScaledVector(inward, DOOR_STAND_BACK),
      facing: new THREE.Vector3(onWall.x, room.floorY + 1.5, onWall.z),
    };
  });
}

/** The stations in the loaded model, or null if it is not a room we know. */
export function ovalModelAnchors(model: THREE.Object3D): StationAnchor[] | null {
  const room = measureOvalRoom(model);
  if (!room) return null;

  const anchors: StationAnchor[] = [];

  // The desk marker sits just off the desk's room-facing edge, so the label
  // reads as belonging to the desk rather than floating in the middle of the
  // carpet. The camera for this station is the seated pose, which `scene.ts`
  // takes from `findDeskPose` — this is only the marker.
  const desk = findByPattern(model, DESK_PATTERNS);
  if (desk) {
    const box = new THREE.Box3().setFromObject(desk);
    const deskCentre = box.getCenter(new THREE.Vector3());
    const toRoom = new THREE.Vector3(
      room.centre.x - deskCentre.x,
      0,
      room.centre.z - deskCentre.z,
    );
    if (toRoom.lengthSq() < 1e-6) toRoom.set(0, 0, 1);
    toRoom.normalize();
    const size = box.getSize(new THREE.Vector3());
    const halfDepth = Math.min(size.x, size.z) / 2;
    const position = deskCentre
      .clone()
      .addScaledVector(toRoom, halfDepth + DESK_STAND_BACK);
    position.y = room.floorY;
    anchors.push({
      id: "desk" as StationId,
      position,
      focus: new THREE.Vector3(deskCentre.x, room.floorY + 1.1, deskCentre.z),
    });
  }

  const phoneWall = wallPoint(room, PHONE_BEARING);
  const inward = new THREE.Vector3(
    room.centre.x - phoneWall.x,
    0,
    room.centre.z - phoneWall.z,
  ).normalize();
  anchors.push({
    id: "phone" as StationId,
    position: phoneWall.clone().addScaledVector(inward, PHONE_INSET),
    focus: new THREE.Vector3(phoneWall.x, room.floorY + 1.1, phoneWall.z),
  });

  return anchors;
}
