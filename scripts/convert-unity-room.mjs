/**
 * Turns a Unity room package into a game-ready .glb.
 *
 * This is a one-off tool, not part of `npm run assets`: it needs a browser and
 * a .unitypackage that is not in the repo. It is here because the knowledge in
 * it is worth keeping — a Unity asset pack is a scene, not a model, and half a
 * dozen specific things have to happen before it is one room you can load.
 *
 *   node scripts/convert-unity-room.mjs <pack.unitypackage> <out.glb>
 *
 * A .unitypackage is a gzipped tar of one folder per asset GUID, each holding
 * the file, its .meta, and a `pathname` saying where it belongs. Nothing in it
 * is addressed by name: the scene refers to prefabs by GUID, prefabs refer to
 * materials by GUID and materials refer to textures by GUID, so stage zero
 * rebuilds the name table before anything else can be read.
 *
 * Then, in order:
 *
 *   - The .unity scene is YAML. Each placed object is a PrefabInstance whose
 *     m_Modifications override the prefab root's position, rotation and scale,
 *     so the scene is read as a list of (prefab, position, yaw, scale).
 *   - Each .prefab names the materials on its renderers, and each .mat names
 *     its textures and its colour, metallic and smoothness.
 *   - Stage one runs in Chromium via Playwright, because three's FBXLoader is
 *     where the meshes are: it loads each prefab's FBX once, clones it per
 *     placement, buckets every submesh by material and merges. See
 *     scripts/unity/convert.html for what it does and why.
 *   - Stage two simplifies with meshoptimizer, hardest on the scenery.
 *   - Stage three resizes to 512, then webp and KHR_mesh_quantization, which
 *     is what three's GLTFLoader reads with no decoder.
 *
 * On the White House Briefing Room pack this took 149 placed prefabs and 56 MB
 * to one 4.1 MB room of 145,000 triangles.
 */
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplifyPrimitive, weld, prune, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

const [packPath, outPath] = process.argv.slice(2);
if (!packPath || !outPath) {
  console.error("usage: node scripts/convert-unity-room.mjs <pack.unitypackage> <out.glb>");
  process.exit(1);
}

// ------------------------------------------------------------------ stage 0

/** Reads a ustar archive into a map of path -> bytes. */
function untar(buf) {
  const files = new Map();
  for (let off = 0; off + 512 <= buf.length; ) {
    const name = buf.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    if (!name) {
      off += 512;
      continue;
    }
    const size = parseInt(buf.toString("utf8", off + 124, off + 136).replace(/\0.*$/, "").trim() || "0", 8);
    const type = buf.toString("utf8", off + 156, off + 157);
    const start = off + 512;
    if (type === "0" || type === "\0") files.set(name, buf.subarray(start, start + size));
    off = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * Unpacks the package into a directory tree, and returns the GUID name table.
 *
 * Everything in the package is stored under its GUID, so this is also the only
 * chance to learn that 5e495484…9642 is `chair wood.mat`. Nothing downstream
 * can resolve a reference without it.
 */
async function unpack(pack, dir) {
  const files = untar(gunzipSync(await readFile(pack)));
  const byGuid = new Map();
  for (const [entry, bytes] of files) {
    const [guid, kind] = entry.replace(/^\.\//, "").split("/");
    if (kind !== "pathname") continue;
    byGuid.set(guid, bytes.toString("utf8").split("\n")[0].trim());
  }

  // Only the three kinds of file the rest of this needs: the meshes, the
  // textures, and the YAML. A pack also carries scripts, shaders, terrain and
  // post-processing profiles, and none of it survives the conversion.
  const WANTED = /\.(fbx|png|jpg|jpeg|tga|mat|prefab|unity)$/i;
  const assets = new Map();
  for (const [guid, name] of byGuid) {
    const bytes = files.get(`${guid}/asset`) ?? files.get(`./${guid}/asset`);
    if (!bytes || !WANTED.test(name)) continue;
    assets.set(name, bytes);
    const file = path.join(dir, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  console.log(`  ${byGuid.size} assets, ${assets.size} kept`);
  return { byGuid, assets };
}

/** The value of a Unity YAML scalar, as a number. */
const num = (s, key) => Number(new RegExp(`${key}:\\s*([-\\d.eE+]+)`).exec(s)?.[1] ?? 0);

/**
 * Reads the placed prefabs out of the scene.
 *
 * A PrefabInstance's m_Modifications is a flat list of {target, propertyPath,
 * value} in no particular order, so it is read into a table by property name
 * rather than by position. The rotation is a quaternion and every rotation in
 * a room pack is about Y, so it comes back as one yaw in degrees.
 */
function readScene(unity, byGuid) {
  const out = [];
  for (const block of unity.split("--- !u!1001 ").slice(1)) {
    // m_SourcePrefab, not whichever guid appears first: a PrefabInstance's
    // modifications target the transform inside the prefab, which is a node of
    // the .fbx, so most blocks name the model's guid several times before they
    // name the prefab's. Either resolves to the same basename, and this one is
    // the block's actual subject.
    const guid = /m_SourcePrefab: \{fileID: \d+, guid: ([0-9a-f]{32})/.exec(block)?.[1];
    const source = guid && byGuid.get(guid);
    if (!source) continue;
    const prefab = path.basename(source).replace(/\.(prefab|fbx)$/i, "");
    const mods = Object.fromEntries(
      [...block.matchAll(/propertyPath: ([\w.]+)\s*\n\s*value: ([-\d.eE+]*)/g)].map((m) => [m[1], m[2]]),
    );
    const at = (k, fallback = 0) => (mods[k] === undefined || mods[k] === "" ? fallback : Number(mods[k]));
    const qy = at("m_LocalRotation.y");
    const qw = at("m_LocalRotation.w", 1);
    out.push({
      prefab,
      pos: [at("m_LocalPosition.x"), at("m_LocalPosition.y"), at("m_LocalPosition.z")],
      yaw: (2 * Math.atan2(qy, qw) * 180) / Math.PI,
      scale: [at("m_LocalScale.x", 1), at("m_LocalScale.y", 1), at("m_LocalScale.z", 1)],
    });
  }
  return out;
}

/** Reads a .mat into the handful of fields a glTF material has room for. */
function readMaterial(text, byGuid) {
  const tex = (slot) => {
    const at = text.indexOf(`- ${slot}:`);
    if (at < 0) return null;
    const guid = /m_Texture: \{fileID: \d+, guid: ([0-9a-f]{32})/.exec(text.slice(at, at + 400))?.[1];
    return guid ? path.basename(byGuid.get(guid) ?? "") : null;
  };
  const colour = /- _Color:\s*\{r: ([-\d.eE+]+), g: ([-\d.eE+]+), b: ([-\d.eE+]+), a: ([-\d.eE+]+)/.exec(text);
  return {
    color: colour ? colour.slice(1, 5).map(Number) : [1, 1, 1, 1],
    map: tex("_MainTex"),
    normal: tex("_BumpMap"),
    metallic: num(text, "- _Metallic"),
    smoothness: num(text, "- _Glossiness"),
  };
}

/** Which materials each prefab's renderers carry, as a set per renderer. */
function readPrefab(text, byGuid) {
  const renderers = [];
  for (const block of text.split(/\n\s*m_Materials:\n/).slice(1)) {
    const list = [];
    for (const line of block.split("\n")) {
      const guid = /guid: ([0-9a-f]{32})/.exec(line);
      if (!guid) break;
      list.push(path.basename(byGuid.get(guid[1]) ?? guid[1], ".mat"));
    }
    if (list.length) renderers.push(list);
  }
  return renderers;
}

async function stageZero(dir) {
  const { byGuid, assets } = await unpack(packPath, dir);
  const text = (name) => assets.get(name)?.toString("utf8") ?? "";

  const sceneName = [...assets.keys()].find((n) => n.endsWith(".unity"));
  if (!sceneName) throw new Error("no .unity scene in the package");
  const scene = readScene(text(sceneName), byGuid);

  const materials = {};
  for (const name of assets.keys()) {
    if (name.endsWith(".mat")) materials[path.basename(name, ".mat")] = readMaterial(text(name), byGuid);
  }
  const prefabMats = {};
  for (const name of assets.keys()) {
    if (name.endsWith(".prefab")) prefabMats[path.basename(name, ".prefab")] = readPrefab(text(name), byGuid);
  }

  await writeFile(path.join(dir, "scene.json"), JSON.stringify(scene));
  await writeFile(path.join(dir, "materials.json"), JSON.stringify(materials));
  await writeFile(path.join(dir, "prefab-materials.json"), JSON.stringify(prefabMats));
  console.log(
    `  ${path.basename(sceneName)}: ${scene.length} placements, ` +
      `${Object.keys(materials).length} materials, ${Object.keys(prefabMats).length} prefabs`,
  );
  return dir;
}

// ------------------------------------------------------------------ stage 1

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".fbx": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * Finds the pack's Models and Textures folders wherever it put them.
 *
 * The converter page asks for /Models/Podium.fbx and /Textures/emblem.png; a
 * pack puts them under Assets/<whatever the author called the pack>/, and the
 * name is not something this tool should have to be told.
 */
async function findFolders(dir) {
  // There is usually more than one of each. This pack ships Unity's
  // post-processing stack inside it, which brings a PostProcessing/Textures
  // and two more Models folders, and taking the first match found the room's
  // fifty textures in none of them. The pair that matters are siblings, and
  // the room's Models folder is the one with the most meshes in it.
  const pairs = [];
  const walk = async (at) => {
    const entries = await readdir(at, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (dirs.includes("Models") && dirs.includes("Textures")) {
      const models = path.join(at, "Models");
      const meshes = (await readdir(models)).filter((n) => /\.fbx$/i.test(n)).length;
      pairs.push({ Models: models, Textures: path.join(at, "Textures"), meshes });
    }
    for (const name of dirs) await walk(path.join(at, name));
  };
  await walk(dir);
  const best = pairs.sort((a, b) => b.meshes - a.meshes)[0];
  if (!best) throw new Error("package has no sibling Models/ and Textures/ folders");
  return best;
}

/** Serves the unpacked pack, three, and the converter page from one origin. */
function serve(dir, folders, port) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const under = (base, prefix) => path.join(base, url.slice(prefix.length));
    const file = url.startsWith("/three/")
      ? path.join(root, "node_modules/three", url.slice("/three/".length))
      : url === "/convert.html"
        ? path.join(root, "scripts/unity/convert.html")
        : url.startsWith("/Models/")
          ? under(folders.Models, "/Models/")
          : url.startsWith("/Textures/")
            ? under(folders.Textures, "/Textures/")
            : path.join(dir, url.replace(/^\//, ""));
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    createReadStream(file)
      .on("error", () => res.writeHead(404).end())
      .pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

/**
 * Playwright is not a dependency of this project — it is a tool you reach for
 * on the day you convert a model, not something a build needs.
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
      "  PLAYWRIGHT_MODULE=/usr/lib/node_modules/playwright/index.mjs node scripts/convert-unity-room.mjs …",
  );
  process.exit(1);
}

async function stageOne(dir, rawGlb) {
  const chromium = await chromiumOrExplain();
  const port = 5312;
  const server = await serve(dir, await findFolders(dir), port);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const missing = new Set();
    page.on("pageerror", (e) => console.error("  page error:", e.message.slice(0, 300)));
    page.on("response", (r) => {
      if (r.status() === 404) missing.add(decodeURIComponent(r.url().split("/").pop()));
    });
    await page.goto(`http://127.0.0.1:${port}/convert.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 900_000 });
    for (const line of await page.evaluate(() => window.__log)) console.log(`  ${line}`);
    if (missing.size) console.log(`  missing from the pack: ${[...missing].join(", ")}`);
    const b64 = await page.evaluate(() => window.__glb());
    await writeFile(rawGlb, Buffer.from(b64, "base64"));
  } finally {
    await browser.close();
    server.close();
  }
}

// ------------------------------------------------------------------ stage 2

/**
 * How hard to simplify, by material.
 *
 * The triangles are all in the furniture and the scenery, not in the room: the
 * briefing room's architecture is flat panels that simplify to nothing useful,
 * while its 54 chairs and the tree outside the window are two thirds of the
 * model between them.
 */
const BUDGET = [
  [/^Leaf$/i, { ratio: 0.25, error: 0.02 }],
  [/wood|metal|fabric/i, { ratio: 0.5, error: 0.004 }],
];
const DEFAULT = { ratio: 0.85, error: 0.002 };

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
      const t0 = (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3;
      before += t0;
      const budget = BUDGET.find(([re]) => re.test(name))?.[1] ?? DEFAULT;
      simplifyPrimitive(prim, { ...budget, simplifier: MeshoptSimplifier, lockBorder: false });
      const t1 = (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3;
      after += t1;
      if (t0 > 4000) console.log(`  ${name}: ${Math.round(t0)} -> ${Math.round(t1)} tris`);
    }
  }
  await doc.transform(prune());
  await io.write(simplified, doc);
  console.log(`  ${Math.round(before)} -> ${Math.round(after)} triangles`);
}

// --------------------------------------------------------------------- main

const work = await mkdtemp(path.join(tmpdir(), "unity-room-"));
try {
  const unpacked = path.join(work, "pack");
  const rawGlb = path.join(work, "raw.glb");
  const simplified = path.join(work, "simplified.glb");
  const resized = path.join(work, "resized.glb");
  const webp = path.join(work, "webp.glb");

  console.log("stage 0: unpack");
  await stageZero(unpacked);

  console.log("stage 1: Unity scene -> glTF");
  await stageOne(unpacked, rawGlb);

  console.log("stage 2: simplify");
  await stageTwo(rawGlb, simplified);

  // A room pack's textures are 1024 or 2048 and about ten of them are a single
  // flat colour stored at full size. 512 is the difference between a 10 MB
  // room and a 4 MB one, and on a phone held at arm's length nothing in this
  // room is close enough to tell.
  console.log("stage 3: compress");
  const cli = path.join(root, "node_modules/.bin/gltf-transform");
  await run(cli, ["resize", simplified, resized, "--width", "512", "--height", "512"]);
  await run(cli, ["webp", resized, webp, "--quality", "80"]);
  await run(cli, ["quantize", webp, outPath]);

  const size = (await stat(outPath)).size;
  console.log(`\n${outPath}  ${(size / 1048576).toFixed(2)} MB`);
} finally {
  await rm(work, { recursive: true, force: true });
}
