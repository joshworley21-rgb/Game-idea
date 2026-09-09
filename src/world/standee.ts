import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/**
 * Real cardboard-cutout standees: a flat board — textured with a person's
 * actual portrait on the front face — sitting on a flat rounded-rectangle
 * kraft-cardboard base plate plus a triangular rear easel-back kickstand,
 * the classic shape a retail cutout uses. Board, base plate and kickstand
 * are all one self-authored `cutout_stand.{obj,mtl}` model: simple flat
 * cardboard geometry in the same low-poly, flat-material style as the rest
 * of the game's furniture, rather than a photoreal scan that would clash
 * with it. Loads once and gets cloned per person, the same
 * "cache the source, clone per placement" shape `assetLoader.ts` uses for
 * furniture.
 *
 * The OBJ's named materials come back from MTLLoader as MeshPhongMaterial,
 * which would read flat next to the rest of the scene's
 * MeshStandardMaterial — so only the material *names* survive from the
 * load; the actual materials used for rendering are built fresh here, PBR
 * to match everything else.
 */

const BOARD_MODEL_URL = "models/cutout_stand.obj";
const BOARD_MTL_URL = "models/cutout_stand.mtl";

const MATERIALS: Record<string, () => THREE.MeshStandardMaterial> = {
  // alphaTest cuts the flat board down to the person's die-cut silhouette
  // (the portrait PNGs carry a transparent background) without the sorting
  // headaches transparent blending would bring to a scene full of other
  // standees and furniture.
  CharacterPortrait: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, alphaTest: 0.5 }),
  CardboardRim: () => new THREE.MeshStandardMaterial({ color: 0xc2a97a, roughness: 0.92 }),
  KraftCardboard: () => new THREE.MeshStandardMaterial({ color: 0xc9a877, roughness: 0.92 }),
};

let basePromise: Promise<THREE.Object3D> | null = null;

/** Loads the standee template once; every later call gets the same promise. */
export function loadStandeeBase(): Promise<THREE.Object3D> {
  if (!basePromise) {
    basePromise = new MTLLoader()
      .loadAsync(BOARD_MTL_URL)
      .then((materials) => {
        materials.preload();
        const loader = new OBJLoader();
        loader.setMaterials(materials);
        return loader.loadAsync(BOARD_MODEL_URL);
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

/** Rebuilds a material by name for the OBJ's three known materials. */
function rebuildMaterial(source: THREE.Material | undefined, name: string): THREE.Material {
  const build = source?.name ? MATERIALS[source.name] : undefined;
  if (!build) return source ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const material = build();
  if (source?.name === "CharacterPortrait") material.map = portraitTexture(name);
  return material;
}

/**
 * One standee, cut from the loaded template and textured with this person's
 * portrait. The whole model is one mesh with one `usemtl` group per
 * material (`CardboardRim` appears twice — once for each edge pair) —
 * OBJLoader represents that as a single mesh whose `.material` is an
 * *array*, not one named material, so each entry has to be rebuilt by its
 * own name.
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
