/**
 * Keeps Godot out of the folders npm owns.
 *
 * Godot scans every directory under the project root and imports what it
 * finds. The project root is this repository, so without help it walks
 * node_modules (179 packages) and dist (a complete second copy of every model,
 * which it imports again, writing .import files into a build directory).
 *
 * The mechanism for excluding a folder is an empty `.gdignore` inside it, and
 * the folders that need one are exactly the two git cannot carry: both are
 * gitignored, so a committed `.gdignore` is impossible, and `npm install` and
 * `vite build` recreate them from nothing anyway.
 *
 * So this runs as `postinstall` and `postbuild` — the two moments those
 * folders come into existence — and puts the marker back. The folders that
 * are committed (src, scripts, android, docs, releases, Unreal) carry their
 * own `.gdignore` in the repo and are not this script's business.
 */
import { writeFile, stat } from "node:fs/promises";
import path from "node:path";

/** Directories npm or vite create, which Godot must not scan. */
const GENERATED = ["node_modules", "dist"];

for (const dir of GENERATED) {
  const exists = await stat(dir).catch(() => null);
  if (!exists?.isDirectory()) continue;
  const marker = path.join(dir, ".gdignore");
  if (await stat(marker).catch(() => null)) continue;
  await writeFile(marker, "");
  console.log(`godot: ignoring ${dir}/`);
}
