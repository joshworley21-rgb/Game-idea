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
 * the room. The offset is proportional to the desk's size, so it survives
 * models authored at different scales.
 */
export function findDeskPose(model: THREE.Object3D): DeskPose | null {
  model.updateMatrixWorld(true);

  const desk = findDesk(model);
  if (!desk) {
    console.warn("[oval] no desk node found in model", nodeNames(model));
    return null;
  }

  const deskBox = new THREE.Box3().setFromObject(desk);
  const deskSize = deskBox.getSize(new THREE.Vector3());
  const deskCenter = deskBox.getCenter(new THREE.Vector3());
  const depth = Math.max(deskSize.x, deskSize.z, 0.001);

  // The room's centre is the best guess for "where the president faces".
  const roomBox = new THREE.Box3().setFromObject(model);
  const roomCenter = roomBox.getCenter(new THREE.Vector3());

  // Behind the desk = keep going away from the centre of the room, along the
  // line that passes through the desk.
  const away = new THREE.Vector3().subVectors(deskCenter, roomCenter);
  away.y = 0;
  if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
  away.normalize();

  const position = deskCenter.clone().addScaledVector(away, depth * 0.72);
  position.y = deskBox.max.y + depth * 0.55;

  // Look across the desk rather than straight down at it.
  const target = deskCenter.clone();
  target.y = deskBox.max.y + depth * 0.35;

  return { position, target, nodeName: desk.name || "(unnamed)" };
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

function nodeNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((obj) => {
    if (obj.name) names.push(obj.name);
  });
  return names.slice(0, 40);
}
