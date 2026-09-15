/**
 * Generates godot/scripts/game/crises_table.gd from src/game/crises.ts.
 *
 * The crisis table is 1,900 lines of content and almost all of it is plain
 * data: titles, briefs, choices, effect maps, result text. Transcribing that
 * into GDScript by hand is a thousand chances to mistype a number that no
 * reviewer would catch, so it is generated instead — from the real module,
 * imported and walked, not from a copy.
 *
 *   node --experimental-strip-types scripts/export-crises.mjs
 *
 * Two fields are genuinely functions and are NOT emitted here:
 *
 *   `pressure`, on every crisis — the expression that decides how likely it
 *   is right now. All 34 live in CrisesData.pressure_for as a match on the
 *   crisis id, the same shape BlocsData uses for the bloc targets.
 *
 *   `brief`, on the eight residence crises — the ones that name your spouse
 *   or the child the crisis is actually about. Those live in
 *   CrisesData.brief_for.
 *
 * The generator asserts that those are the only two, so a new function field
 * added to the TypeScript fails the export rather than silently vanishing
 * from the Godot build.
 */
import { writeFile } from "node:fs/promises";
import { CRISES } from "../src/game/crises.ts";

/** Fields the generator knows are functions and deliberately does not emit. */
const HAND_PORTED = new Set(["pressure", "brief"]);

function gdString(value) {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")}"`;
}

function gdNumber(value) {
  if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
  // Everything the game reads back with float(); an integer literal would
  // still work, but writing them all as floats keeps the table uniform.
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function gdValue(value, path, indent) {
  const pad = "\t".repeat(indent);
  const inner = "\t".repeat(indent + 1);
  if (typeof value === "string") return gdString(value);
  if (typeof value === "number") return gdNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v, i) => `${inner}${gdValue(v, `${path}[${i}]`, indent + 1)},`);
    return `[\n${items.join("\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const rows = [];
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "function") {
        if (HAND_PORTED.has(k)) continue;
        throw new Error(
          `${path}.${k} is a function and is not hand-ported. Add it to ` +
            `CrisesData and to HAND_PORTED, or the Godot build loses it.`,
        );
      }
      if (v === undefined) continue;
      rows.push(`${inner}${gdString(k)}: ${gdValue(v, `${path}.${k}`, indent + 1)},`);
    }
    if (rows.length === 0) return "{}";
    return `{\n${rows.join("\n")}\n${pad}}`;
  }
  throw new Error(`${path}: cannot emit ${typeof value}`);
}

const seen = new Set();
for (const c of CRISES) {
  if (seen.has(c.id)) throw new Error(`duplicate crisis id: ${c.id}`);
  seen.add(c.id);
  if (typeof c.pressure !== "function") throw new Error(`${c.id} has no pressure function`);
}

const body = CRISES.map((c) => `\t${gdValue(c, `crisis(${c.id})`, 1)},`).join("\n");

const dynamicBriefs = CRISES.filter((c) => typeof c.brief === "function").map((c) => c.id);

const out = `class_name CrisesTable
extends RefCounted
## The crisis table, generated from src/game/crises.ts.
##
## DO NOT EDIT. Regenerate with:
##
##   node --experimental-strip-types scripts/export-crises.mjs
##
## ${CRISES.length} crises. Every field here is plain data. The two that are
## functions in the TypeScript live in CrisesData instead:
##
##   pressure  -- all ${CRISES.length}, in CrisesData.pressure_for
##   brief     -- ${dynamicBriefs.length} residence crises that name a member of your family,
##                in CrisesData.brief_for: ${dynamicBriefs.join(", ")}
##
## A crisis whose brief is static carries it here; the ones above have no
## "brief" key at all, which is how CrisesData knows to ask for one.

const CRISES := [
${body}
]
`;

await writeFile("godot/scripts/game/crises_table.gd", out);
console.log(
  `crises: wrote ${CRISES.length} crises to godot/scripts/game/crises_table.gd ` +
    `(${dynamicBriefs.length} briefs hand-ported)`,
);
