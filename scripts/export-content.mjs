/**
 * Generates the Godot content tables from the TypeScript the game runs on.
 *
 *   npm run godot:content
 *
 * Between them the crisis and arc tables are 2,500 lines of content, and
 * almost all of it is plain data: titles, briefs, choices, effect maps,
 * result text. Transcribing that into GDScript by hand is a thousand chances
 * to mistype a number that no reviewer would catch, so it is generated
 * instead — from the real modules, imported and walked, not from a copy.
 *
 * What cannot be generated is the fields that are genuinely functions. Those
 * are hand-ported into CrisesData and ArcsData as a match on the entry's id,
 * the same shape BlocsData uses for the bloc targets, and they are listed in
 * each table's `handPorted` below. The generator THROWS if it meets a
 * function field that is not on that list, naming it — so a new one added to
 * the TypeScript fails the export rather than silently vanishing from the
 * Godot build.
 */
import { writeFile } from "node:fs/promises";
import { CRISES } from "../src/game/crises.ts";
import { ARCS } from "../src/game/arcs.ts";

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

function gdValue(value, path, indent, handPorted) {
  const pad = "\t".repeat(indent);
  const inner = "\t".repeat(indent + 1);
  if (typeof value === "string") return gdString(value);
  if (typeof value === "number") return gdNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v, i) => `${inner}${gdValue(v, `${path}[${i}]`, indent + 1, handPorted)},`);
    return `[\n${items.join("\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const rows = [];
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "function") {
        if (handPorted.set.has(k)) continue;
        throw new Error(
          `${path}.${k} is a function and is not hand-ported. Add it to ` +
            `${handPorted.owner} and to this table's handPorted list, or the ` +
            `Godot build loses it.`,
        );
      }
      if (v === undefined) continue;
      rows.push(`${inner}${gdString(k)}: ${gdValue(v, `${path}.${k}`, indent + 1, handPorted)},`);
    }
    if (rows.length === 0) return "{}";
    return `{\n${rows.join("\n")}\n${pad}}`;
  }
  throw new Error(`${path}: cannot emit ${typeof value}`);
}


/** One generated table: where it comes from, and what is hand-ported out. */
const TABLES = [
  {
    entries: CRISES,
    noun: "crises",
    className: "CrisesTable",
    constName: "CRISES",
    source: "src/game/crises.ts",
    owner: "CrisesData",
    out: "godot/scripts/game/crises_table.gd",
    // Every crisis has one; it decides how likely the crisis is right now.
    handPorted: ["pressure", "brief"],
    required: ["pressure"],
    notes: [
      "pressure  -- every crisis, in CrisesData.pressure_for. Zero means it",
      "             cannot fire, which is how the gated ones stay out.",
      "brief     -- the residence crises that name a member of your family,",
      "             in CrisesData.brief_for.",
    ],
  },
  {
    entries: ARCS,
    noun: "arcs",
    className: "ArcsTable",
    constName: "ARCS",
    source: "src/game/arcs.ts",
    owner: "ArcsData",
    out: "godot/scripts/game/arcs_table.gd",
    handPorted: ["when", "brief"],
    required: ["when", "brief"],
    notes: [
      "when   -- every arc, in ArcsData.when_for. An arc only fires while",
      "          the situation that caused it still holds.",
      "brief   -- every arc, in ArcsData.brief_for. An arc is a person",
      "          arriving with a question, so the brief names them.",
    ],
  },
];

for (const t of TABLES) {
  const handPorted = { set: new Set(t.handPorted), owner: t.owner };
  const seen = new Set();
  for (const e of t.entries) {
    if (seen.has(e.id)) throw new Error(`duplicate ${t.noun} id: ${e.id}`);
    seen.add(e.id);
    for (const field of t.required) {
      if (typeof e[field] !== "function") {
        throw new Error(`${t.noun}/${e.id}: ${field} is not a function`);
      }
    }
  }

  const body = t.entries
    .map((e) => `\t${gdValue(e, `${t.noun}(${e.id})`, 1, handPorted)},`)
    .join("\n");
  const dynamic = {};
  for (const field of t.handPorted) {
    dynamic[field] = t.entries.filter((e) => typeof e[field] === "function").map((e) => e.id);
  }

  const notes = t.notes.map((l) => `##   ${l}`).join("\n");
  const out = `class_name ${t.className}
extends RefCounted
## The ${t.noun} table, generated from ${t.source}.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## ${t.entries.length} ${t.noun}. Every field here is plain data. The fields that are
## functions in the TypeScript live in ${t.owner} instead:
##
${notes}
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how ${t.owner} knows to
## generate one.

const ${t.constName} := [
${body}
]
`;
  await writeFile(t.out, out);
  const counts = t.handPorted.map((f) => `${dynamic[f].length} ${f}`).join(", ");
  console.log(`${t.noun}: wrote ${t.entries.length} to ${t.out} (${counts} hand-ported)`);
}
