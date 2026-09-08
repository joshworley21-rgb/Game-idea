import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NAME_POOL } from "../game/cabinet.ts";
import { pickLook } from "../world/character.ts";
import { buildPortraitSvg, slug } from "../ui/portrait.ts";

/**
 * Pre-renders one portrait per name in the cabinet pool, so every one of
 * the 100 possible secretaries has their own file instead of sharing a
 * generic per-office placeholder. Same `buildPortraitSvg` the live fallback
 * in `portrait.ts` calls at runtime for anyone outside the pool — this just
 * runs it once per name, ahead of time, and rasterises the result, so it
 * ships as a real asset rather than being recomputed every time the panel
 * opens. Re-run this whenever `NAME_POOL`, `pickLook`, or `buildPortraitSvg`
 * change, so the checked-in files stay in sync with what the game would
 * generate live.
 */

const OUT_DIR = path.resolve(import.meta.dirname, "../../public/portraits/cast");

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  let written = 0;
  for (const name of NAME_POOL) {
    const look = pickLook({ seed: name });
    const svg = buildPortraitSvg(look);
    const file = path.join(OUT_DIR, `${slug(name)}.png`);
    await sharp(Buffer.from(svg)).resize(300, 330).png({ compressionLevel: 9 }).toFile(file);
    written += 1;
  }
  console.log(`Rendered ${written} cast portraits to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
