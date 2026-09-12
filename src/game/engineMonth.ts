import { CRISES, crisisPressure, eligibleCrises } from "./crises.ts";
import { buildEnding, checkFailState, isTermOver, updateDangerStreak } from "./endings.ts";
import { generateNews, pushNews } from "./news.ts";
import { simulateMonth } from "./sim.ts";
import type { MonthReport, SimContext } from "./sim.ts";
import { MIDTERM_MONTH } from "./state.ts";
import { rollMonthArcs } from "./arcHooks.ts";
import { midtermText, runBody, runCabinet, runMidterms, runResidence, runStopgap } from "./monthFlow.ts";
import type { Arc } from "./arcs.ts";
import type { Outcome } from "./outcome.ts";
import type { Rng } from "../core/rng.ts";
import type { Crisis, Ending, GameState } from "./types.ts";

/**
 * The month, end to end.
 *
 * This is the engine's `endMonth` and the private routines it calls, lifted
 * out so the engine class is about state and events rather than about the
 * order in which a month resolves. The engine calls `endMonth` here and
 * forwards whatever it returns.
 */

export interface MonthResult {
  report: MonthReport;
  /** Toasts to show, in order. */
  outcomes: Outcome[];
  /** Crises that fired, for the engine to emit. */
  crises: Crisis[];
  /** An arc that arrived this month, if one did. */
  arc: Arc | null;
  /** Set when the term ended this month. */
  ending: Ending | null;
  /** True when the player should be asked about re-election. */
  askReelection: boolean;
}

export function endMonth(s: GameState, ctx: SimContext, rng: Rng): MonthResult {
  const outcomes: Outcome[] = [];

  // An unsigned budget means a continuing resolution: last year's numbers.
  if (isBudgetPending(s)) runStopgap(s);

  const crisisCount = s.counters.crisesThisMonth ?? 0;
  const report = simulateMonth(s, ctx, rng, crisisCount);
  s.counters.crisesThisMonth = 0;

  runCabinet(s, rng, report);
  const body = runBody(s, rng, report);
  if (body) outcomes.push({ title: body.title, text: body.text, effects: [], tone: body.tone });
  runResidence(s, report);

  s.history.push({
    month: s.month,
    approval: s.politics.approval,
    growth: s.nation.growth,
    unemployment: s.nation.unemployment,
    unrest: s.nation.unrest,
    health: s.personal.health,
  });

  s.month += 1;
  updateDangerStreak(s);

  if (s.month === MIDTERM_MONTH) {
    const result = runMidterms(s, rng);
    outcomes.push({
      title: "Midterm Elections",
      text: midtermText(result),
      effects: [],
      tone: result.won ? "good" : "bad",
    });
  }

  const fail = checkFailState(s);
  if (fail || isTermOver(s)) {
    s.phase = "ended";
    s.ending = buildEnding(s, rng, fail);
    return { report, outcomes, crises: [], arc: null, ending: s.ending, askReelection: false };
  }

  // Crises, then arcs. An arc is a consequence rather than an event, so it
  // waits its turn behind whatever the country did this month.
  const crises = rollCrises(s, rng);
  const arc = rollMonthArcs(s, rng);
  pushNews(s, generateNews(s, rng));

  const askReelection = s.month >= 34 && !s.flags.reelectionAsked;
  if (askReelection) s.flags.reelectionAsked = true;

  return { report, outcomes, crises, arc, ending: null, askReelection };
}

/** True on the month a new fiscal year's budget must be signed. */
export function isBudgetPending(s: GameState): boolean {
  return (s.month - 1) % 12 === 0 && !s.flags[`budget${s.month}`];
}

/** Rolls this month's crises from the eligible pool, weighted by pressure. */
export function rollCrises(s: GameState, rng: Rng): Crisis[] {
  const pool = eligibleCrises(s);
  if (pool.length === 0) return [];
  const totalPressure = pool.reduce((sum, c) => sum + crisisPressure(s, c), 0);
  const chance = Math.min(0.8, Math.max(0.15, 0.12 + totalPressure * 0.03));

  const fired: string[] = [];
  if (rng.chance(chance)) {
    const picked = rng.weighted(pool, (c) => c.weight * crisisPressure(s, c));
    if (picked) fired.push(picked.id);
  }
  // A second, rarer crisis when the country is genuinely under strain.
  if (fired.length === 1 && rng.chance(Math.min(0.25, totalPressure * 0.012))) {
    const rest = pool.filter((c) => !fired.includes(c.id));
    const second = rng.weighted(rest, (c) => c.weight * crisisPressure(s, c));
    if (second) fired.push(second.id);
  }

  s.pendingCrises = fired;
  s.counters.crisesThisMonth = fired.length;
  return fired.map((id) => CRISES.find((c) => c.id === id)!).filter(Boolean);
}
