import { applyEffects, describeEffects } from "./effects.ts";
import { eligibleArcs, arcById } from "./arcs.ts";
import type { Arc } from "./arcs.ts";
import type { Rng } from "../core/rng.ts";
import type { Effects, GameState } from "./types.ts";

/**
 * Running the arcs.
 *
 * Kept out of `engine.ts` so the engine does not grow another hundred lines,
 * and so the arc rules can be read in one place. The engine calls `rollArcs`
 * once a month and `resolveArc` when the player answers one.
 */

/**
 * Decides whether an arc fires this month. At most one at a time: two
 * consequences arriving in the same month reads as noise rather than as
 * cause and effect.
 */
export function rollArcs(s: GameState, rng: Rng): Arc | null {
  const pool = eligibleArcs(s);
  if (!pool.length) return null;
  // Arcs are not crises: they are not weighted by pressure, and they do not
  // fire every time they are eligible. Roughly one in three months.
  if (!rng.chance(0.34)) return null;
  return rng.weighted(pool, (a) => a.weight) ?? null;
}

export interface ArcResult {
  arc: Arc;
  text: string;
  effects: Effects;
  failed: boolean;
}

/**
 * Applies the player's answer to an arc and marks it spent. Returns what to
 * show, or null if the arc or choice is not real.
 */
export function resolveArc(s: GameState, rng: Rng, arcId: string, choiceId: string): ArcResult | null {
  const arc = arcById(arcId);
  if (!arc) return null;
  if (s.flags[`arc:${arc.id}`]) return null;
  const choice = arc.choices.find((c) => c.id === choiceId);
  if (!choice) return null;

  const failed = choice.risk !== undefined && rng.chance(choice.risk);
  const effects = failed && choice.onFail ? choice.onFail : choice.effects;
  applyEffects(s, effects);

  // One shot. An arc that has been answered does not come back.
  s.flags[`arc:${arc.id}`] = true;
  s.counters.arcsAnswered = (s.counters.arcsAnswered ?? 0) + 1;

  return {
    arc,
    text: failed && choice.failText ? choice.failText : choice.resultText,
    effects,
    failed,
  };
}

/** The effects an arc choice would apply, for the panel to show. */
export function arcChoiceEffects(arc: Arc, choiceId: string): Effects {
  const choice = arc.choices.find((c) => c.id === choiceId);
  return choice ? choice.effects : {};
}

export { describeEffects };
