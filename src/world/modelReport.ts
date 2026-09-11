import * as THREE from "three";
import { showAssetError } from "../ui/assetError.ts";

/**
 * Reports a loaded Oval Office model on screen.
 *
 * The bounding box is the one thing that cannot be read off a phone any other
 * way, and it is what the station anchors have to be placed against. Printing
 * it here means a sideloaded build reports its own geometry.
 */
export function reportModelLoaded(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const fmt = (v: THREE.Vector3) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
  showAssetError(
    "Oval Office model loaded",
    [
      `roots:  ${model.children.length}`,
      `size:   ${fmt(size)}`,
      `min:    ${fmt(box.min)}`,
      `max:    ${fmt(box.max)}`,
      `centre: ${fmt(centre)}`,
    ].join("\n"),
  );
}

/** Reports a failed Oval Office load, with the URL and the reason. */
export function reportModelFailed(url: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  showAssetError("Oval Office model failed to load", `${url}\n${reason}`);
}
