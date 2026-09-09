import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/**
 * Real cardboard-cutout standees: a flat board — textured with a person's
 * actual portrait on the front face — sitting on a real base: a flat
 * rounded-rectangle kraft-cardboard base plate plus a triangular rear
 * easel-back kickstand, the classic shape a retail cutout uses. The board
 * comes from our own `cutout_stand.{obj,mtl}`; the base is a decimated real
 * 3D scan the user supplied (originally ~1.9M triangles at 56MB — cut down
 * to ~1,300 triangles and 512px textures, and trimmed to drop the model's
 * own tall support panel, which duplicated our board). Both load once and
 * get combined into one template, cloned per person the same
 * "cache the source, clone per placement" shape `assetLoader.ts` uses for
 * furniture.
 *
 * The OBJ's two named materials (`CharacterPortrait`, `CardboardRim`) come
 * back from MTLLoader as MeshPhongMaterial, which would read flat next to
 * the rest of the scene's MeshStandardMaterial — so only the material
 * *names* survive from the load; the actual materials used for rendering
 * are built fresh here, PBR to match everything else. The base's own GLTF
 * materials are already MeshStandardMaterial (GLTFLoader's native PBR type)
 * with their own baked textures, so those pass through untouched.
 */

const BOARD_MODEL_URL = "models/cutout_stand.obj";
const BOARD_MTL_URL = "models/cutout_stand.mtl";
const BASE_MODEL_URL = "models/cutout_stand_base.glb";

const MATERIALS: Record<string, () => THREE.MeshStandardMaterial> = {
  // alphaTest cuts the flat board down to the person's die-cut silhouette
  // (the portrait PNGs carry a transparent background) without the sorting
  // headaches transparent blending would bring to a scene full of other
  // standees and furniture.
  CharacterPortrait: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, alphaTest: 0.5 }),
  CardboardRim: () => new THREE.MeshStandardMaterial({ color: 0xc2a97a, roughness: 0.92 }),
};

let basePromise: Promise<THREE.Object3D> | null = null;

/** Loads the standee template once; every later call gets the same promise. */
export function loadStandeeBase(): Promise<THREE.Object3D> {
  if (!basePromise) {
    const board = new MTLLoader()
      .loadAsync(BOARD_MTL_URL)
      .then((materials) => {
        materials.preload();
        const loader = new OBJLoader();
        loader.setMaterials(materials);
        return loader.loadAsync(BOARD_MODEL_URL);
      });
    const stand = new GLTFLoader().loadAsync(BASE_MODEL_URL).then((gltf) => gltf.scene);
    basePromise = Promise.all([board, stand])
      .then(([boardObj, standObj]) => {
        boardObj.add(standObj);
        return boardObj;
      })
      .catch((error) => {
        basePromise = null;
        throw error;
      });
  }
  return basePromise;
}

/** `"Margaret Lindqvist"` -> `"margaret-lindqvist"` — mirrors `ui/portrait.ts`'s `slug`. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function portraitTexture(name: string): THREE.Texture {
  const cached = textureCache.get(name);
  if (cached) return cached;
  // The full-body cutout photo, not the small headshot `ui/portrait.ts` uses
  // elsewhere — this is what actually fills the standee's board (see the
  // OBJ comment above: the UVs map the whole 0.5x1.6m front face to it).
  const tex = textureLoader.load(`portraits/cutouts/${slug(name)}.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(name, tex);
  return tex;
}

/**
 * Rebuilds a material by name for the OBJ's two known materials; anything
 * else (the base's own GLTF materials, already proper MeshStandardMaterial
 * with baked textures) passes through unchanged rather than getting
 * replaced by a generic fallback.
 */
function rebuildMaterial(source: THREE.Material | undefined, name: string): THREE.Material {
  const build = source?.name ? MATERIALS[source.name] : undefined;
  if (!build) return source ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const material = build();
  if (source?.name === "CharacterPortrait") material.map = portraitTexture(name);
  return material;
}

/**
 * One standee, cut from the loaded template and textured with this person's
 * portrait. The board's front, rim and back are one mesh with one `usemtl`
 * group per material (`CardboardRim` appears twice — once for each edge
 * pair) — OBJLoader represents that as a single mesh whose `.material` is
 * an *array*, not one named material, so each entry has to be rebuilt by
 * its own name. The attached base's meshes keep their own materials as-is.
 */
export function buildStandee(base: THREE.Object3D, name: string): THREE.Object3D {
  const clone = base.clone(true);
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = Array.isArray(child.material)
      ? child.material.map((source) => rebuildMaterial(source, name))
      : rebuildMaterial(child.material, name);
  });
  return clone;
}
