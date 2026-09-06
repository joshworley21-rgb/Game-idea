import * as THREE from "three";

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
