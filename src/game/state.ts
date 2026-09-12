import { Rng } from "../core/rng.ts";
import type { BudgetKey, GameState, Party, SectorKey } from "./types.ts";

export const TERM_MONTHS = 48;
export const MIDTERM_MONTH = 22;
export const ELECTION_MONTH = 46;

export const BUDGET_KEYS: BudgetKey[] = [
  "defense",
  "healthcare",
  "education",
  "infrastructure",
  "environment",
  "science",
  "welfare",
  "justice",
  "veterans",
];

export const BUDGET_LABELS: Record<BudgetKey, string> = {
  defense: "Defense",
  healthcare: "Health & Medicare",
  education: "Education",
  infrastructure: "Infrastructure",
  environment: "Environment & Energy",
  science: "Science & Research",
  welfare: "Social Security & Welfare",
  justice: "Justice & Policing",
  veterans: "Veterans Affairs",
};

/**
 * Annual spend (in $bn) at which a sector holds a quality index of 50.
 * Needs creep upward every month, so a frozen budget is a slow cut.
 */
export const SECTOR_NEED: Record<SectorKey, number> = {
  defense: 833,
  healthcare: 1963,
  education: 321,
  infrastructure: 304,
  environment: 134,
  science: 200,
  welfare: 1650,
  justice: 207,
  veterans: 351,
};

/** Real monthly growth in what each sector costs just to stand still. */
export const NEED_DRIFT = 0.003;

export const START_BUDGET: Record<BudgetKey, number> = {
  defense: 900,
  healthcare: 1900,
  education: 300,
  infrastructure: 250,
  environment: 110,
  science: 210,
  welfare: 1650,
  justice: 200,
  veterans: 340,
};

export interface NewGameOptions {
  name: string;
  party: Party;
  seed?: number;
}

/**
 * Every game starting from the identical numbers would make the opening
 * months feel the same no matter how many times you played, so the country
 * you inherit is itself part of what the seed decides — a rockier economy
 * here, a more settled one there, a cabinet-in-waiting that leans differently
 * next time. It is drawn from the seed with a decorrelating offset, so it
 * does not consume from (or echo the pattern of) the cabinet, family and
 * crisis rolls that follow.
 */
function jitter(rng: Rng, base: number, spread: number, min = -Infinity, max = Infinity): number {
  return Math.max(min, Math.min(max, base + rng.range(-spread, spread)));
}

export function createInitialState(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed ^ 0x9e3779b9);
  const budget: Record<BudgetKey, number> = { ...START_BUDGET };
  for (const key of BUDGET_KEYS) budget[key] = Math.round(jitter(rng, budget[key], budget[key] * 0.08, 0));

  return {
    seed,
    month: 1,
    ap: 3,
    apMax: 3,
    party: opts.party,
    presidentName: opts.name.trim() || "President Vance",
    nation: {
      growth: jitter(rng, 2.2, 0.7),
      unemployment: jitter(rng, 4.6, 0.6, 2),
      inflation: jitter(rng, 2.7, 0.5, 0.5),
      debtToGdp: jitter(rng, 98, 8, 60),
      gdp: 28000,
      taxRate: 17.5,
      sectors: {
        defense: jitter(rng, 62, 7, 10, 90),
        healthcare: jitter(rng, 41, 7, 10, 90),
        education: jitter(rng, 47, 7, 10, 90),
        infrastructure: jitter(rng, 34, 7, 10, 90),
        environment: jitter(rng, 33, 7, 10, 90),
        science: jitter(rng, 55, 7, 10, 90),
        welfare: jitter(rng, 50, 7, 10, 90),
        justice: jitter(rng, 45, 7, 10, 90),
        veterans: jitter(rng, 44, 7, 10, 90),
      },
      unrest: jitter(rng, 34, 9, 5, 70),
      standing: jitter(rng, 58, 9, 20, 90),
      security: jitter(rng, 61, 9, 20, 90),
    },
    politics: {
      approval: jitter(rng, 52, 6, 30, 70),
      capital: jitter(rng, 60, 9, 30, 90),
      house: jitter(rng, 52, 6, 25, 75),
      senate: jitter(rng, 51, 6, 25, 75),
      media: jitter(rng, 50, 8, 20, 80),
      party: jitter(rng, 66, 7, 40, 90),
      scandal: jitter(rng, 6, 5, 0, 25),
    },
    personal: {
      health: jitter(rng, 78, 7, 40, 95),
      stress: jitter(rng, 30, 8, 5, 55),
      marriage: jitter(rng, 74, 8, 40, 95),
      family: jitter(rng, 70, 8, 40, 95),
      integrity: jitter(rng, 72, 7, 40, 95),
      age: Math.round(jitter(rng, 56, 6, 42, 70)),
      sleepDebt: jitter(rng, 22, 7, 0, 45),
      fitness: jitter(rng, 62, 9, 25, 90),
    },
    budget,
    enacted: { ...budget },
    bills: [],
    modifiers: [],
    news: [],
    log: [],
    pendingCrises: [],
    pendingArc: null,
    threads: [],
    heat: {},
    // Everyone starts a little above water; the leans are applied on the first tick.
    blocs: {
      labour: jitter(rng, 54, 6, 30, 75),
      business: jitter(rng, 50, 6, 30, 75),
      seniors: jitter(rng, 53, 6, 30, 75),
      young: jitter(rng, 51, 6, 30, 75),
      rural: jitter(rng, 48, 6, 30, 75),
      suburban: jitter(rng, 52, 6, 30, 75),
      activists: jitter(rng, 50, 6, 30, 75),
      traditionalists: jitter(rng, 48, 6, 30, 75),
    },
    // A closely divided Congress with the moderates holding the balance —
    // seats stay a clean, readable split, but how warm each faction starts
    // toward you (beyond the baseline lean their side gives you) still moves.
    factions:
      opts.party === "blue"
        ? {
            progressives: { seats: 12, mood: jitter(rng, 58, 8, 20, 85) },
            liberals: { seats: 26, mood: jitter(rng, 60, 8, 20, 85) },
            moderates: { seats: 22, mood: jitter(rng, 52, 8, 20, 85) },
            conservatives: { seats: 25, mood: jitter(rng, 41, 8, 15, 70) },
            hardliners: { seats: 15, mood: jitter(rng, 30, 8, 10, 60) },
          }
        : {
            progressives: { seats: 12, mood: jitter(rng, 30, 8, 10, 60) },
            liberals: { seats: 26, mood: jitter(rng, 41, 8, 15, 70) },
            moderates: { seats: 22, mood: jitter(rng, 52, 8, 20, 85) },
            conservatives: { seats: 25, mood: jitter(rng, 60, 8, 20, 85) },
            hardliners: { seats: 15, mood: jitter(rng, 58, 8, 20, 85) },
          },
    // Filled in by the engine, which owns the run's random source.
    cabinet: [],
    family: [],
    unlocked: [],
    crisisHistory: {},
    history: [],
    actionHistory: {},
    flags: {},
    counters: { billsPassed: 0, billsFailed: 0, crisesHandled: 0, vetoes: 0 },
    phase: "playing",
    ending: null,
    dangerStreak: 0,
    runningForReelection: true,
  };
}

/** Calendar helpers. Month 1 is January of the first year in office. */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function calendar(month: number): { year: number; monthName: string; label: string } {
  const idx = (month - 1) % 12;
  const year = Math.floor((month - 1) / 12) + 1;
  return {
    year,
    monthName: MONTH_NAMES[idx],
    label: `${MONTH_NAMES[idx]}, Year ${year}`,
  };
}

/** True on the month a new fiscal year's budget must be signed. */
export function isBudgetMonth(month: number): boolean {
  return (month - 1) % 12 === 0;
}

export function annualRevenue(s: GameState): number {
  return (s.nation.gdp * s.nation.taxRate) / 100;
}

/** Interest on the debt is not discretionary; it comes off the top. */
export function debtService(s: GameState): number {
  const debt = (s.nation.debtToGdp / 100) * s.nation.gdp;
  const rate = 0.026 + Math.max(0, s.nation.inflation - 2) * 0.004 + Math.max(0, s.nation.debtToGdp - 90) * 0.00012;
  return debt * rate;
}

export function totalDiscretionary(budget: Record<BudgetKey, number>): number {
  return BUDGET_KEYS.reduce((sum, k) => sum + budget[k], 0);
}

/** Permanent spending created by laws, outside the annual appropriations. */
export function legislatedSpending(s: GameState): number {
  return s.counters.legislatedSpending ?? 0;
}

export function annualDeficit(s: GameState, budget = s.enacted): number {
  return (
    totalDiscretionary(budget) +
    legislatedSpending(s) +
    debtService(s) -
    annualRevenue(s)
  );
}
