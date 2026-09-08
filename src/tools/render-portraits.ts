import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROSTER } from "../game/roster.ts";
import { pickLook } from "../world/character.ts";
import { buildPortraitSvg, slug } from "../ui/portrait.ts";

/**
 * Pre-renders one portrait per person in `ROSTER` — every named person the
 * game can show, cabinet-eligible or not — so each of them has their own
 * file instead of sharing a generic per-office placeholder. Same
 * `buildPortraitSvg` the live fallback in `portrait.ts` calls at runtime for
 * anyone outside the roster — this just runs it once per name, ahead of
 * time, and rasterises the result, so it ships as a real asset rather than
 * being recomputed every time a panel opens. Re-run this whenever `ROSTER`,
 * `pickLook`, or `buildPortraitSvg` change, so the checked-in files stay in
 * sync with what the game would generate live.
 */

const OUT_DIR = path.resolve(import.meta.dirname, "../../public/portraits/cast");

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  let written = 0;
  for (const person of ROSTER) {
    const look = pickLook({ seed: person.name });
    const svg = buildPortraitSvg(look);
    const file = path.join(OUT_DIR, `${slug(person.name)}.png`);
    await sharp(Buffer.from(svg)).resize(300, 330).png({ compressionLevel: 9 }).toFile(file);
    written += 1;
  }
  console.log(`Rendered ${written} cast portraits to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
