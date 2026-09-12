import * as THREE from "three";

/** Where the camera should sit for the Oval, and what it looks at. */
export interface DeskPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  nodeName: string;
}

/**
 * The Oval Office model names its furniture in its own way, so the desk is
 * found by name rather than assumed to sit at the procedural coordinates.
 * "Desk" is tried first; "resolute" and "table" are fallbacks because some
 * exports name the Resolute desk by its wood rather than its function.
 */
const DESK_PATTERNS = [/desk/i, /resolute/i, /table/i];

/**
 * Finds the Resolute desk in a loaded Oval Office model and returns a camera
 * pose behind it: sitting in the president's chair, looking over the desk into
 * the room.
 *
 * The room centre is only used to decide which side of the desk is the front.
 * The actual offset is snapped to the desk's own front-back axis, so the camera
 * ends up directly behind the desk even when the model's bounding-box centre is
 * off to one side.
 */
export function findDeskPose(model: THREE.Object3D): DeskPose | null {
  model.updateMatrixWorld(true);

  const desk = findDesk(model);
  if (!desk) {
    // console.error, not warn: consoleBanner.ts puts this on the Android screen,
    // where there is otherwise no console to read.
    console.error("[oval] no desk node found in model", nodeNames(model));
    return null;
  }

  const deskBox = new THREE.Box3().setFromObject(desk);
  const deskSize = deskBox.getSize(new THREE.Vector3());
  const deskCenter = deskBox.getCenter(new THREE.Vector3());

  const quat = new THREE.Quaternion();
  desk.getWorldQuaternion(quat);
  const invQuat = quat.clone().invert();

  // Estimate the desk's own width and depth axes from its bounds, expressed in
  // the desk's local frame. The depth axis is the shorter of the two.
  const extents = localExtents(deskBox, deskCenter, invQuat);
  const depthAxisLocal = extents.x <= extents.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const depth = Math.min(extents.x, extents.z) || Math.max(deskSize.x, deskSize.z, 0.001);

  // Which way is the front? The side of the desk that points toward the middle
  // of the room. This only chooses the sign; the direction itself is snapped to
  // the desk's axis.
  const toRoom = new THREE.Vector3().subVectors(roomCenter(model), deskCenter);
  toRoom.y = 0;
  if (toRoom.lengthSq() < 1e-6) toRoom.set(0, 0, 1);
  toRoom.normalize();

  const localRoom = toRoom.clone().applyQuaternion(invQuat);
  const sign = localRoom.dot(depthAxisLocal) >= 0 ? 1 : -1;
  const frontLocal = depthAxisLocal.clone().multiplyScalar(sign);
  const front = frontLocal.clone().applyQuaternion(quat).normalize();
  const behind = front.clone().negate();

  const position = deskCenter.clone().addScaledVector(behind, depth * 0.74);
  position.y = deskBox.max.y + depth * 0.55;

  // Look across the desk rather than straight down at it.
  const target = deskCenter.clone();
  target.y = deskBox.max.y + depth * 0.35;

  return { position, target, nodeName: desk.name || "(unnamed)" };
}

function roomCenter(model: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
}

/**
 * Picks the largest matching node rather than the first one the traversal
 * happens to hit. A scene can contain several tables; the Resolute desk is
 * the one with the biggest footprint.
 */
function findDesk(root: THREE.Object3D): THREE.Object3D | null {
  for (const pattern of DESK_PATTERNS) {
    let best: THREE.Object3D | null = null;
    let bestArea = -1;
    root.traverse((obj) => {
      if (!pattern.test(obj.name)) return;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
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

function localExtents(
  box: THREE.Box3,
  centre: THREE.Vector3,
  invQuat: THREE.Quaternion,
): { x: number; z: number } {
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const corner of corners) {
    const local = corner.sub(centre).applyQuaternion(invQuat);
    minX = Math.min(minX, local.x);
    maxX = Math.max(maxX, local.x);
    minZ = Math.min(minZ, local.z);
    maxZ = Math.max(maxZ, local.z);
  }
  return { x: maxX - minX, z: maxZ - minZ };
}

function nodeNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((obj) => {
    if (obj.name) names.push(obj.name);
  });
  return names.slice(0, 40);
}
