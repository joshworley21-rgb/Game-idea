import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Textures that are data maps, not colour maps, and must stay linear. */
const DATA_TEXTURE_KEYS = new Set([
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "displacementMap",
  "bumpMap",
  "alphaMap",
  "clearcoatMap",
  "clearcoatRoughnessMap",
  "clearcoatNormalMap",
  "sheenRoughnessMap",
  "thicknessMap",
  "transmissionMap",
  "specularIntensityMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
]);

/** Sets colour-space textures to sRGB while leaving data maps linear. */
function applySRGB(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!material) continue;
    for (const [key, value] of Object.entries(material)) {
      if (value instanceof THREE.Texture && !DATA_TEXTURE_KEYS.has(key)) {
        value.colorSpace = THREE.SRGBColorSpace;
        value.needsUpdate = true;
      }
    }
  }
}

export interface OvalLoadHandlers {
  /** The model is in the scene and its meshes are configured. */
  onLoaded: (model: THREE.Group) => void;
  /** The model could not be fetched; the caller should fall back. */
  onError: (error: unknown) => void;
}

/**
 * Loads the bundled Oval Office GLB and hands the configured model back.
 * The caller owns the scene graph and the fallback, so this stays a loader.
 */
export function loadOvalOffice(url: string, handlers: OvalLoadHandlers): void {
  const loader = new GLTFLoader();

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          applySRGB(mesh);
        }
      });
      handlers.onLoaded(model);
    },
    (progress) => {
      const loadedMB = progress.loaded / 1048576;
      if (progress.total > 0) {
        const totalMB = progress.total / 1048576;
        const pct = (progress.loaded / progress.total) * 100;
        console.log(
          `Oval Office loading… ${pct.toFixed(1)}% (${loadedMB.toFixed(1)} MB / ${totalMB.toFixed(1)} MB)`,
        );
      } else {
        console.log(`Oval Office loading… ${loadedMB.toFixed(1)} MB`);
      }
    },
    (error) => handlers.onError(error),
  );
}
