import { Rng } from "../core/rng.ts";
import { addPath, applyEffects } from "./effects.ts";
import { BLOCS, coalitionApproval, driftBlocs } from "./blocs.ts";
import { cabinetFactionSupport, cabinetStrength, domainCompetence } from "./cabinet.ts";
import { driftFactions, friendlySeats } from "./congress.ts";
import {
  BUDGET_KEYS,
  NEED_DRIFT,
  SECTOR_NEED,
  annualDeficit,
  annualRevenue,
} from "./state.ts";
import type { GameState, SectorKey } from "./types.ts";

/** Mutable per-run economy internals that don't belong in saved player state. */
export interface SimContext {
  /** Real cost of holding each sector at index 50; creeps up over the term. */
  needs: Record<SectorKey, number>;
  /** Phase offset of the business cycle. */
  cyclePhase: number;
}

/**
 * `month` rebuilds the accumulated cost of standing still, so a loaded save
 * resumes with the same needs it had when it was written.
 */
export function createSimContext(rng: Rng, month = 1): SimContext {
  const elapsed = Math.max(0, month - 1);
  const creep = (1 + NEED_DRIFT) ** elapsed;
  const needs = {} as Record<SectorKey, number>;
  for (const key of Object.keys(SECTOR_NEED) as SectorKey[]) {
    needs[key] = SECTOR_NEED[key] * creep;
  }
  return { needs, cyclePhase: rng.range(0, Math.PI * 2) };
}

export interface MonthReport {
  month: number;
  deltas: { label: string; from: number; to: number; good: boolean }[];
  deficit: number;
  revenue: number;
  notes: string[];
}

function drift(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

/**
 * The approval number the public would settle on given today's conditions.
 *
 * This is no longer a formula over the nation's statistics: it is the weighted
 * sum of what each constituency thinks of you, which is what approval actually
 * is. Character and press relations shade it, and deep polarisation compresses
 * every president toward the middle.
 */
export function approvalTarget(s: GameState): number {
  const coalition = coalitionApproval(s);
  const character = s.personal.integrity * 0.5 + (100 - s.politics.scandal) * 0.5;
  return 47.5 + (coalition - 50) * 0.92 + (character - 75) * 0.09 + (s.politics.media - 50) * 0.06;
}

/** Long-run growth the economy is capable of, before cycle and shocks. */
export function potentialGrowth(s: GameState): number {
  const n = s.nation;
  return (
    2.2 +
    (n.sectors.infrastructure - 50) * 0.012 +
    (n.sectors.education - 50) * 0.01 +
    (n.sectors.science - 50) * 0.014 -
    (n.taxRate - 18) * 0.075 -
    Math.max(0, n.debtToGdp - 90) * 0.004 -
    (n.unrest - 35) * 0.012 +
    (n.standing - 50) * 0.004
  );
}

interface TrackedStat {
  label: string;
  path: string;
  get: (s: GameState) => number;
  good: (delta: number) => boolean;
  minDelta: number;
}

const TRACKED: TrackedStat[] = [
  { label: "Approval", path: "politics.approval", get: (s) => s.politics.approval, good: (d) => d > 0, minDelta: 0.6 },
  { label: "Growth", path: "nation.growth", get: (s) => s.nation.growth, good: (d) => d > 0, minDelta: 0.12 },
  { label: "Unemployment", path: "nation.unemployment", get: (s) => s.nation.unemployment, good: (d) => d < 0, minDelta: 0.12 },
  { label: "Inflation", path: "nation.inflation", get: (s) => s.nation.inflation, good: (d) => d < 0, minDelta: 0.12 },
  { label: "Debt/GDP", path: "nation.debtToGdp", get: (s) => s.nation.debtToGdp, good: (d) => d < 0, minDelta: 0.35 },
  { label: "Unrest", path: "nation.unrest", get: (s) => s.nation.unrest, good: (d) => d < 0, minDelta: 0.8 },
  { label: "Health", path: "personal.health", get: (s) => s.personal.health, good: (d) => d > 0, minDelta: 0.8 },
  { label: "Stress", path: "personal.stress", get: (s) => s.personal.stress, good: (d) => d < 0, minDelta: 1.2 },
  { label: "Marriage", path: "personal.marriage", get: (s) => s.personal.marriage, good: (d) => d > 0, minDelta: 0.8 },
  { label: "Family", path: "personal.family", get: (s) => s.personal.family, good: (d) => d > 0, minDelta: 0.8 },
];

/**
 * Advances the world by one month: laws, budgets, the economy, the mood of
 * the country, and the wear on the person in the chair.
 */
export function simulateMonth(
  s: GameState,
  ctx: SimContext,
  rng: Rng,
  crisisCount: number,
): MonthReport {
  const before = new Map(TRACKED.map((t) => [t.label, t.get(s)]));
  const blocsBefore = new Map(BLOCS.map((b) => [b.key, s.blocs[b.key] ?? 50]));
  const notes: string[] = [];

  // --- Running situations: wars, epidemics, investigations ---
  for (const thread of s.threads) {
    // Effects scale with intensity, so a situation winding down hurts less.
    if (thread.perMonth) applyEffects(s, thread.perMonth, thread.intensity / 60);
    thread.intensity = Math.max(0, Math.min(100, thread.intensity + thread.drift));
    thread.age += 1;
    // A live situation keeps its domains hot, which is what clusters trouble.
    for (const tag of thread.tags ?? []) {
      s.heat[tag] = Math.max(s.heat[tag] ?? 0, thread.intensity * 0.6);
    }
  }
  const ended = s.threads.filter((t) => t.intensity <= 0);
  for (const t of ended) notes.push(`${t.label} is over, after ${t.age} months.`);
  s.threads = s.threads.filter((t) => t.intensity > 0);

  // Domains cool off when nothing is feeding them.
  for (const key of Object.keys(s.heat) as (keyof typeof s.heat)[]) {
    const value = (s.heat[key] ?? 0) * 0.86;
    if (value < 1) delete s.heat[key];
    else s.heat[key] = value;
  }

  // --- Standing effects: temporary modifiers and laws on the books ---
  for (const mod of s.modifiers) applyEffects(s, mod.perMonth);
  s.modifiers = s.modifiers.filter((m) => {
    if (m.months < 0) return true;
    m.months -= 1;
    return m.months > 0;
  });
  for (const bill of s.bills) {
    if (bill.status === "passed" && bill.perMonth) applyEffects(s, bill.perMonth);
  }

  // --- Public services respond to money, slowly ---
  // Money buys capacity; a competent cabinet is what turns it into delivery.
  const machine = 1 + (cabinetStrength(s) - 63) * 0.0035;
  for (const key of BUDGET_KEYS) {
    ctx.needs[key] *= 1 + NEED_DRIFT;
    const ratio = s.enacted[key] / ctx.needs[key];
    const target = Math.min(100, Math.max(0, 50 + 62 * (ratio - 1)));
    const decay = s.nation.unrest > 65 ? 0.9 : 1; // strikes and disorder blunt delivery
    s.nation.sectors[key] = drift(s.nation.sectors[key], target * decay * machine, 0.085);
  }

  // --- Macroeconomy ---
  const cycle = 0.6 * Math.sin(s.month / 9 + ctx.cyclePhase);
  const shock = (rng.next() + rng.next() + rng.next() - 1.5) * 0.5;
  let growthTarget =
    potentialGrowth(s) + cycle + shock + (domainCompetence(s, "economy") - 60) * 0.006;
  // Central bank leans against inflation with rate hikes.
  if (s.nation.inflation > 3.2) growthTarget -= (s.nation.inflation - 3.2) * 0.35;
  s.nation.growth = drift(s.nation.growth, growthTarget, 0.35);

  const revenue = annualRevenue(s);
  const deficit = annualDeficit(s);
  const deficitPct = (deficit / s.nation.gdp) * 100;

  const inflationTarget =
    1.7 + 0.42 * (s.nation.growth - 2) + 0.1 * (deficitPct - 2.5) + shock * 0.3;
  s.nation.inflation = drift(s.nation.inflation, inflationTarget, 0.25);

  const unemploymentTarget =
    4.4 -
    0.55 * (s.nation.growth - 2) +
    (50 - s.nation.sectors.education) * 0.012 +
    Math.max(0, s.nation.unrest - 50) * 0.02;
  s.nation.unemployment = drift(s.nation.unemployment, unemploymentTarget, 0.28);

  // Nominal GDP compounds with real growth plus prices.
  const debtDollars = (s.nation.debtToGdp / 100) * s.nation.gdp + deficit / 12;
  s.nation.gdp *= 1 + (s.nation.growth + s.nation.inflation) / 1200;
  s.nation.debtToGdp = Math.min(400, (debtDollars / s.nation.gdp) * 100);

  // --- Society, security, the world ---
  const avgSocial =
    (s.nation.sectors.healthcare +
      s.nation.sectors.welfare +
      s.nation.sectors.justice +
      s.nation.sectors.education) /
    4;
  const unrestTarget =
    24 +
    (s.nation.unemployment - 4.5) * 3.2 +
    Math.max(0, s.nation.inflation - 3) * 3 +
    (50 - avgSocial) * 0.45 +
    (50 - s.politics.approval) * 0.18 -
    (s.nation.sectors.justice - 50) * 0.15;
  s.nation.unrest = drift(s.nation.unrest, Math.max(0, unrestTarget), 0.22);

  const securityTarget =
    50 +
    (s.nation.sectors.defense - 50) * 0.6 +
    (s.nation.standing - 50) * 0.3 -
    (s.nation.unrest - 35) * 0.2;
  s.nation.security = drift(s.nation.security, securityTarget, 0.18);

  const standingTarget =
    50 +
    (s.nation.security - 50) * 0.2 +
    (s.nation.sectors.environment - 50) * 0.15 +
    (s.nation.growth - 2) * 1.5 -
    (s.nation.unrest - 35) * 0.15;
  s.nation.standing = drift(s.nation.standing, standingTarget, 0.14);

  // --- Politics ---
  // Constituencies move first: approval is the sum of what they now think.
  driftBlocs(s);
  // Then Congress, whose factions follow their own constituencies — and take
  // note of which of them you gave a department to.
  driftFactions(s, cabinetFactionSupport(s));
  // House and Senate numbers now describe who would actually vote with you.
  const friendly = friendlySeats(s);
  s.politics.house = drift(s.politics.house, friendly, 0.5);
  s.politics.senate = drift(s.politics.senate, friendly * 0.96, 0.5);

  let target = approvalTarget(s);
  if (s.month <= 6) target += (7 - s.month) * 1.1; // honeymoon
  if (s.month >= 40) target -= (s.month - 39) * 0.25; // late-term fatigue
  s.politics.approval = drift(s.politics.approval, target, 0.3);

  const capitalGain = 3.5 + (s.politics.approval - 48) / 12 + (s.politics.party - 55) / 30;
  addPath(s, "politics.capital", capitalGain);

  s.politics.media = drift(s.politics.media, 50 - s.politics.scandal * 0.25, 0.07);
  // Your party's mood follows its own base rather than the country at large.
  const coreKeys = s.party === "blue"
    ? (["labour", "young", "activists"] as const)
    : (["rural", "business", "traditionalists"] as const);
  const core = coreKeys.reduce((sum, k) => sum + (s.blocs[k] ?? 50), 0) / coreKeys.length;
  s.politics.party = drift(s.politics.party, 40 + core * 0.55 + (s.politics.approval - 45) * 0.2, 0.09);
  addPath(s, "politics.scandal", s.politics.media < 40 ? -0.6 : -1.2);

  // --- The person in the chair ---
  const stressTarget =
    34 +
    (52 - s.politics.approval) * 0.5 +
    crisisCount * 10 +
    Math.max(0, s.nation.unrest - 45) * 0.3 +
    Math.max(0, 50 - s.personal.marriage) * 0.15;
  s.personal.stress = drift(s.personal.stress, Math.max(5, stressTarget), 0.3);

  let healthDelta = -0.45 - Math.max(0, s.personal.stress - 65) * 0.055;
  if (s.personal.age > 62) healthDelta -= 0.12;
  addPath(s, "personal.health", healthDelta);

  const strain = s.personal.stress > 70 ? 0.5 : 0;
  addPath(s, "personal.marriage", -1.05 - strain);
  addPath(s, "personal.family", -0.95 - strain * 0.8);
  s.personal.age += 1 / 12;

  // Name the constituency that shifted hardest, so movement is legible.
  let biggest: { name: string; delta: number } | null = null;
  for (const def of BLOCS) {
    const delta = (s.blocs[def.key] ?? 50) - (blocsBefore.get(def.key) ?? 50);
    if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
      biggest = { name: def.short, delta };
    }
  }
  if (biggest && Math.abs(biggest.delta) >= 1.4) {
    notes.push(
      biggest.delta > 0
        ? `${biggest.name} are warming to you.`
        : `${biggest.name} are drifting away.`,
    );
  }

  if (s.personal.health < 35) {
    addPath(s, "personal.stress", 2.5);
    notes.push("Your doctor has stopped hinting and started warning.");
  }
  if (s.personal.marriage < 25) notes.push("The residence is very quiet lately.");
  if (s.personal.family < 25) notes.push("Your kids have stopped returning calls.");
  if (s.nation.unrest > 70) notes.push("Protests are now a nightly fixture on the news.");
  if (s.nation.debtToGdp > 130) notes.push("Bond markets are openly nervous about the debt.");

  // --- Action points for the month ahead ---
  // Two things a month, three if you are in good enough shape to manage it.
  let ap = 2;
  if (s.personal.health >= 70 && s.personal.stress <= 50) ap += 1;
  if (s.personal.health < 40 || s.personal.stress >= 85) ap -= 1;
  s.apMax = Math.max(1, Math.min(3, ap));
  s.ap = s.apMax;

  const deltas = TRACKED.map((t) => {
    const from = before.get(t.label)!;
    const to = t.get(s);
    return { label: t.label, from, to, good: t.good(to - from) };
  }).filter((d) => Math.abs(d.to - d.from) >= TRACKED.find((t) => t.label === d.label)!.minDelta);

  return { month: s.month, deltas, deficit, revenue, notes };
}
