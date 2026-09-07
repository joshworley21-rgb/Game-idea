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

export function standard(color: number, roughness = 0.85, metalness = 0.02): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * The textured materials. Everything used to be a flat colour, which is what
 * made the rooms read as cardboard however good the lighting was; these carry
 * a colour map and a normal map so surfaces respond to light.
 */
export function woodMat(
  color: number,
  opts: { repeat?: number; seed?: number; planks?: number; roughness?: number } = {},
): THREE.MeshStandardMaterial {
  const s = wood(color, opts.repeat ?? 3, opts.seed ?? 1, opts.planks ?? 5);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: opts.roughness ?? 0.5,
    metalness: 0.03,
  });
}

export function carpetMat(color: number, repeat = 8): THREE.MeshStandardMaterial {
  const s = carpet(color, repeat);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.98,
    metalness: 0,
  });
}

export function plasterMat(color: number, repeat = 3): THREE.MeshStandardMaterial {
  const s = plaster(color, repeat);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function weaveMat(color: number, repeat = 6): THREE.MeshStandardMaterial {
  const s = weave(color, repeat);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.92,
    metalness: 0,
  });
}

export function marbleMat(color: number, repeat = 2): THREE.MeshStandardMaterial {
  const s = marble(color, repeat);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.3,
    metalness: 0.04,
  });
}

export function suitingMat(color: number, repeat = 4): THREE.MeshStandardMaterial {
  const s = suiting(color, repeat);
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.82,
    metalness: 0.01,
  });
}

export function metal(color: number, roughness = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85 });
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
