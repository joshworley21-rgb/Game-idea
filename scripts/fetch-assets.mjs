/**
 * Builds the room's 3D props.
 *
 * Downloads models from Poly Haven (everything there is CC0) into assets-src/,
 * then optimises each one into a single .glb in public/models/ that the game
 * loads at runtime. Only the optimised .glb files are committed; assets-src/
 * is a cache you can delete freely.
 *
 * Also pulls the full Oval Office model from its GitHub Release asset into
 * public/models/ so it ships inside the APK instead of being fetched over the
 * network at runtime. That keeps the app standalone and offline-capable.
 *
 * Add an entry to MODELS and re-run `npm run assets` to pull another prop.
 */
import { mkdir, writeFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);

/**
 * `texture` is the max texture edge in pixels and `error` the simplification
 * budget: leafy, high-poly organics tolerate far more than furniture whose
 * silhouette you read at a glance.
 */
const MODELS = [
  { id: "Sofa_01" },
  { id: "ArmChair_01" },
  { id: "CoffeeTable_01" },
  { id: "ClassicConsole_01" },
  { id: "Shelf_01" },
  { id: "WoodenTable_02" },
  { id: "fancy_picture_frame_01" },
  { id: "vintage_grandfather_clock_01" },
  { id: "Chandelier_01", error: 0.008 },
  { id: "book_encyclopedia_set_01", error: 0.01 },
  { id: "potted_plant_01", texture: 256, error: 0.02 },
];

/**
 * The full Oval Office model, hosted as a GitHub Release asset. Fetched once
 * into public/models/ so Vite bundles it into dist/ and Capacitor packs it
 * into the APK — the game then loads it from the app package, no network.
 *
 * `minBytes` guards against a truncated or placeholder file being treated as
 * a valid download. The real model is tens of MB; anything under a megabyte
 * is a failed fetch, not a small asset.
 */
const OVAL_OFFICE = {
  url: "https://github.com/joshworley21-rgb/Game-idea/releases/download/v0.1-assets/OvalOffice.glb",
  file: "OvalOffice.glb",
  minBytes: 1_000_000,
};

const RESOLUTION = "1k";
const SRC = "assets-src";
const OUT = "public/models";
const API = "https://api.polyhaven.com";

/**
 * Set FORCE_ASSETS=1 to re-download everything, ignoring the on-disk cache.
 * Needed whenever a release asset is replaced in place: the cache guard below
 * would otherwise keep serving the copy committed to the repo.
 */
const FORCE = process.env.FORCE_ASSETS === "1";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function download(url, dest, { minBytes = 0 } = {}) {
  if (!FORCE && existsSync(dest)) {
    const { size } = await stat(dest);
    if (size >= minBytes) return 0;
    console.log(`  cached copy is ${(size / 1e6).toFixed(2)} MB, below the ${(minBytes / 1e6).toFixed(1)} MB floor — refetching`);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) {
    throw new Error(`downloaded ${buf.length} bytes, expected at least ${minBytes}`);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

await mkdir(OUT, { recursive: true });

// The Oval Office first: it is the one asset the game cannot run without.
{
  const dest = path.join(OUT, OVAL_OFFICE.file);
  process.stdout.write(`${OVAL_OFFICE.file.padEnd(30)}`);
  try {
    const bytes = await download(OVAL_OFFICE.url, dest, {
      minBytes: OVAL_OFFICE.minBytes,
    });
    if (bytes === 0) {
      const { size } = await stat(dest);
      console.log(`cached (${(size / 1e6).toFixed(2)} MB)`);
    } else {
      console.log(`downloaded ${(bytes / 1e6).toFixed(2)} MB`);
    }
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    console.log("  The game will fall back to the procedural Oval Office room.");
    process.exitCode = 1;
  }
}

const credits = [];
let rawTotal = 0;
let outTotal = 0;

for (const { id, texture = 512, error = 0.005 } of MODELS) {
  process.stdout.write(`${id.padEnd(30)}`);
  try {
    const files = await getJson(`${API}/files/${id}`);
    const set = files.gltf?.[RESOLUTION]?.gltf;
    if (!set) {
      console.log("no gltf at this resolution — skipped");
      continue;
    }

    const dir = path.join(SRC, id);
    let raw = await download(set.url, path.join(dir, `${id}.gltf`));
    for (const [rel, info] of Object.entries(set.include ?? {})) {
      raw += await download(info.url, path.join(dir, rel));
    }
    rawTotal += raw;

    const out = path.join(OUT, `${id}.glb`);
    await run("npx", [
      "gltf-transform", "optimize",
      path.join(dir, `${id}.gltf`), out,
      "--compress", "quantize",        // three.js reads KHR_mesh_quantization natively, so no decoder ships with the game
      "--texture-compress", "webp",
      "--texture-size", String(texture),
      "--simplify", "true",
      "--simplify-error", String(error),
    ]);

    const { size } = await stat(out);
    outTotal += size;

    const info = await getJson(`${API}/info/${id}`);
    credits.push({ id, name: info.name ?? id, authors: Object.keys(info.authors ?? {}) });
    console.log(`${(raw / 1e6).toFixed(2)} MB → ${(size / 1e3).toFixed(0)} KB`);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }
}

// Poly Haven is CC0 and requires no attribution; crediting is simply correct.
await writeFile(
  path.join(OUT, "CREDITS.md"),
  [
    "# Model credits",
    "",
    "Every model here comes from [Poly Haven](https://polyhaven.com), released under",
    "[CC0](https://creativecommons.org/publicdomain/zero/1.0/): free for any use, no",
    "attribution required. Credited anyway, because the people who made them deserve it.",
    "",
    "`OvalOffice.glb` is the full Oval Office model, pulled from the project's GitHub",
    "Release assets by `npm run assets`.",
    "",
    "Rebuild or extend the set with `npm run assets`.",
    "",
    "| Model | Author(s) |",
    "| --- | --- |",
    ...credits.map((c) => `| [${c.name}](https://polyhaven.com/a/${c.id}) | ${c.authors.join(", ")} |`),
    "",
  ].join("\n"),
);

console.log(
  `\n${credits.length} models: ${(rawTotal / 1e6).toFixed(1)} MB downloaded → ${(outTotal / 1e6).toFixed(2)} MB shipped`,
);
