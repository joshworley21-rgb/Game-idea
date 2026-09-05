/** Shared domain types for the simulation. */

export type Ideology = "progressive" | "centrist" | "conservative";

/** The player's party. The opposition is simply the other one. */
export type Party = "blue" | "red";

export type BudgetKey =
  | "defense"
  | "healthcare"
  | "education"
  | "infrastructure"
  | "environment"
  | "science"
  | "welfare"
  | "justice"
  | "veterans";

export type SectorKey = BudgetKey;

/** Macro condition of the nation. Most indices run 0-100, higher is better. */
export interface Nation {
  /** Annualised real growth, in percent. */
  growth: number;
  unemployment: number;
  inflation: number;
  /** Federal debt as a share of GDP, percent. */
  debtToGdp: number;
  /** Nominal GDP in billions, used to scale the budget. */
  gdp: number;
  /** Effective average federal tax take, percent of GDP. */
  taxRate: number;
  /** Quality-of-service index per sector, 0-100. */
  sectors: Record<SectorKey, number>;
  /** Civil unrest, 0-100. Lower is better. */
  unrest: number;
  /** International standing, 0-100. */
  standing: number;
  /** Perceived national security, 0-100. */
  security: number;
}

export interface Politics {
  approval: number;
  /** Spendable clout, 0-100. Regenerates from approval and wins. */
  capital: number;
  /** Share of each chamber sympathetic to the president, 0-100. */
  house: number;
  senate: number;
  /** How friendly the press is, 0-100. */
  media: number;
  /** Standing with the president's own party, 0-100. */
  party: number;
  /** Accumulated exposure to scandal, 0-100. */
  scandal: number;
}

export interface Personal {
  health: number;
  stress: number;
  /** Bond with spouse, 0-100. */
  marriage: number;
  /** Bond with children, 0-100. */
  family: number;
  /** Personal reputation for straight dealing, 0-100. */
  integrity: number;
  age: number;
}

export type EffectPath =
  | `nation.${Exclude<keyof Nation, "sectors">}`
  | `nation.sectors.${SectorKey}`
  | `politics.${keyof Politics}`
  | `personal.${keyof Personal}`;

/** A flat bag of additive deltas applied to state. */
export type Effects = Partial<Record<EffectPath, number>>;

export interface Modifier {
  id: string;
  label: string;
  /** Months remaining; -1 means permanent for the term. */
  months: number;
  /** Applied every month while active. */
  perMonth: Effects;
}

export interface NewsItem {
  month: number;
  headline: string;
  source: string;
  tone: "good" | "bad" | "neutral";
}

export interface LogEntry {
  month: number;
  text: string;
  kind: "policy" | "personal" | "crisis" | "system";
}

export type BillStatus = "available" | "passed" | "failed" | "locked";

export interface Bill {
  id: string;
  title: string;
  summary: string;
  ideology: Ideology;
  /** Annual cost in billions; negative means it raises revenue. */
  cost: number;
  /** Capital required to even bring it to the floor. */
  capitalCost: number;
  /** How divisive it is, 0-40. Higher means a harder vote. */
  partisanship: number;
  /** Applied once when the bill passes. */
  onPass: Effects;
  /** Ongoing monthly effect while the law is on the books. */
  perMonth?: Effects;
  /** Only offered when this predicate holds. */
  requires?: (s: GameState) => boolean;
  status: BillStatus;
  /** Month a failed vote happened; it can be brought back later. */
  failedMonth?: number;
}

export interface Choice {
  id: string;
  label: string;
  detail: string;
  /** Capital spent to take this option. Blocked if unaffordable. */
  capitalCost?: number;
  effects: Effects;
  /** Chance the option backfires, 0-1. */
  risk?: number;
  /** Applied instead of `effects` when the risk lands. */
  onFail?: Effects;
  failText?: string;
  resultText: string;
  modifier?: Omit<Modifier, "id"> & { id?: string };
}

export interface Crisis {
  id: string;
  title: string;
  brief: string;
  /** Where the news breaks from. */
  source: string;
  category: "domestic" | "foreign" | "economic" | "disaster" | "personal";
  /** Relative likelihood; scaled by `pressure`. */
  weight: number;
  /** 0 means impossible right now, higher means more likely. */
  pressure: (s: GameState) => number;
  choices: Choice[];
  /** Months before this crisis can fire again. */
  cooldown: number;
}

export interface OfficeAction {
  id: string;
  station: StationId;
  label: string;
  detail: string;
  ap: number;
  capitalCost?: number;
  effects: Effects;
  resultText: string;
  /** Hidden when false. */
  available?: (s: GameState) => boolean;
  /** Cooldown in months after use. */
  cooldown?: number;
}

export type StationId =
  | "desk"
  | "budget"
  | "phone"
  | "press"
  | "family"
  | "staff"
  | "rest";

export interface HistoryPoint {
  month: number;
  approval: number;
  growth: number;
  unemployment: number;
  unrest: number;
  health: number;
}

export type Phase = "playing" | "ended";

export interface Ending {
  id: string;
  title: string;
  blurb: string;
  reelected: boolean | null;
  legacy: number;
  grade: string;
}

export interface GameState {
  seed: number;
  /** 1-48. Month 1 is January of year one. */
  month: number;
  /** Action points left this month. */
  ap: number;
  apMax: number;
  party: Party;
  presidentName: string;
  nation: Nation;
  politics: Politics;
  personal: Personal;
  budget: Record<BudgetKey, number>;
  /** Budget as approved by Congress; what actually gets spent. */
  enacted: Record<BudgetKey, number>;
  bills: Bill[];
  modifiers: Modifier[];
  news: NewsItem[];
  log: LogEntry[];
  /** Crises awaiting a decision before the month can end. */
  pendingCrises: string[];
  /** crisisId -> month it last fired. */
  crisisHistory: Record<string, number>;
  /** One snapshot per completed month, for the trend charts. */
  history: HistoryPoint[];
  /** actionId -> month it was last used. */
  actionHistory: Record<string, number>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  phase: Phase;
  ending: Ending | null;
  /** Months in a row spent in crisis territory, used for fail states. */
  dangerStreak: number;
  runningForReelection: boolean;
}
