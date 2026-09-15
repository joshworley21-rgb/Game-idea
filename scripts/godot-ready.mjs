/**
 * Makes a .glb importable by Godot 4.
 *
 * The models in this repo were optimised for three.js, which reads things
 * Godot's glTF importer refuses. Two of them, specifically, and both fail as a
 * whole file rather than degrading:
 *
 *   KHR_mesh_quantization — three's GLTFLoader reads quantized meshes with no
 *     decoder, so the conversion pipeline emits them and the Oval is 12 MB
 *     instead of 17. Godot 4.3 stops dead: "required extension
 *     'KHR_mesh_quantization' is not supported". Dequantizing costs about 20%
 *     file size and is the only option short of a GLTFDocumentExtension.
 *
 *   Empty primitives — a primitive with no vertices is legal glTF and three
 *     draws nothing for it. Godot fails the import with
 *     "Condition \"vertex_num <= 0\" is true", and takes the other 45
 *     primitives in the file down with it. The Situation Room has two, left
 *     behind by simplification.
 *
 * Both are safe for the web build too: three reads dequantized meshes fine and
 * never drew the empty primitives, so this is a one-way fix applied in place
 * rather than a second set of assets to keep in step.
 *
 *   node scripts/godot-ready.mjs <file.glb|directory> [...]
 *
 * Files that need nothing are left alone, byte for byte, so running this over
 * public/models does not churn twenty-six binaries in the diff. `npm run
 * assets` calls it on OvalOffice.glb, which is the one model not committed
 * here — it is fetched from a GitHub release, which is exactly how it got
 * missed when the others were fixed by hand.
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, prune } from "@gltf-transform/functions";

const QUANTIZATION = "KHR_mesh_quantization";

/** Every .glb under the given files and directories. */
async function collect(targets) {
  const out = [];
  for (const target of targets) {
    const info = await stat(target).catch(() => null);
    if (!info) {
      console.error(`  ! no such path: ${target}`);
      continue;
    }
    if (info.isDirectory()) {
      for (const name of (await readdir(target)).sort()) {
        if (name.toLowerCase().endsWith(".glb")) out.push(path.join(target, name));
      }
    } else {
      out.push(target);
    }
  }
  return out;
}

/**
 * Fixes one file, or reports that it did not need fixing.
 *
 * Returns what changed so the caller can say so, and writes nothing at all
 * when there was nothing to do.
 */
export async function godotReady(file, io = new NodeIO().registerExtensions(ALL_EXTENSIONS)) {
  const doc = await io.read(file);
  const root = doc.getRoot();

  const quantized = root.listExtensionsUsed().some((e) => e.extensionName === QUANTIZATION);

  // Drop primitives with no vertices, and any mesh left with none at all.
  let emptied = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      if (position && position.getCount() > 0) continue;
      mesh.removePrimitive(prim);
      prim.dispose();
      emptied += 1;
    }
    if (mesh.listPrimitives().length === 0) mesh.dispose();
  }

  if (!quantized && emptied === 0) return { file, changed: false };

  if (quantized) await doc.transform(dequantize());
  await doc.transform(prune());
  await writeFile(file, await io.writeBinary(doc));

  return { file, changed: true, dequantized: quantized, emptied };
}

// Only when run directly. fetch-assets.mjs imports godotReady to fix the one
// model it downloads, and a bare import must not run a CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("usage: node scripts/godot-ready.mjs <file.glb|directory> [...]");
    process.exit(1);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let fixed = 0;
  for (const file of await collect(targets)) {
    const before = (await stat(file)).size;
    const result = await godotReady(file, io);
    if (!result.changed) continue;
    fixed += 1;
    const after = (await stat(file)).size;
    const why = [
      result.dequantized ? "dequantized" : null,
      result.emptied ? `${result.emptied} empty primitive${result.emptied === 1 ? "" : "s"} removed` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `  ${path.basename(file).padEnd(30)} ${why}  ` +
        `(${(before / 1048576).toFixed(2)} -> ${(after / 1048576).toFixed(2)} MB)`,
    );
  }
  console.log(fixed === 0 ? "  every model already imports in Godot" : `  ${fixed} model(s) fixed`);
}
