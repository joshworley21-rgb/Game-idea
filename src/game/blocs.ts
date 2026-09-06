import type { BlocKey, GameState, Party } from "./types.ts";

/**
 * The country is not one number. It is a coalition, and every decision pleases
 * part of it at the expense of another part.
 *
 * Each bloc drifts toward a target of its own, computed from the things that
 * bloc actually cares about, plus how it feels about your party before you do
 * anything at all. Approval is what falls out of the arithmetic.
 */
export interface BlocDef {
  key: BlocKey;
  name: string;
  /** Short label for the coalition board. */
  short: string;
  /** Share of the electorate. These sum to 1. */
  weight: number;
  /** How fast this bloc changes its mind. */
  volatility: number;
  /** Standing gift or handicap depending on the party you lead. */
  lean: Record<Party, number>;
  /** What this bloc wants, read off the state of the country. */
  target: (s: GameState) => number;
  /** One line on what moves them, shown in the dashboard. */
  cares: string;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Lifts every bloc by a fixed amount so a new president opens with the country
 * roughly where it used to sit under the old single-number model. Without it
 * the coalition would start eight points lower and quietly invalidate every
 * balance decision made before it existed.
 */
const CALIBRATION = 4.5;

export const BLOCS: BlocDef[] = [
  {
    key: "labour",
    name: "Unions and working families",
    short: "Labour",
    weight: 0.17,
    volatility: 0.22,
    lean: { blue: 8, red: -8 },
    cares: "Jobs, wages, welfare, and whose side you take in a strike.",
    target: (s) =>
      clamp(
        52 -
          (s.nation.unemployment - 4.6) * 7 -
          Math.max(0, s.nation.inflation - 2.5) * 4 +
          (s.nation.sectors.welfare - 50) * 0.3 +
          (s.nation.growth - 2) * 3,
      ),
  },
  {
    key: "business",
    name: "Business and finance",
    short: "Business",
    weight: 0.13,
    volatility: 0.3,
    lean: { blue: -7, red: 7 },
    cares: "Growth, the tax rate, the debt, and predictability.",
    target: (s) =>
      clamp(
        50 +
          (s.nation.growth - 2) * 9 -
          (s.nation.taxRate - 17.5) * 3.5 -
          Math.max(0, s.nation.debtToGdp - 105) * 0.28 -
          Math.max(0, s.nation.unrest - 45) * 0.35 +
          (s.nation.sectors.infrastructure - 50) * 0.12,
      ),
  },
  {
    key: "seniors",
    name: "Older voters",
    short: "Seniors",
    weight: 0.19,
    volatility: 0.16,
    lean: { blue: -3, red: 3 },
    cares: "Healthcare, prices, and the sense that things are under control.",
    target: (s) =>
      clamp(
        52 +
          (s.nation.sectors.healthcare - 50) * 0.4 -
          Math.max(0, s.nation.inflation - 2.5) * 6 -
          Math.max(0, s.nation.unrest - 40) * 0.3 +
          (s.nation.security - 50) * 0.12,
      ),
  },
  {
    key: "young",
    name: "Younger voters",
    short: "Young",
    weight: 0.15,
    volatility: 0.34,
    lean: { blue: 9, red: -9 },
    cares: "Education, climate, and whether anything ever changes.",
    target: (s) =>
      clamp(
        48 +
          (s.nation.sectors.education - 50) * 0.34 +
          (s.nation.sectors.environment - 50) * 0.4 -
          (s.nation.unemployment - 4.6) * 4 +
          (s.nation.sectors.science - 50) * 0.12,
      ),
  },
  {
    key: "rural",
    name: "Rural and small-town",
    short: "Rural",
    weight: 0.14,
    volatility: 0.18,
    lean: { blue: -9, red: 9 },
    cares: "Security, energy, guns, and being noticed at all.",
    target: (s) =>
      clamp(
        50 +
          (s.nation.security - 50) * 0.3 +
          (s.nation.sectors.veterans - 50) * 0.18 -
          (s.nation.taxRate - 17.5) * 2 -
          (s.nation.sectors.environment - 50) * 0.12 +
          (s.nation.sectors.infrastructure - 50) * 0.14,
      ),
  },
  {
    key: "suburban",
    name: "Suburban moderates",
    short: "Suburban",
    weight: 0.16,
    volatility: 0.28,
    lean: { blue: 1, red: 1 },
    cares: "Schools, crime, competence, and the absence of drama.",
    target: (s) =>
      clamp(
        50 +
          (s.nation.sectors.education - 50) * 0.22 +
          (s.nation.sectors.justice - 50) * 0.22 -
          Math.max(0, s.nation.unrest - 38) * 0.4 -
          s.politics.scandal * 0.28 +
          (s.nation.growth - 2) * 3.5,
      ),
  },
  {
    key: "activists",
    name: "The activist left",
    short: "Activists",
    weight: 0.03,
    volatility: 0.42,
    lean: { blue: 14, red: -16 },
    cares: "Climate, healthcare, and whether you fought or compromised.",
    target: (s) =>
      clamp(
        46 +
          (s.nation.sectors.environment - 50) * 0.5 +
          (s.nation.sectors.healthcare - 50) * 0.3 +
          (s.nation.taxRate - 17.5) * 2.5 -
          (s.nation.sectors.defense - 50) * 0.2,
      ),
  },
  {
    key: "traditionalists",
    name: "The traditionalist right",
    short: "Traditionalists",
    weight: 0.03,
    volatility: 0.42,
    lean: { blue: -16, red: 14 },
    cares: "Defense, order, low taxes, and holding the line.",
    target: (s) =>
      clamp(
        46 +
          (s.nation.sectors.defense - 50) * 0.42 +
          (s.nation.sectors.justice - 50) * 0.26 -
          (s.nation.taxRate - 17.5) * 3.5 -
          Math.max(0, s.nation.debtToGdp - 105) * 0.2,
      ),
  },
];

export const BLOC_BY_KEY = new Map(BLOCS.map((b) => [b.key, b]));

/** Approval is the coalition, weighted by size. */
export function coalitionApproval(s: GameState): number {
  let total = 0;
  for (const def of BLOCS) total += (s.blocs[def.key] ?? 50) * def.weight;
  return total;
}

/**
 * Moves every bloc toward what it wants. Blocs that lean against your party
 * never quite come home, and blocs that lean toward it forgive more.
 */
export function driftBlocs(s: GameState): void {
  for (const def of BLOCS) {
    const target = clamp(def.target(s) + def.lean[s.party] + CALIBRATION);
    const current = s.blocs[def.key] ?? 50;
    s.blocs[def.key] = clamp(current + (target - current) * def.volatility);
  }
}

/** Who has left you, for the coalition board and the endings. */
export function weakestBlocs(s: GameState, count = 3): BlocDef[] {
  return [...BLOCS].sort((a, b) => (s.blocs[a.key] ?? 50) - (s.blocs[b.key] ?? 50)).slice(0, count);
}
