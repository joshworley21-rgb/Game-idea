/**
 * Cuts the Oval Office out of the White House.
 *
 * The source FBX is the whole estate: the building, the South Lawn, the
 * perimeter fence, the outbuildings and a few thousand instanced trees —
 * 312 x 33 x 300 metres of it. The game is six rooms in first person and
 * never leaves the Oval, and the windows are opaque glass, so none of the
 * rest is ever on screen. It was still being converted, optimised, shipped
 * in the APK and uploaded to the GPU every frame.
 *
 * It also put the room 69 metres from the model's origin and eight metres
 * below it, which is why the camera pose for the Oval used to be three
 * hand-measured magic numbers that meant nothing to read.
 *
 * So this keeps the room and throws the estate away:
 *
 *   1. Find the room. `Interior01` is the Oval's shell; its world bounds are
 *      the room. Nothing else is assumed about the model's layout.
 *   2. Keep what is in it, plus a margin for the things that belong to a room
 *      while sticking out of it — wall thickness, window and door moldings,
 *      curtain rails.
 *   3. Clip, rather than keep-or-drop, anything that straddles the boundary.
 *      `DoorL` is one mesh holding every door in the building and `Molding`
 *      every piece of trim; both have their centre somewhere out on the
 *      estate. Dropping them whole leaves the Oval with open holes where its
 *      doors were, and keeping them whole keeps the building. So a straddling
 *      mesh is cut to the triangles whose centroid is inside, and its
 *      vertices are re-indexed down to the ones those triangles still use.
 *   4. Filter instanced nodes per instance, for the same reason.
 *   5. Re-origin, so the floor's centre is (0, 0, 0) and a camera pose is
 *      readable: 1.31m up is eye height, not -7.09.
 *
 * Usage: node scripts/strip-exterior.mjs <input.glb> <output.glb>
 */
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup } from "@gltf-transform/functions";

/** The node whose bounds define the room. */
const ROOM_NODE = "Interior01";

/**
 * How far outside the room to keep things, in metres.
 *
 * A room's own walls, window reveals, door frames and curtain rails all have
 * geometry that starts inside it and ends outside, and a tight box slices
 * them off. The doorways need more than that: the Oval's openings look
 * through into corridors, and cutting flush to the wall leaves a hole with
 * the sky behind it, so the margin has to reach far enough to keep whatever
 * closes the far side of a doorway.
 *
 * Override with STRIP_MARGIN_XZ / STRIP_MARGIN_Y when a model needs it.
 */
const MARGIN_XZ = Number(process.env.STRIP_MARGIN_XZ ?? 7);
const MARGIN_Y = Number(process.env.STRIP_MARGIN_Y ?? 1.6);

// ---------------------------------------------------------------- matrices

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r += 1)
    for (let c = 0; c < 4; c += 1)
      for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function transform(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

// ------------------------------------------------------------------ bounds

const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (box) => !Number.isFinite(box.min[0]);

function growPoint(box, p) {
  for (let k = 0; k < 3; k += 1) {
    if (p[k] < box.min[k]) box.min[k] = p[k];
    if (p[k] > box.max[k]) box.max[k] = p[k];
  }
}

/** World bounds of a node's own mesh (not its instances, not its children). */
function meshBounds(node, matrix) {
  const mesh = node.getMesh();
  const box = emptyBox();
  if (!mesh) return box;
  const el = [0, 0, 0];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    for (let i = 0; i < pos.getCount(); i += 1) {
      pos.getElement(i, el);
      growPoint(box, transform(matrix, el));
    }
  }
  return box;
}

/** World bounds of a whole subtree, instances included. */
function subtreeBounds(node, parentMatrix = IDENTITY) {
  const matrix = multiply(parentMatrix, node.getMatrix());
  const box = emptyBox();
  const own = meshBounds(node, matrix);

  const offsets = instanceOffsets(node);
  if (offsets && !isEmpty(own)) {
    // Each instance is the base mesh shifted by its own translation.
    for (const t of offsets) {
      growPoint(box, [own.min[0] + t[0], own.min[1] + t[1], own.min[2] + t[2]]);
      growPoint(box, [own.max[0] + t[0], own.max[1] + t[1], own.max[2] + t[2]]);
    }
  } else if (!isEmpty(own)) {
    growPoint(box, own.min);
    growPoint(box, own.max);
  }

  for (const child of node.listChildren()) {
    const sub = subtreeBounds(child, matrix);
    if (!isEmpty(sub)) {
      growPoint(box, sub.min);
      growPoint(box, sub.max);
    }
  }
  return box;
}

// --------------------------------------------------------------- instancing

function instancing(node) {
  return node.getExtension("EXT_mesh_gpu_instancing") ?? null;
}

function instanceOffsets(node) {
  const ext = instancing(node);
  const attr = ext?.getAttribute("TRANSLATION");
  if (!attr) return null;
  const out = [];
  const el = [0, 0, 0];
  for (let i = 0; i < attr.getCount(); i += 1) {
    attr.getElement(i, el);
    out.push([...el]);
  }
  return out;
}

/**
 * Copies the elements at `order` out of an accessor, in place.
 *
 * This works on the raw typed array rather than `getElement`/`setArray`.
 * The model is quantized — POSITION is a normalized SHORT — so `getElement`
 * hands back a denormalized float like 0.461, and writing that back into the
 * Int16Array it came from truncates every coordinate to zero. Copying raw
 * components preserves both the component type and the normalization.
 */
function repackAccessor(attr, order) {
  const src = attr.getArray();
  const size = attr.getElementSize();
  const out = new src.constructor(order.length * size);
  for (let n = 0; n < order.length; n += 1) {
    const from = order[n] * size;
    const to = n * size;
    for (let k = 0; k < size; k += 1) out[to + k] = src[from + k];
  }
  attr.setArray(out);
}

/**
 * Rewrites an instanced node to the instances that survive. Every attribute
 * is filtered by the same index list so translation, rotation and scale stay
 * in step.
 */
function keepInstances(node, keepIndices) {
  const ext = instancing(node);
  if (!ext) return;
  for (const name of ext.listSemantics()) {
    const attr = ext.getAttribute(name);
    if (attr) repackAccessor(attr, keepIndices);
  }
}

// ------------------------------------------------------------------ clipping

/**
 * Cuts a primitive down to the triangles that lie inside `inside`, then
 * re-indexes so only the vertices those triangles use survive.
 *
 * All three vertices have to be inside, not just the centroid. The estate's
 * ground plane is a handful of triangles 226 metres across, and any test that
 * keeps one of those because its middle happens to fall in the room drags a
 * hundred metres of geometry back in with it — which is exactly what it did.
 * Requiring every vertex bounds the output by construction.
 *
 * Returns the triangle count kept. Zero means the caller should drop it.
 */
function clipPrimitive(prim, matrix, inside) {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return 0;

  const indices = prim.getIndices();
  const triCount = indices ? indices.getCount() / 3 : pos.getCount() / 3;
  const idx = (i) => (indices ? indices.getScalar(i) : i);

  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  const keptTris = [];
  for (let t = 0; t < triCount; t += 1) {
    const i0 = idx(t * 3);
    const i1 = idx(t * 3 + 1);
    const i2 = idx(t * 3 + 2);
    pos.getElement(i0, a);
    pos.getElement(i1, b);
    pos.getElement(i2, c);
    if (
      inside(transform(matrix, a)) &&
      inside(transform(matrix, b)) &&
      inside(transform(matrix, c))
    ) {
      keptTris.push([i0, i1, i2]);
    }
  }

  if (keptTris.length === 0) return 0;
  if (keptTris.length === triCount) return triCount;

  // Re-index: old vertex -> new vertex, in first-use order.
  const remap = new Map();
  const order = [];
  const newIndices = [];
  for (const tri of keptTris) {
    for (const old of tri) {
      let next = remap.get(old);
      if (next === undefined) {
        next = order.length;
        remap.set(old, next);
        order.push(old);
      }
      newIndices.push(next);
    }
  }

  for (const semantic of prim.listSemantics()) {
    const attr = prim.getAttribute(semantic);
    if (attr) repackAccessor(attr, order);
  }

  if (indices) {
    const Ctor = order.length > 65535 ? Uint32Array : Uint16Array;
    indices.setArray(new Ctor(newIndices));
  } else {
    const Ctor = order.length > 65535 ? Uint32Array : Uint16Array;
    prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Ctor(newIndices)));
  }
  return keptTris.length;
}

// -------------------------------------------------------------------- main

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/strip-exterior.mjs <input.glb> <output.glb>");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();
const scene = root.listScenes()[0];

const before = {
  nodes: root.listNodes().length,
  meshes: root.listMeshes().length,
  materials: root.listMaterials().length,
  textures: root.listTextures().length,
  bounds: getBounds(scene),
};

// 1. The room.
const roomNode = scene.listChildren().find((n) => n.getName() === ROOM_NODE);
if (!roomNode) {
  console.error(`::error::no "${ROOM_NODE}" node — cannot locate the room in this model`);
  console.error("top-level nodes:", scene.listChildren().map((n) => n.getName()).join(", "));
  process.exit(1);
}
const room = subtreeBounds(roomNode);
console.log(
  `room "${ROOM_NODE}": x ${room.min[0].toFixed(1)}..${room.max[0].toFixed(1)}  ` +
    `y ${room.min[1].toFixed(1)}..${room.max[1].toFixed(1)}  z ${room.min[2].toFixed(1)}..${room.max[2].toFixed(1)}`,
);

const keepBox = {
  min: [room.min[0] - MARGIN_XZ, room.min[1] - MARGIN_Y, room.min[2] - MARGIN_XZ],
  max: [room.max[0] + MARGIN_XZ, room.max[1] + MARGIN_Y, room.max[2] + MARGIN_XZ],
};
const inKeep = (p) =>
  p[0] >= keepBox.min[0] && p[0] <= keepBox.max[0] &&
  p[1] >= keepBox.min[1] && p[1] <= keepBox.max[1] &&
  p[2] >= keepBox.min[2] && p[2] <= keepBox.max[2];

// 2, 3 and 4. Keep what is in the room, clipping whatever straddles the edge.
let droppedNodes = 0;
let clippedNodes = 0;
let droppedInstances = 0;
let keptInstances = 0;

const contains = (box) =>
  [0, 1, 2].every((k) => box.min[k] >= keepBox.min[k] && box.max[k] <= keepBox.max[k]);
const disjoint = (box) =>
  [0, 1, 2].some((k) => box.max[k] < keepBox.min[k] || box.min[k] > keepBox.max[k]);

for (const node of [...scene.listChildren()]) {
  const name = node.getName() || "(unnamed)";
  const matrix = node.getMatrix();
  const offsets = instanceOffsets(node);

  if (offsets) {
    const own = meshBounds(node, matrix);
    const centre = isEmpty(own)
      ? [0, 0, 0]
      : [0, 1, 2].map((k) => (own.min[k] + own.max[k]) / 2);
    const keep = [];
    for (let i = 0; i < offsets.length; i += 1) {
      const p = [centre[0] + offsets[i][0], centre[1] + offsets[i][1], centre[2] + offsets[i][2]];
      if (inKeep(p)) keep.push(i);
    }
    droppedInstances += offsets.length - keep.length;
    keptInstances += keep.length;
    if (keep.length === 0) {
      node.dispose();
      droppedNodes += 1;
      console.log(`  drop ${name} (all ${offsets.length} instances outside)`);
    } else if (keep.length < offsets.length) {
      keepInstances(node, keep);
      console.log(`  trim ${name}: ${keep.length}/${offsets.length} instances kept`);
    }
    continue;
  }

  const box = subtreeBounds(node);
  if (isEmpty(box)) continue;

  if (contains(box)) continue; // wholly in the room

  if (disjoint(box)) {
    node.dispose();
    droppedNodes += 1;
    console.log(`  drop ${name}`);
    continue;
  }

  // Straddles the boundary: cut it to the part that is in the room. This is
  // what saves the Oval's own doors and trim out of the building-wide meshes
  // they were exported in.
  const mesh = node.getMesh();
  if (!mesh) continue;
  let before = 0;
  let after = 0;
  for (const prim of [...mesh.listPrimitives()]) {
    const indices = prim.getIndices();
    const pos = prim.getAttribute("POSITION");
    before += indices ? indices.getCount() / 3 : pos ? pos.getCount() / 3 : 0;
    const kept = clipPrimitive(prim, matrix, inKeep);
    if (kept === 0) mesh.removePrimitive(prim);
    else after += kept;
  }
  if (mesh.listPrimitives().length === 0) {
    node.dispose();
    droppedNodes += 1;
    console.log(`  drop ${name} (nothing left after clipping)`);
  } else {
    clippedNodes += 1;
    console.log(`  clip ${name}: ${after}/${Math.round(before)} triangles kept`);
  }
}

// 4. Re-origin on the floor's centre, so a camera pose reads as a height.
const origin = [(room.min[0] + room.max[0]) / 2, room.min[1], (room.min[2] + room.max[2]) / 2];
console.log(`re-origin: subtracting (${origin.map((v) => v.toFixed(2)).join(", ")})`);

for (const node of scene.listChildren()) {
  const t = node.getTranslation();
  node.setTranslation([t[0] - origin[0], t[1] - origin[1], t[2] - origin[2]]);
}

await doc.transform(dedup(), prune());

const after = {
  nodes: root.listNodes().length,
  meshes: root.listMeshes().length,
  materials: root.listMaterials().length,
  textures: root.listTextures().length,
  bounds: getBounds(scene),
};

await io.write(output, doc);

const size = (b) => [0, 1, 2].map((k) => (b.max[k] - b.min[k]).toFixed(1)).join(" x ");
console.log("");
console.log(`nodes      ${before.nodes} -> ${after.nodes}   (dropped ${droppedNodes}, clipped ${clippedNodes})`);
console.log(`meshes     ${before.meshes} -> ${after.meshes}`);
console.log(`materials  ${before.materials} -> ${after.materials}`);
console.log(`textures   ${before.textures} -> ${after.textures}`);
console.log(`instances  kept ${keptInstances}, dropped ${droppedInstances}`);
console.log(`bounds     ${size(before.bounds)} m  ->  ${size(after.bounds)} m`);
console.log(
  `floor at y=${after.bounds.min[1].toFixed(2)}, ceiling at y=${after.bounds.max[1].toFixed(2)}`,
);
