/**
 * Measures a room model, so camera seats come from the geometry rather than
 * from an eye in an editor.
 *
 *   node scripts/measure-rooms.mjs public/models/OvalOffice.glb
 *   ONLY=ResoluteDesk,Fireplace node scripts/measure-rooms.mjs public/models/OvalOffice.glb
 *
 * Prints every mesh's world-space bounding box, biggest footprint first, or
 * just the ones whose names match ONLY. Every number quoted in
 * godot/scripts/world/rooms.gd came from here, and should be re-derived from
 * here if a model is ever reprocessed rather than nudged until it looks right.
 *
 * The document is flattened first because a GLB out of FBX2glTF nests
 * everything under a RootNode, and a node's own transform is then only part
 * of where its mesh actually is.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { flatten } from "@gltf-transform/functions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** World-space bounding box of one mesh node, or null if it has no geometry. */
function meshBox(node) {
  const mesh = node.getMesh();
  if (!mesh) return null;
  const world = node.getWorldMatrix();
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    // The accessor's own min/max are in local space, so transform the eight
    // corners of that box rather than every vertex in it.
    const [ax, ay, az] = pos.getMinNormalized([0, 0, 0]);
    const [bx, by, bz] = pos.getMaxNormalized([0, 0, 0]);
    for (const cx of [ax, bx]) {
      for (const cy of [ay, by]) {
        for (const cz of [az, bz]) {
          const x = world[0] * cx + world[4] * cy + world[8] * cz + world[12];
          const y = world[1] * cx + world[5] * cy + world[9] * cz + world[13];
          const z = world[2] * cx + world[6] * cy + world[10] * cz + world[14];
          lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)];
          hi = [Math.max(hi[0], x), Math.max(hi[1], y), Math.max(hi[2], z)];
        }
      }
    }
  }
  return Number.isFinite(lo[0]) ? { lo, hi } : null;
}

const pad = (v, w) => v.toFixed(2).padStart(w);

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  await doc.transform(flatten());

  const rows = [];
  for (const node of doc.getRoot().listNodes()) {
    const box = meshBox(node);
    if (!box) continue;
    rows.push({
      name: node.getName() || "(unnamed)",
      ...box,
      footprint: (box.hi[0] - box.lo[0]) * (box.hi[2] - box.lo[2]),
    });
  }
  rows.sort((a, b) => b.footprint - a.footprint);

  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const shown = only
    ? rows.filter((r) => only.some((w) => r.name.toLowerCase().includes(w.toLowerCase())))
    : rows.slice(0, 14);

  console.log(`\n== ${file.split("/").pop()} == ${rows.length} meshes`);
  for (const r of shown) {
    console.log(
      `  ${r.name.padEnd(30)} x ${pad(r.lo[0], 7)}..${pad(r.hi[0], 7)}` +
        `  y ${pad(r.lo[1], 6)}..${pad(r.hi[1], 6)}` +
        `  z ${pad(r.lo[2], 7)}..${pad(r.hi[2], 7)}`,
    );
  }
}
