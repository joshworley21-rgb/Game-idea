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

export function createInitialState(opts: NewGameOptions): GameState {
  const budget = { ...START_BUDGET };
  return {
    seed: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
    month: 1,
    ap: 3,
    apMax: 3,
    party: opts.party,
    presidentName: opts.name.trim() || "President Vance",
    nation: {
      growth: 2.2,
      unemployment: 4.6,
      inflation: 2.7,
      debtToGdp: 98,
      gdp: 28000,
      taxRate: 17.5,
      sectors: {
        defense: 62,
        healthcare: 41,
        education: 47,
        infrastructure: 34,
        environment: 33,
        science: 55,
        welfare: 50,
        justice: 45,
        veterans: 44,
      },
      unrest: 34,
      standing: 58,
      security: 61,
    },
    politics: {
      approval: 52,
      capital: 60,
      house: 52,
      senate: 51,
      media: 50,
      party: 66,
      scandal: 6,
    },
    personal: {
      health: 78,
      stress: 30,
      marriage: 74,
      family: 70,
      integrity: 72,
      age: 56,
    },
    budget,
    enacted: { ...budget },
    bills: [],
    modifiers: [],
    news: [],
    log: [],
    pendingCrises: [],
    threads: [],
    heat: {},
    // Everyone starts a little above water; the leans are applied on the first tick.
    blocs: {
      labour: 54,
      business: 50,
      seniors: 53,
      young: 51,
      rural: 48,
      suburban: 52,
      activists: 50,
      traditionalists: 48,
    },
    // A closely divided Congress with the moderates holding the balance.
    // A new president arrives with their own side warm and the other cold;
    // the flanks are always the hardest work.
    factions:
      opts.party === "blue"
        ? {
            progressives: { seats: 12, mood: 58 },
            liberals: { seats: 26, mood: 60 },
            moderates: { seats: 22, mood: 52 },
            conservatives: { seats: 25, mood: 41 },
            hardliners: { seats: 15, mood: 30 },
          }
        : {
            progressives: { seats: 12, mood: 30 },
            liberals: { seats: 26, mood: 41 },
            moderates: { seats: 22, mood: 52 },
            conservatives: { seats: 25, mood: 60 },
            hardliners: { seats: 15, mood: 58 },
          },
    // Filled in by the engine, which owns the run's random source.
    cabinet: [],
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
