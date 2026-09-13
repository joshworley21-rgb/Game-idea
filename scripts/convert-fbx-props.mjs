/**
 * Turns a folder of 3ds Max FBX props into game-ready .glb files.
 *
 * Like scripts/convert-collada-room.mjs this is a one-off tool rather than part
 * of `npm run assets`: it needs a browser and source art that is not in the
 * repo. It is here because the knowledge in it is worth keeping — see
 * scripts/fbx/convert.html for what a 3ds Max export needs doing to it and why.
 *
 *   node scripts/convert-fbx-props.mjs <src-dir> <out-dir>
 *
 * `src-dir` holds Models/*.fbx and Textures/*.png as the pack ships them. The
 * FBX materials name their textures, so a texture only binds if it is present
 * under exactly the name the FBX asks for; anything missing falls back to the
 * material's flat colour rather than failing the conversion.
 *
 * Each part comes out centred in x/z with its base at y = 0, in metres, so the
 * placements in src/world/props.ts read as positions in the room rather than as
 * corrections for wherever the modeller left the origin.
 */
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { readdir, writeFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error("usage: node scripts/convert-fbx-props.mjs <src-dir> <out-dir>");
  process.exit(1);
}

/**
 * Texture budget per part, by name. Small wall fittings do not need 1024px and
 * the backdrop pieces do: the column carries the only texture anyone looks at
 * from across the room.
 */
const TEXTURE_CAP = {
  Column: 1024, Floor: 1024,
  Camera: 512, Ceiling: 512, Door_1: 512, Door_2: 512, Emblem: 512, Laptop: 512, Monitor: 512,
};
const DEFAULT_CAP = 256;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".fbx": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg" };

function serve(src, port) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = url.startsWith("/three/")
      ? path.join(root, "node_modules/three", url.slice("/three/".length))
      : url === "/convert.html"
        ? path.join(root, "scripts/fbx/convert.html")
        : path.join(src, url.replace(/^\//, ""));
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    createReadStream(file).on("error", () => res.writeHead(404).end()).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

/** See scripts/convert-collada-room.mjs for why Playwright is not a dependency. */
async function chromiumOrExplain() {
  for (const specifier of ["playwright", "playwright-core"]) {
    try {
      return (await import(specifier)).chromium;
    } catch {
      /* try the next one */
    }
  }
  if (process.env.PLAYWRIGHT_MODULE) return (await import(process.env.PLAYWRIGHT_MODULE)).chromium;
  console.error(
    "This tool needs Playwright, which the project does not depend on.\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "or set PLAYWRIGHT_MODULE to an existing install.",
  );
  process.exit(1);
}

const work = await mkdtemp(path.join(tmpdir(), "fbx-props-"));
try {
  await mkdir(outDir, { recursive: true });
  const names = (await readdir(path.join(srcDir, "Models")))
    .filter((f) => f.toLowerCase().endsWith(".fbx"))
    .map((f) => f.replace(/\.fbx$/i, ""))
    .sort();
  console.log(`${names.length} parts in ${srcDir}`);

  const chromium = await chromiumOrExplain();
  const server = await serve(path.resolve(srcDir), 5312);
  const browser = await chromium.launch();
  const cli = path.join(root, "node_modules/.bin/gltf-transform");
  let total = 0;

  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("  page error:", e.message.slice(0, 300)));
    await page.goto("http://127.0.0.1:5312/convert.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });

    for (const name of names) {
      const cap = TEXTURE_CAP[name] ?? DEFAULT_CAP;
      const result = await page.evaluate(([n, c]) => window.__convert(n, c), [name, cap]);
      const raw = path.join(work, `${name}.glb`);
      const webp = path.join(work, `${name}.webp.glb`);
      const out = path.join(outDir, `${name}.glb`);
      await writeFile(raw, Buffer.from(result.glb, "base64"));
      await run(cli, ["webp", raw, webp, "--quality", "84"]);
      await run(cli, ["quantize", webp, out]);
      const size = (await stat(out)).size;
      total += size;
      console.log(`  ${name.padEnd(16)} ${(size / 1024).toFixed(0).padStart(5)} KB   ${result.log.at(-1)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${(total / 1048576).toFixed(2)} MB total`);
} finally {
  await rm(work, { recursive: true, force: true });
}
