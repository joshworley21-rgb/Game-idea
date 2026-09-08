import type { Rng } from "../core/rng.ts";
import { rosterByCategory } from "./roster.ts";
import type { RosterPerson } from "./roster.ts";
import type { DiplomaticRelation, GameState } from "./types.ts";

/**
 * The world outside the fence, as ten actual people rather than one dial
 * called `nation.standing`. Each is a "Foreign Leader" from the roster, with
 * their own relationship to you — separate from anyone else's — that warms
 * or cools with attention, and that can carry an actual agreement: a trade
 * deal, a defense arrangement, an open back-channel to someone you can't
 * exactly call an ally.
 */

export type Disposition = "ally" | "rival" | "adversary" | "partner";

export interface WorldLeader extends RosterPerson {
  disposition: Disposition;
}

function dispositionOf(p: RosterPerson): Disposition {
  const text = `${p.role} ${p.agenda}`.toLowerCase();
  if (text.includes("rogue") || text.includes("adversary")) return "adversary";
  if (text.includes("rival")) return "rival";
  if (text.includes("ally") || text.includes("allied")) return "ally";
  return "partner";
}

/** Where a relationship starts and where it drifts back to without attention. */
const BASE_STANDING: Record<Disposition, number> = {
  ally: 64,
  partner: 52,
  rival: 34,
  adversary: 20,
};

export const WORLD_LEADERS: WorldLeader[] = rosterByCategory("Foreign Leader").map((p) => ({
  ...p,
  disposition: dispositionOf(p),
}));

export function worldLeaderById(id: string): WorldLeader | undefined {
  return WORLD_LEADERS.find((l) => String(l.id) === id);
}

/** A fresh relationship with every world leader, for a new term. */
export function createDiplomacy(rng: Rng): Record<string, DiplomaticRelation> {
  const rel: Record<string, DiplomaticRelation> = {};
  for (const leader of WORLD_LEADERS) {
    const key = String(leader.id);
    rel[key] = {
      id: key,
      standing: Math.round(BASE_STANDING[leader.disposition] + rng.range(-6, 6)),
      since: 0,
      agreements: [],
    };
  }
  return rel;
}

export function relationFor(s: GameState, leaderId: string): DiplomaticRelation | undefined {
  return s.diplomacy?.[leaderId];
}

export function hasAgreement(rel: DiplomaticRelation | undefined, kind: string): boolean {
  return Boolean(rel?.agreements.includes(kind));
}

/** Adds an agreement if it isn't already active. */
export function recordAgreement(rel: DiplomaticRelation, kind: string): void {
  if (!rel.agreements.includes(kind)) rel.agreements.push(kind);
}

/** Nudges standing, clamped 0-100, and marks contact as just made. */
export function adjustStanding(rel: DiplomaticRelation, delta: number): void {
  rel.standing = Math.max(0, Math.min(100, rel.standing + delta));
  rel.since = 0;
}

/**
 * Standing drifts on its own the way a family bond does: an ally you ignore
 * cools off, an adversary you ignore doesn't warm up on its own, and every
 * relationship settles toward its own baseline without a call to hold it
 * there.
 */
export function driftDiplomacy(s: GameState): void {
  if (!s.diplomacy) return;
  for (const leader of WORLD_LEADERS) {
    const rel = s.diplomacy[String(leader.id)];
    if (!rel) continue;
    rel.since += 1;
    const base = BASE_STANDING[leader.disposition];
    const target = base - Math.min(rel.since, 8) * 2;
    rel.standing = Math.max(0, Math.min(100, rel.standing + (target - rel.standing) * 0.08));
  }
}
