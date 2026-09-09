import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/**
 * Real cardboard-cutout standees: a flat board on a triangular stand,
 * textured with a person's actual portrait on the front face. Loaded once
 * from `public/models/cutout_stand.{obj,mtl}` and cloned per person, the
 * same "cache the source, clone per placement" shape `assetLoader.ts` uses
 * for furniture.
 *
 * The template's four named materials (`CharacterPortrait`, `CardboardRim`,
 * `StandWood`, `KraftCardboard`) come back from MTLLoader as MeshPhongMaterial, which would
 * read flat next to the rest of the scene's MeshStandardMaterial — so only
 * the material *names* survive from the load; the actual materials used for
 * rendering are built fresh here, PBR to match everything else.
 */

const MODEL_URL = "models/cutout_stand.obj";
const MTL_URL = "models/cutout_stand.mtl";

const MATERIALS: Record<string, () => THREE.MeshStandardMaterial> = {
  // alphaTest cuts the flat board down to the person's die-cut silhouette
  // (the portrait PNGs carry a transparent background) without the sorting
  // headaches transparent blending would bring to a scene full of other
  // standees and furniture.
  CharacterPortrait: () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, alphaTest: 0.5 }),
  CardboardRim: () => new THREE.MeshStandardMaterial({ color: 0xc2a97a, roughness: 0.92 }),
  // Pale unfinished pine — the tripod legs read as an actual wooden foot
  // rather than more packaging.
  StandWood: () => new THREE.MeshStandardMaterial({ color: 0xe8d3a3, roughness: 0.65 }),
  // The rear kickstand strut is unbleached kraft cardboard, not wood — a
  // separate, slightly rougher, more saturated tan from the tripod.
  KraftCardboard: () => new THREE.MeshStandardMaterial({ color: 0xc7a06c, roughness: 0.95 }),
};

let basePromise: Promise<THREE.Object3D> | null = null;

/** Loads the standee template once; every later call gets the same promise. */
export function loadStandeeBase(): Promise<THREE.Object3D> {
  if (!basePromise) {
    basePromise = new MTLLoader()
      .loadAsync(MTL_URL)
      .then((materials) => {
        materials.preload();
        const loader = new OBJLoader();
        loader.setMaterials(materials);
        return loader.loadAsync(MODEL_URL);
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

function rebuildMaterial(source: THREE.Material | undefined, name: string): THREE.MeshStandardMaterial {
  const build = MATERIALS[source?.name ?? ""];
  const material = build ? build() : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  if (source?.name === "CharacterPortrait") material.map = portraitTexture(name);
  return material;
}

/**
 * One standee, cut from the loaded template and textured with this person's
 * portrait. The template's front board, rim and stand are all one mesh with
 * one `usemtl` group per material (`CardboardRim` appears twice — once for
 * the board's edges, once for the support strut) — OBJLoader represents
 * that as a single mesh whose `.material` is an *array*, not one named
 * material, so each entry has to be rebuilt by its own name.
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
