import * as THREE from "three";
import { carpet, marble, plaster, suiting, weave, wood } from "./textures.ts";

/** Shared palette so the room reads as one space. */
export const PALETTE = {
  floor: 0x7a5433,
  rug: 0x1d2f52,
  rugTrim: 0xc9a227,
  wall: 0xeee4d2,
  trim: 0xfbf7ef,
  ceiling: 0xf6f1e6,
  mahogany: 0x5c3a22,
  walnut: 0x43291a,
  upholstery: 0xd8c9a8,
  sofa: 0xc2a878,
  drape: 0xb8912f,
  brass: 0xb08d3f,
  marble: 0xe6e2d8,
  leather: 0x2f2318,
  paper: 0xf3efe4,
} as const;

/**
 * The material system.
 *
 * Everything used to be a flat `MeshStandardMaterial`, which is a fine base
 * but has no way to express the difference between polished mahogany, brushed
 * brass, velvet upholstery and a marble mantel — they all share one BRDF.
 *
 * The upgrade path is `MeshPhysicalMaterial`, which adds the terms that make
 * real surfaces read as themselves:
 *   - `clearcoat` — a second, glossy lobe on top of the base. This is what
 *     makes a freshly polished desk or a brass knob catch a sharp highlight
 *     while the wood underneath stays matte.
 *   - `sheen` — a soft, wide lobe for fabric. Velvet, wool and upholstery
 *     catch light along their fibres, not as a mirror.
 *
 * `MeshPhysicalMaterial` extends `MeshStandardMaterial`, so every existing
 * call site keeps working; only the constructor changes.
 */

export function standard(color: number, roughness = 0.85, metalness = 0.02): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** A polished surface: wood, marble, leather — anything with a clearcoat. */
export function polished(
  color: number,
  opts: {
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
  } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.02,
    clearcoat: opts.clearcoat ?? 0.6,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.15,
  });
}

/** A soft fabric: velvet, wool, upholstery. Sheen is the velvet term. */
export function fabric(
  color: number,
  opts: {
    roughness?: number;
    sheen?: number;
    sheenRoughness?: number;
    sheenColor?: number;
  } = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: 0,
    sheen: opts.sheen ?? 0.7,
    sheenRoughness: opts.sheenRoughness ?? 0.6,
    sheenColor: opts.sheenColor ?? 0xffffff,
  });
}

/** A metal: brass, chrome, gold. High metalness, low roughness, clearcoat. */
export function metal(color: number, roughness = 0.35): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0.9,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });
}

/**
 * The textured materials. These carry a colour map and a normal map so
 * surfaces respond to light. Where the surface is one that would have a
 * polished finish in reality, they use `MeshPhysicalMaterial` with a
 * clearcoat so the grain reads through a glossy top layer.
 */
export function woodMat(
  color: number,
  opts: { repeat?: number; seed?: number; planks?: number; roughness?: number } = {},
): THREE.MeshPhysicalMaterial {
  const s = wood(color, opts.repeat ?? 3, opts.seed ?? 1, opts.planks ?? 5);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: opts.roughness ?? 0.5,
    metalness: 0.03,
    // A polished floor or tabletop has a clearcoat over the grain. The
    // roughness of the clearcoat is low so it catches a sharp highlight,
    // while the base roughness keeps the wood itself from looking plastic.
    clearcoat: opts.roughness !== undefined && opts.roughness < 0.45 ? 0.7 : 0.35,
    clearcoatRoughness: 0.18,
  });
}

export function carpetMat(color: number, repeat = 8): THREE.MeshPhysicalMaterial {
  const s = carpet(color, repeat);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.98,
    metalness: 0,
    // Carpet has a soft sheen from the fibres catching light.
    sheen: 0.35,
    sheenRoughness: 0.9,
  });
}

export function plasterMat(color: number, repeat = 3): THREE.MeshPhysicalMaterial {
  const s = plaster(color, repeat);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function weaveMat(color: number, repeat = 6): THREE.MeshPhysicalMaterial {
  const s = weave(color, repeat);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.92,
    metalness: 0,
    // Woven cloth has a directional sheen along the warp.
    sheen: 0.55,
    sheenRoughness: 0.7,
  });
}

export function marbleMat(color: number, repeat = 2): THREE.MeshPhysicalMaterial {
  const s = marble(color, repeat);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.3,
    metalness: 0.04,
    // Polished stone: a strong clearcoat over the veining.
    clearcoat: 0.8,
    clearcoatRoughness: 0.08,
  });
}

export function suitingMat(color: number, repeat = 4): THREE.MeshPhysicalMaterial {
  const s = suiting(color, repeat);
  return new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.82,
    metalness: 0.01,
    // Wool suiting has a soft sheen that reads as the fabric catching light.
    sheen: 0.45,
    sheenRoughness: 0.75,
  });
}

/** Adds a mesh with shadows enabled and returns it. */
export function place(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
