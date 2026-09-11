import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Frames the loaded Oval Office model.
 *
 * scene.ts hard-codes a camera position and orbit target for the loaded
 * GLB. The model's own origin and scale rarely match those numbers, which
 * leaves the camera outside the room. This module patches the renderer and
 * orbit controls so the frame is recomputed from the model's real bounding
 * box on the first frame after it loads.
 */

let lastAdded: THREE.Object3D | null = null;
let orbit: OrbitControls | null = null;
let applied = false;

const sceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function (this: THREE.Scene, ...objects: THREE.Object3D[]): THREE.Scene {
  lastAdded = objects[objects.length - 1] ?? null;
  sceneAdd.apply(this, objects);
  return this;
};

const orbitUpdate = OrbitControls.prototype.update;
OrbitControls.prototype.update = function (this: OrbitControls, deltaTime?: number): boolean {
  orbit = this;
  return orbitUpdate.call(this, deltaTime);
};

const render = THREE.WebGLRenderer.prototype.render;
THREE.WebGLRenderer.prototype.render = function (
  this: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
): void {
  if (!applied && orbit && lastAdded) {
    frame(scene, camera as THREE.PerspectiveCamera, orbit, lastAdded);
  }
  render.call(this, scene, camera);
};

function frame(
  scene: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  model: THREE.Object3D,
): void {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const radius = Math.max(0.001, maxDim / 2);

  // Stand at eye height above the model's floor, just inside the room,
  // looking toward its centre.
  const eyeY = box.min.y + 1.6;
  const step = Math.min(size.z * 0.3, radius * 0.5);
  camera.position.set(center.x, eyeY, center.z + step);
  controls.target.set(center.x, box.min.y + 1.2, center.z);
  controls.minDistance = Math.max(0.01, radius * 0.02);
  controls.maxDistance = radius * 8;
  controls.update();

  camera.near = Math.max(0.01, radius / 100);
  camera.far = radius * 15;
  camera.updateProjectionMatrix();

  const fog = (scene as THREE.Scene).fog;
  if (fog instanceof THREE.Fog) {
    fog.near = radius * 0.6;
    fog.far = radius * 6;
  }

  applied = true;

  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:9999;color:#bfe;background:rgba(0,0,0,.65);padding:6px 8px;border-radius:6px;font:12px/1.4 monospace;pointer-events:none;max-width:94vw";
  div.textContent =
    `model ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} m, ` +
    `center ${center.x.toFixed(1)},${center.y.toFixed(1)},${center.z.toFixed(1)}`;
  document.body.appendChild(div);
}
