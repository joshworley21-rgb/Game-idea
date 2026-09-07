import { OFFICES, TAG_DOMAIN } from "./cabinet.ts";
import { FACTION_BY_KEY, billAxis } from "./congress.ts";
import type { Bill, Choice, Crisis, GameState, Secretary } from "./types.ts";

/**
 * What the cabinet thinks, before you decide. Not a rules engine telling you
 * the right answer — one person's read, coloured by how good they are at the
 * job and how much they still trust you with a straight answer.
 */

export type AdviceStance = "support" | "lean-support" | "torn" | "lean-oppose" | "oppose";

export interface CabinetAdvice {
  secretary: Secretary | null;
  stance: AdviceStance;
  line: string;
  /** The option this secretary would take, when one reads as the safer bet. */
  favoredChoiceId?: string;
}

const STANCE_VERB: Record<AdviceStance, string> = {
  support: "urges you to sign it",
  "lean-support": "leans toward yes",
  torn: "calls it a genuine toss-up",
  "lean-oppose": "has real reservations",
  oppose: "wants nothing to do with it",
};

function stanceFromAffinity(affinity: number): AdviceStance {
  if (affinity > 0.5) return "support";
  if (affinity > 0.12) return "lean-support";
  if (affinity > -0.12) return "torn";
  if (affinity > -0.5) return "lean-oppose";
  return "oppose";
}

function secretaryFor(s: GameState, domain: string | undefined): Secretary | null {
  const office = OFFICES.find((o) => o.domain === domain) ?? OFFICES.find((o) => o.domain === "politics");
  if (!office) return null;
  return s.cabinet?.find((c) => c.office === office.key) ?? null;
}

/** Competence and loyalty colour the delivery, never the recommendation itself. */
function hedge(secretary: Secretary, base: string): string {
  if (secretary.competence >= 72) return `${base} They have clearly done the homework.`;
  if (secretary.competence <= 36) return `${base} Weigh that against the fact this isn't their strongest ground.`;
  if (secretary.loyalty <= 30) return `${base} Though these days they tell you as little as they can get away with.`;
  return base;
}

export function billAdvice(s: GameState, bill: Bill): CabinetAdvice {
  const secretary = secretaryFor(s, bill.domain);
  if (!secretary) {
    return { secretary: null, stance: "torn", line: "No one in the cabinet claims this file. You're reading the room yourself." };
  }
  const factionDef = FACTION_BY_KEY.get(secretary.faction);
  const affinity = factionDef ? 1 - Math.abs(billAxis(bill.ideology) - factionDef.axis) : 0;
  const stance = stanceFromAffinity(affinity);
  const base = `${secretary.name}, ${secretary.title}, ${STANCE_VERB[stance]}.`;
  return { secretary, stance, line: hedge(secretary, base) };
}

export function crisisAdvice(s: GameState, crisis: Crisis): CabinetAdvice {
  const domain = crisis.tags.map((t) => TAG_DOMAIN[t]).find((d): d is string => Boolean(d));
  const secretary = secretaryFor(s, domain);
  if (!secretary) {
    return { secretary: null, stance: "torn", line: "This one doesn't sit in any department's lane. It lands on your desk alone." };
  }
  const comp = secretary.competence;
  const read =
    comp >= 72
      ? "This is manageable if we move fast — I'll want the room for it."
      : comp <= 36
        ? "I won't pretend we're ready for this."
        : "It's close to a coin flip from where I sit.";
  const favoredChoiceId = safestChoice(crisis.choices)?.id;
  const base = `${secretary.name}, ${secretary.title}: "${read}"`;
  return {
    secretary,
    stance: comp >= 72 ? "support" : comp <= 36 ? "oppose" : "torn",
    line: hedge(secretary, base),
    favoredChoiceId,
  };
}

/** The Treasury's read on the budget you're about to sign, deficit as a percent of GDP. */
export function budgetAdvice(s: GameState, deficitPctGdp: number): CabinetAdvice {
  const secretary = secretaryFor(s, "economy");
  if (!secretary) {
    return { secretary: null, stance: "torn", line: "Nobody is minding the books for you this month." };
  }
  const stance: AdviceStance =
    deficitPctGdp > 6 ? "oppose" : deficitPctGdp > 3 ? "lean-oppose" : deficitPctGdp > -1 ? "torn" : "support";
  const read =
    deficitPctGdp > 6
      ? "This is not sustainable. Something has to give."
      : deficitPctGdp > 3
        ? "We can carry this, but I would rather not carry it long."
        : deficitPctGdp > -1
          ? "The books are roughly where they need to be."
          : "We're running ahead of ourselves. There's room here if you want to spend it.";
  const base = `${secretary.name}, ${secretary.title}: "${read}"`;
  return { secretary, stance, line: hedge(secretary, base) };
}

function safestChoice(choices: Choice[]): Choice | undefined {
  let best: Choice | undefined;
  let bestRisk = Infinity;
  for (const c of choices) {
    const risk = c.risk ?? 0;
    if (risk < bestRisk) {
      best = c;
      bestRisk = risk;
    }
  }
  return best;
}
