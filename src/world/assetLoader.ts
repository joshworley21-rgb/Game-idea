import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PROPS } from "./props.ts";
import type { PropPlacement } from "./props.ts";

/** Where the optimised .glb files live, relative to the site root. */
const MODEL_DIR = "models";

/**
 * Single-file builds (the published artifact) have no server to fetch from, so
 * they embed each model as a data URL under this global instead.
 */
declare global {
  // eslint-disable-next-line no-var
  var __OVAL_MODELS__: Record<string, string> | undefined;
}

function urlFor(model: string): string {
  return globalThis.__OVAL_MODELS__?.[model] ?? `${MODEL_DIR}/${model}.glb`;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  label: string;
}

/** An axis-aligned footprint the player cannot walk through. */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Props whose lowest point is above this are overhead or wall-mounted. */
const FLOOR_HEIGHT = 1.2;

function prepare(object: THREE.Object3D, placement: PropPlacement): THREE.Object3D {
  const group = new THREE.Group();
  group.add(object);

  if (placement.scale && placement.scale !== 1) object.scale.setScalar(placement.scale);
  object.updateMatrixWorld(true);

  // Land the prop using its own bounds rather than trusting its origin, which
  // model authors put wherever suited them: centre it horizontally, then sit it
  // on the floor or hang it from the ceiling. A placement's x/z therefore means
  // "where the prop is", not "where its origin happens to be".
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  if (placement.centre !== false) {
    object.position.x -= centre.x;
    object.position.z -= centre.z;
  }
  if (placement.ceilingAt !== undefined) {
    object.position.y += placement.ceilingAt - box.max.y;
  } else {
    object.position.y += (placement.groundAt ?? 0) - box.min.y;
  }

  group.position.set(placement.position[0], placement.position[1], placement.position[2]);
  group.rotation.y = placement.rotation ?? 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = !placement.noShadow;
    child.receiveShadow = true;
    // Poly Haven materials are physically sane but read flat under our lights.
    const material = child.material as THREE.MeshStandardMaterial;
    if (material && "roughness" in material) {
      material.envMapIntensity = 0.7;
    }
  });

  return group;
}

/**
 * Loads every prop in the manifest and adds it to the scene. Each model is
 * fetched once and cloned per placement, so repeated furniture costs nothing
 * extra. A prop that fails to load is skipped with a warning rather than
 * taking the whole room down with it.
 */
export async function loadProps(
  scene: THREE.Object3D,
  onProgress?: (progress: LoadProgress) => void,
  footprints?: Footprint[],
): Promise<number> {
  const loader = new GLTFLoader();
  const unique = [...new Set(PROPS.map((p) => p.model))];
  const cache = new Map<string, THREE.Object3D>();
  let loaded = 0;
  let failures = 0;

  for (const model of unique) {
    onProgress?.({ loaded, total: unique.length, label: model });
    try {
      const gltf = await loader.loadAsync(urlFor(model));
      cache.set(model, gltf.scene);
    } catch (error) {
      failures += 1;
      console.warn(`[assets] could not load ${model}:`, error);
    }
    loaded += 1;
  }
  onProgress?.({ loaded, total: unique.length, label: "" });

  for (const placement of PROPS) {
    const source = cache.get(placement.model);
    if (!source) continue;
    const group = prepare(source.clone(true), placement);
    scene.add(group);

    if (!footprints) continue;
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    // Only furniture standing on the floor blocks movement; a chandelier and a
    // framed painting are things you walk under and past.
    if (bounds.min.y > FLOOR_HEIGHT) continue;
    footprints.push({
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
    });
  }

  return unique.length - failures;
}
