import { rollArcs, resolveArc } from "./arcRunner.ts";
import type { ArcResult } from "./arcRunner.ts";
import { arcById } from "./arcs.ts";
import type { Arc } from "./arcs.ts";
import type { Rng } from "../core/rng.ts";
import type { GameState } from "./types.ts";

/**
 * The engine's arc hooks.
 *
 * `engine.ts` is the one file in the simulation that is genuinely too big to
 * hold everything, so the arc behaviour lives here and the engine delegates.
 * These are plain functions over the state rather than methods, which keeps
 * the engine's own surface unchanged apart from three one-line calls.
 */

/** The arc waiting on an answer, if there is one. */
export function pendingArc(s: GameState): Arc | null {
  return s.pendingArc ? (arcById(s.pendingArc) ?? null) : null;
}

/**
 * Rolls for an arc at the end of a month. Returns the arc that fired, so the
 * engine can emit it. At most one at a time.
 */
export function rollMonthArcs(s: GameState, rng: Rng): Arc | null {
  if (s.pendingArc) return null;
  const arc = rollArcs(s, rng);
  if (!arc) return null;
  s.pendingArc = arc.id;
  return arc;
}

/** Answers the pending arc. Returns what to show, or null if there is none. */
export function answerArc(s: GameState, rng: Rng, choiceId: string): ArcResult | null {
  if (!s.pendingArc) return null;
  const result = resolveArc(s, rng, s.pendingArc, choiceId);
  if (!result) return null;
  s.pendingArc = null;
  return result;
}

/**
 * Whether the month can end. An arc blocks it for the same reason a crisis
 * does: something has arrived and it wants a decision before you move on.
 */
export function arcBlocksMonth(s: GameState): boolean {
  return s.pendingArc !== null;
}
