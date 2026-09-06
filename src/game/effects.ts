import { childrenOf, spouseOf } from "./family.ts";
import type { EffectPath, Effects, GameState } from "./types.ts";

type Bounds = [min: number, max: number];

const DEFAULT_BOUNDS: Bounds = [0, 100];

const BOUNDS: Partial<Record<string, Bounds>> = {
  "nation.growth": [-14, 14],
  "nation.unemployment": [1.2, 32],
  "nation.inflation": [-4, 40],
  "nation.debtToGdp": [0, 400],
  "nation.gdp": [1000, 1e7],
  "nation.taxRate": [6, 45],
  "personal.age": [30, 120],
};

export function clampPath(path: string, value: number): number {
  const [min, max] = BOUNDS[path] ?? DEFAULT_BOUNDS;
  return Math.min(max, Math.max(min, value));
}

export function readPath(s: GameState, path: EffectPath): number {
  const parts = path.split(".");
  let node: unknown = s;
  for (const p of parts) node = (node as Record<string, unknown>)[p];
  return typeof node === "number" ? node : 0;
}

/**
 * Stats with diminishing returns. Restoring a marriage from 30 is far easier
 * than nudging it from 85, and no amount of gym time makes a 62-year-old
 * president young. The floor keeps late-term upkeep worthwhile but expensive.
 */
const SOFT_CAPPED = new Set(["personal.health", "personal.marriage", "personal.family"]);

function softenGain(path: string, current: number, delta: number): number {
  if (delta > 0 && SOFT_CAPPED.has(path)) {
    return delta * Math.min(1, Math.max(0.12, (100 - current) / 35));
  }
  // Relief from stress you barely have is relief you barely feel.
  if (delta < 0 && path === "personal.stress") {
    return delta * Math.min(1, Math.max(0.15, current / 45));
  }
  return delta;
}

/**
 * Marriage and family are readouts of the people upstairs, not stores. A delta
 * aimed at either lands on the person it is actually about — the spouse, or
 * every child — and the scalar is recomputed from them.
 */
function applyToPeople(s: GameState, path: string, delta: number): boolean {
  if (path === "personal.marriage") {
    const spouse = spouseOf(s);
    if (!spouse) return false;
    spouse.bond = clampPath(path, spouse.bond + softenGain(path, spouse.bond, delta));
    // Time and attention move together: a good evening is not just a number.
    if (delta > 0) spouse.since = Math.max(0, spouse.since - (delta > 8 ? 2 : 1));
    s.personal.marriage = spouse.bond;
    return true;
  }
  if (path === "personal.family") {
    const kids = childrenOf(s);
    if (!kids.length) return false;
    for (const kid of kids) {
      kid.bond = clampPath(path, kid.bond + softenGain(path, kid.bond, delta));
      if (delta > 0) kid.since = Math.max(0, kid.since - (delta > 8 ? 2 : 1));
    }
    s.personal.family = kids.reduce((sum, k) => sum + k.bond, 0) / kids.length;
    return true;
  }
  return false;
}

/** Adds `delta` at `path`, clamped to that stat's legal range. */
export function addPath(s: GameState, path: EffectPath, delta: number): void {
  if (applyToPeople(s, path, delta)) return;
  const parts = path.split(".");
  const last = parts.pop()!;
  let node: Record<string, unknown> = s as unknown as Record<string, unknown>;
  for (const p of parts) node = node[p] as Record<string, unknown>;
  const current = typeof node[last] === "number" ? (node[last] as number) : 0;
  node[last] = clampPath(path, current + softenGain(path, current, delta));
}

export function applyEffects(s: GameState, effects: Effects | undefined, scale = 1): void {
  if (!effects) return;
  for (const [path, delta] of Object.entries(effects)) {
    if (typeof delta !== "number") continue;
    addPath(s, path as EffectPath, delta * scale);
  }
}

const LABELS: Partial<Record<string, string>> = {
  "nation.growth": "Growth",
  "nation.unemployment": "Unemployment",
  "nation.inflation": "Inflation",
  "nation.debtToGdp": "Debt/GDP",
  "nation.taxRate": "Tax rate",
  "nation.unrest": "Unrest",
  "nation.standing": "Global standing",
  "nation.security": "Security",
  "politics.approval": "Approval",
  "politics.capital": "Political capital",
  "politics.house": "House support",
  "politics.senate": "Senate support",
  "politics.media": "Press relations",
  "politics.party": "Party backing",
  "politics.scandal": "Scandal",
  "personal.health": "Health",
  "personal.stress": "Stress",
  "personal.marriage": "Marriage",
  "personal.family": "Family",
  "personal.integrity": "Integrity",
  "personal.sleepDebt": "Sleep debt",
  "personal.fitness": "Fitness",
};

/** Stats where a rising number is bad news for the player. */
const INVERTED = new Set([
  "nation.unemployment",
  "nation.inflation",
  "nation.debtToGdp",
  "nation.unrest",
  "personal.stress",
  "personal.sleepDebt",
  "politics.scandal",
]);

const BLOC_LABELS: Record<string, string> = {
  labour: "Labour",
  business: "Business",
  seniors: "Seniors",
  young: "Young voters",
  rural: "Rural",
  suburban: "Suburban",
  activists: "The left",
  traditionalists: "The right",
};

export function effectLabel(path: string): string {
  if (path.startsWith("nation.sectors.")) {
    const key = path.split(".")[2];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  if (path.startsWith("blocs.")) return BLOC_LABELS[path.split(".")[1]] ?? path;
  return LABELS[path] ?? path;
}

export function isGood(path: string, delta: number): boolean {
  return INVERTED.has(path) ? delta < 0 : delta > 0;
}

/** Human-readable summary of an effect bag, for tooltips and result cards. */
export function describeEffects(effects: Effects | undefined): { text: string; good: boolean }[] {
  if (!effects) return [];
  return Object.entries(effects)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([path, v]) => {
      const delta = v as number;
      const unit = path === "nation.gdp" ? "bn" : "";
      const sign = delta > 0 ? "+" : "";
      const rounded = Math.abs(delta) < 1 ? delta.toFixed(1) : Math.round(delta).toString();
      return {
        text: `${effectLabel(path)} ${sign}${rounded}${unit}`,
        good: isGood(path, delta),
      };
    });
}
