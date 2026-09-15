/**
 * Measures a room model, so camera seats come from the geometry rather than
 * from an eye in an editor.
 *
 *   node scripts/measure-rooms.mjs public/models/OvalOffice.glb
 *   ONLY=ResoluteDesk,Fireplace node scripts/measure-rooms.mjs public/models/OvalOffice.glb
 *
 * Prints every mesh's world-space bounding box, biggest footprint first, or
 * just the ones whose names match ONLY. The numbers quoted in
 * godot/scripts/world/rooms.gd came from here, and should be re-derived from
 * here if a model is ever reprocessed.
 *
 * The models are flattened first because a GLB straight out of FBX2glTF nests
 * everything under a RootNode, and a node's own transform is then only part
 * of where its mesh actually is.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { flatten } from "@gltf-transform/functions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** World-space AABB of one mesh, by walking its accessor positions. */
function meshBox(node) {
  const m = node.getMesh();
  if (!m) return null;
  const world = node.getWorldMatrix();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const prim of m.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    // The accessor's own min/max are in local space; transform the eight
    // corners of that box rather than every vertex.
    const [ax, ay, az] = pos.getMinNormalized([0, 0, 0]);
    const [bx, by, bz] = pos.getMaxNormalized([0, 0, 0]);
    for (const cx of [ax, bx]) for (const cy of [ay, by]) for (const cz of [az, bz]) {
      const x = world[0] * cx + world[4] * cy + world[8] * cz + world[12];
      const y = world[1] * cx + world[5] * cy + world[9] * cz + world[13];
      const z = world[2] * cx + world[6] * cy + world[10] * cz + world[14];
      lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)];
      hi = [Math.max(hi[0], x), Math.max(hi[1], y), Math.max(hi[2], z)];
    }
  }
  return Number.isFinite(lo[0]) ? { lo, hi } : null;
}

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  await doc.transform(flatten());
  const rows = [];
  for (const node of doc.getRoot().listNodes()) {
    const b = meshBox(node);
    if (!b) continue;
    rows.push({ name: node.getName() || "(unnamed)", ...b,
      footprint: (b.hi[0] - b.lo[0]) * (b.hi[2] - b.lo[2]) });
  }
  rows.sort((a, b) => b.footprint - a.footprint);
  console.log(`\n== ${file.split("/").pop()} == ${rows.length} meshes`);
  for (const r of rows.slice(0, 14)) {
    console.log(`  ${r.name.padEnd(30)} x ${r.lo[0].toFixed(2).padStart(7)}..${r.hi[0].toFixed(2).padStart(7)}  y ${r.lo[1].toFixed(2).padStart(6)}..${r.hi[1].toFixed(2).padStart(6)}  z ${r.lo[2].toFixed(2).padStart(7)}..${r.hi[2].toFixed(2).padStart(7)}`);
  }
}
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { flatten } from "@gltf-transform/functions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** World-space AABB of one mesh, by walking its accessor positions. */
function meshBox(node) {
  const m = node.getMesh();
  if (!m) return null;
  const world = node.getWorldMatrix();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const prim of m.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    // The accessor's own min/max are in local space; transform the eight
    // corners of that box rather than every vertex.
    const [ax, ay, az] = pos.getMinNormalized([0, 0, 0]);
    const [bx, by, bz] = pos.getMaxNormalized([0, 0, 0]);
    for (const cx of [ax, bx]) for (const cy of [ay, by]) for (const cz of [az, bz]) {
      const x = world[0] * cx + world[4] * cy + world[8] * cz + world[12];
      const y = world[1] * cx + world[5] * cy + world[9] * cz + world[13];
      const z = world[2] * cx + world[6] * cy + world[10] * cz + world[14];
      lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)];
      hi = [Math.max(hi[0], x), Math.max(hi[1], y), Math.max(hi[2], z)];
    }
  }
  return Number.isFinite(lo[0]) ? { lo, hi } : null;
}

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  await doc.transform(flatten());
  const rows = [];
  for (const node of doc.getRoot().listNodes()) {
    const b = meshBox(node);
    if (!b) continue;
    rows.push({ name: node.getName() || "(unnamed)", ...b,
      footprint: (b.hi[0] - b.lo[0]) * (b.hi[2] - b.lo[2]) });
  }
  rows.sort((a, b) => b.footprint - a.footprint);
  console.log(`\n== ${file.split("/").pop()} == ${rows.length} meshes`);
  for (const r of rows.slice(0, 14)) {
    console.log(`  ${r.name.padEnd(30)} x ${r.lo[0].toFixed(2).padStart(7)}..${r.hi[0].toFixed(2).padStart(7)}  y ${r.lo[1].toFixed(2).padStart(6)}..${r.hi[1].toFixed(2).padStart(6)}  z ${r.lo[2].toFixed(2).padStart(7)}..${r.hi[2].toFixed(2).padStart(7)}`);
  }
}
