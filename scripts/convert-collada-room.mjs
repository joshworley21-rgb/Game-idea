/**
 * Turns a SketchUp COLLADA room into a game-ready .glb.
 *
 * This is a one-off tool, not part of `npm run assets`: it needs a browser and
 * a .dae that is not in the repo. It is here because the knowledge in it is
 * worth keeping — a SketchUp export needs half a dozen specific things done to
 * it before it is a game asset, and none of them are obvious from the result.
 *
 *   node scripts/convert-collada-room.mjs <model.dae> <out.glb>
 *
 * The .dae's textures must sit beside it exactly as its <init_from> paths say
 * (SketchUp writes "model/Foo.jpg", so a `model/` folder next to the file).
 *
 * Stage one runs in Chromium via Playwright, because three's ColladaLoader
 * parses XML with DOMParser: it loads the scene, throws away what should not
 * ship, merges by material, and exports a plain .glb. See scripts/collada/
 * convert.html for what it does and why.
 *
 * Stage two is plain Node: per-material simplification with meshoptimizer,
 * because one global budget either mangles the chandeliers or leaves the chair
 * casters untouched. The casters are the interesting case — 150 ball-and-fork
 * assemblies about four centimetres across that between them were 180,000 of
 * the room's 350,000 triangles, and that meshopt will not simplify at all,
 * since each ball is its own closed shell with no edge to collapse that does
 * not delete a whole caster. They are rebuilt as low-poly proxies instead.
 *
 * Then webp textures and KHR_mesh_quantization, matching the Oval's pipeline
 * and what three's GLTFLoader reads without a decoder.
 *
 * On the Situation Room this took 617,452 triangles and 62 MB to 135,000 and
 * 1.6 MB.
 */
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NodeIO, Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplifyPrimitive, weld, prune, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

const [daePath, outPath] = process.argv.slice(2);
if (!daePath || !outPath) {
  console.error("usage: node scripts/convert-collada-room.mjs <model.dae> <out.glb>");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".dae": "model/vnd.collada+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * Serves the .dae, its textures, three, and the converter page from one origin.
 * A file:// page cannot fetch its own siblings, and the loader resolves texture
 * paths relative to the model, so both have to come off the same server.
 */
function serve(daeDir, port) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = url.startsWith("/three/")
      ? path.join(root, "node_modules/three", url.slice("/three/".length))
      : url === "/convert.html"
        ? path.join(root, "scripts/collada/convert.html")
        : url === "/model.dae"
          ? daePath
          : path.join(daeDir, url.replace(/^\//, ""));
    if (!path.resolve(file).startsWith(path.resolve(root)) && !path.resolve(file).startsWith(path.resolve(daeDir))) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    createReadStream(file)
      .on("error", () => res.writeHead(404).end())
      .pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

/**
 * Playwright is not a dependency of this project — it is a tool you reach for
 * on the day you convert a model, not something a build needs. So it is
 * imported by name and, failing that, from a global install, with a message
 * that says what to do rather than a bare ERR_MODULE_NOT_FOUND.
 */
async function chromiumOrExplain() {
  for (const specifier of ["playwright", "playwright-core"]) {
    try {
      return (await import(specifier)).chromium;
    } catch {
      /* try the next one */
    }
  }
  const global = process.env.PLAYWRIGHT_MODULE;
  if (global) return (await import(global)).chromium;
  console.error(
    "This tool needs Playwright, which the project does not depend on.\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "or point PLAYWRIGHT_MODULE at an existing install:\n" +
      "  PLAYWRIGHT_MODULE=/usr/lib/node_modules/playwright/index.mjs node scripts/convert-collada-room.mjs …",
  );
  process.exit(1);
}

async function stageOne(daeDir, rawGlb) {
  const chromium = await chromiumOrExplain();
  const port = 5311;
  const server = await serve(daeDir, port);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("  page error:", e.message.slice(0, 300)));
    await page.goto(`http://127.0.0.1:${port}/convert.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 600_000 });
    for (const line of await page.evaluate(() => window.__log)) console.log(`  ${line}`);
    const b64 = await page.evaluate(() => window.__glb());
    await writeFile(rawGlb, Buffer.from(b64, "base64"));
  } finally {
    await browser.close();
    server.close();
  }
}

/** Per-material simplification budgets, by material name. */
const BUDGET = [
  // The chandeliers: delicate, always in frame, and the first thing a single
  // global pass destroyed.
  [/^material_15$/, { ratio: 0.18, error: 0.002 }],
];
const DEFAULT = { ratio: 0.3, error: 0.006 };
/** Materials whose geometry is rebuilt as proxies rather than simplified. */
const PROXY_BALLS = /^wheel$|^__0136_Charcoal_1$/;
/** Cluster radius for the proxy rebuild: casters are ~0.04 across, ~0.3 apart. */
const CLUSTER = 0.12;

function clusters(positions) {
  const key = (x, y, z) =>
    `${Math.round(x / CLUSTER)},${Math.round(y / CLUSTER)},${Math.round(z / CLUSTER)}`;
  const groups = new Map();
  for (let i = 0; i < positions.length; i += 3) {
    const k = key(positions[i], positions[i + 1], positions[i + 2]);
    const g = groups.get(k) ?? { n: 0, s: [0, 0, 0], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
    g.n++;
    for (let a = 0; a < 3; a++) {
      g.s[a] += positions[i + a];
      g.min[a] = Math.min(g.min[a], positions[i + a]);
      g.max[a] = Math.max(g.max[a], positions[i + a]);
    }
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => ({
    c: g.s.map((v) => v / g.n),
    r: Math.max(0.012, Math.max(...[0, 1, 2].map((a) => g.max[a] - g.min[a])) / 2),
  }));
}

/** A low-poly UV sphere appended to `out`. */
function ball(c, r, out, seg = 6, rings = 4) {
  const base = out.pos.length / 3;
  for (let y = 0; y <= rings; y++) {
    const phi = (y / rings) * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const theta = (x / seg) * Math.PI * 2;
      out.pos.push(
        c[0] + r * Math.sin(phi) * Math.cos(theta),
        c[1] + r * Math.cos(phi),
        c[2] + r * Math.sin(phi) * Math.sin(theta),
      );
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < seg; x++) {
      const a = base + y * (seg + 1) + x;
      const b = a + seg + 1;
      out.idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
}

async function stageTwo(rawGlb, simplified) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(rawGlb);
  await doc.transform(weld(), dedup());

  let before = 0;
  let after = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? mesh.getName() ?? "?";
      const pos = prim.getAttribute("POSITION");
      const t0 = (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
      before += t0;

      if (PROXY_BALLS.test(name)) {
        const found = clusters(pos.getArray());
        const geo = { pos: [], idx: [] };
        for (const b of found) ball(b.c, b.r, geo);
        // The caster materials carry a texture, so the proxies need a UV set
        // even though nothing samples it meaningfully: a primitive whose
        // attributes do not match its material fails compression later with a
        // bare "Assertion failed" and no hint as to which primitive is at fault.
        const uv = new Float32Array((geo.pos.length / 3) * 2);
        for (const s of prim.listSemantics()) prim.setAttribute(s, null);
        prim
          .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(geo.pos)))
          .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv))
          .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(geo.idx)))
          .setMode(Primitive.Mode.TRIANGLES);
        after += geo.idx.length / 3;
        console.log(`  ${name}: ${Math.round(t0)} -> ${geo.idx.length / 3} tris (${found.length} proxies)`);
        continue;
      }

      const budget = BUDGET.find(([re]) => re.test(name))?.[1] ?? DEFAULT;
      simplifyPrimitive(prim, { ...budget, simplifier: MeshoptSimplifier, lockBorder: false });
      after += (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3;
    }
  }
  await doc.transform(prune());
  await io.write(simplified, doc);
  console.log(`  ${Math.round(before)} -> ${Math.round(after)} triangles`);
}

const work = await mkdtemp(path.join(tmpdir(), "collada-room-"));
try {
  const rawGlb = path.join(work, "raw.glb");
  const simplified = path.join(work, "simplified.glb");
  const webp = path.join(work, "webp.glb");

  console.log("stage 1: COLLADA -> glTF");
  await stageOne(path.dirname(path.resolve(daePath)), rawGlb);

  console.log("stage 2: simplify");
  await stageTwo(rawGlb, simplified);

  console.log("stage 3: compress");
  const cli = path.join(root, "node_modules/.bin/gltf-transform");
  await run(cli, ["webp", simplified, webp, "--quality", "82"]);
  await run(cli, ["quantize", webp, outPath]);

  const size = (await stat(outPath)).size;
  console.log(`\n${outPath}  ${(size / 1048576).toFixed(2)} MB`);
} finally {
  await rm(work, { recursive: true, force: true });
}
