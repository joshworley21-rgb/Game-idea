import { Rng } from "../core/rng.ts";
import { BLOCS } from "./blocs.ts";
import { childrenOf, spouseOf } from "./family.ts";
import { TERM_MONTHS } from "./state.ts";
import type { Ending, GameState } from "./types.ts";

export interface FailState {
  id: string;
  title: string;
  blurb: string;
}

/** Ways a presidency ends early. Checked after every month. */
export function checkFailState(s: GameState): FailState | null {
  if (s.personal.health <= 8) {
    return {
      id: "health",
      title: "Resignation on Medical Advice",
      blurb:
        "You collapsed in the corridor outside the Cabinet Room. The letter to the Speaker was signed from a hospital bed nine days later. Your Vice President finishes the term, and the doctors are careful to say you might have had years, had you been anyone else with any other job.",
    };
  }
  if (s.politics.scandal >= 85 && s.personal.integrity <= 25) {
    return {
      id: "impeachment",
      title: "Removed From Office",
      blurb:
        "The House impeached on two articles. The Senate, after eleven days of testimony and one very bad afternoon of documents, convicted on the first. You leave by the South Lawn with the helicopter rotors already turning and the country arguing about what it all meant before you have cleared the fence line.",
    };
  }
  if (s.dangerStreak >= 4) {
    return {
      id: "collapse",
      title: "A Government That Could Not Govern",
      blurb:
        "Four months of approval in the twenties, cities under curfew, and a party that stopped answering the phone. The delegation that came to the residence was polite and entirely unanimous. You announce you will not seek, and will not accept, a second term, and the rest of it is logistics.",
    };
  }
  return null;
}

/** Updates the rolling counter that triggers the collapse ending. */
export function updateDangerStreak(s: GameState): void {
  const inDanger = s.politics.approval < 24 && s.nation.unrest > 72;
  s.dangerStreak = inDanger ? s.dangerStreak + 1 : 0;
}

export interface LegacyBreakdown {
  economy: number;
  society: number;
  standing: number;
  politics: number;
  personal: number;
  total: number;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function scoreLegacy(s: GameState): LegacyBreakdown {
  const n = s.nation;
  const economy = clamp(
    50 + (n.growth - 2) * 9 - (n.unemployment - 4.5) * 6 - Math.max(0, n.inflation - 2.5) * 5 - Math.max(0, n.debtToGdp - 100) * 0.35,
  );
  const sectors = Object.values(n.sectors);
  const avgSector = sectors.reduce((a, b) => a + b, 0) / sectors.length;
  const society = clamp(avgSector * 0.75 + (100 - n.unrest) * 0.25);
  const standing = clamp(n.standing * 0.6 + n.security * 0.4);
  const politics = clamp(
    s.politics.approval * 0.5 +
      Math.min(30, (s.counters.billsPassed ?? 0) * 5) +
      s.personal.integrity * 0.2 -
      s.politics.scandal * 0.2,
  );
  const personal = clamp(
    s.personal.health * 0.3 + s.personal.marriage * 0.3 + s.personal.family * 0.3 + (100 - s.personal.stress) * 0.1,
  );
  const total = clamp(
    economy * 0.24 + society * 0.24 + standing * 0.16 + politics * 0.18 + personal * 0.18,
  );
  return { economy, society, standing, politics, personal, total };
}

export function gradeFor(score: number): string {
  if (score >= 88) return "A+";
  if (score >= 80) return "A";
  if (score >= 72) return "B+";
  if (score >= 64) return "B";
  if (score >= 56) return "C+";
  if (score >= 48) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Margin of the re-election result, in points. Positive means a win.
 *
 * Elections are won bloc by bloc. Turnout is not uniform: a constituency that
 * likes you turns out for you, and one that has given up on you stays home,
 * which cuts both ways.
 */
export function electionMargin(s: GameState): number {
  let margin = 0;
  for (const def of BLOCS) {
    const support = s.blocs[def.key] ?? 50;
    // Enthusiasm at the extremes, apathy in the middle.
    const turnout = 0.75 + Math.abs(support - 50) / 100;
    margin += def.weight * turnout * (support - 50) * 2.2;
  }
  return (
    margin +
    (s.nation.growth - 2) * 1.5 -
    Math.max(0, s.nation.inflation - 3) * 1.5 +
    (s.politics.party - 55) * 0.12 -
    s.politics.scandal * 0.1
  );
}

/** The constituencies that decided it, for the ending text. */
export function decisiveBlocs(s: GameState): { name: string; support: number }[] {
  return BLOCS.map((b) => ({ name: b.short, support: s.blocs[b.key] ?? 50 }))
    .sort((a, b) => Math.abs(b.support - 50) - Math.abs(a.support - 50))
    .slice(0, 3);
}

/** What the four years did to the people upstairs, by name. */
function personalCoda(s: GameState): string {
  const p = s.personal;
  const spouse = spouseOf(s);
  const kids = childrenOf(s);
  const them = spouse?.name ?? "your spouse";
  const kidNames =
    kids.length === 2
      ? `${kids[0].name} and ${kids[1].name}`
      : kids.map((k) => k.name).join(", ") || "your children";
  // The child who took the worst of it gets named specifically.
  const worst = [...kids].sort((a, b) => a.bond - b.bond)[0];

  if (p.marriage < 25 && p.family < 30) {
    return `You go home to a house where the arguments have already been had and nobody lives with you any more. ${them} left the residence before you did. ${kidNames} call on birthdays. The presidency took the whole family, and it took it in pieces small enough that you never had to notice on any particular Tuesday.`;
  }
  if (p.marriage < 30) {
    return `The separation from ${them} is announced through a lawyer three months after you leave. It is reported respectfully and briefly, and you find you cannot argue with a single line of it.`;
  }
  if (p.family < 30) {
    return `${kidNames} are polite at the library dedication. They are polite at Thanksgiving.${worst ? ` ${worst.name} is polite in the way that takes practice.` : ""} You spend the rest of your life trying to get back to a version of them you last saw before the motorcade.`;
  }
  if (p.health < 35) {
    return `You spend most of the first year out of office in cardiology waiting rooms${p.condition ? `, where ${p.condition} finally gets the attention it wanted four years ago` : ""}. The job was worth it, you tell people, and about half the time you believe it. ${them} drives you to the appointments.`;
  }
  if (p.marriage > 70 && p.family > 70 && p.health > 60) {
    return `You walk out of the building with ${them}, with ${kidNames}, and with most of your health intact. Almost nobody manages all three. It is, quietly, the achievement you are proudest of.`;
  }
  return `You leave tired, still married to ${them}, and mostly on speaking terms with ${kidNames} — which the historians will never score and your family will never forget.`;
}

function nationCoda(s: GameState, legacy: LegacyBreakdown): string {
  if (legacy.total >= 78) {
    return "The country you hand over is measurably better than the one you were given: working, solvent, and calmer than it has any right to be. Your successor will spend eight years being compared to you, and will not enjoy it.";
  }
  if (legacy.total >= 60) {
    return "A solid term. Some of it worked, some of it stalled in the Senate, and the parts that worked will be attributed to the economy for at least a decade.";
  }
  if (legacy.total >= 45) {
    return "A middling presidency: some real accomplishments, an unresolved deficit, and a country that mostly stayed on its feet. The verdict will keep moving for thirty years.";
  }
  if (s.nation.unrest > 60) {
    return "You leave a country angrier than you found it, with problems that were manageable in your first year and are not manageable now.";
  }
  return "The consensus forms early and hardens: a term spent reacting, with little of it standing five years later.";
}

export function buildEnding(s: GameState, rng: Rng, fail: FailState | null): Ending {
  const legacy = scoreLegacy(s);
  if (fail) {
    return {
      id: fail.id,
      title: fail.title,
      blurb: `${fail.blurb}\n\n${personalCoda(s)}`,
      reelected: false,
      legacy: Math.round(legacy.total * 0.6),
      grade: gradeFor(legacy.total * 0.6),
    };
  }

  const ran = s.runningForReelection;
  const margin = electionMargin(s) + rng.range(-4, 4);
  const reelected = ran ? margin > 0 : false;
  const parts: string[] = [];

  if (!ran) {
    parts.push(
      "You announced in the spring that you would not seek a second term. The room went quiet in a way that told you a lot of people had been waiting to hear it, and a few had not.",
    );
  } else if (reelected) {
    parts.push(
      margin > 8
        ? `You win a second term comfortably, carrying states your own campaign had written off in the summer.`
        : `You win a second term by a margin thin enough that three counties spend a week counting. It counts the same.`,
    );
  } else {
    parts.push(
      margin > -4
        ? "You lose by a point and a half. The concession call is short and the drive back from the hotel is very long."
        : "You lose, and not narrowly. The country decided somewhere around the middle of year three and never really revisited it.",
    );
  }

  // Name the coalition that decided it: an election is people, not a number.
  const decisive = decisiveBlocs(s);
  const won = decisive.filter((b) => b.support >= 55).map((b) => b.name);
  const lost = decisive.filter((b) => b.support < 45).map((b) => b.name);
  if (won.length || lost.length) {
    const held = won.length ? `${won.join(" and ")} stayed with you` : "";
    const gone = lost.length ? `${lost.join(" and ")} did not` : "";
    parts.push([held, gone].filter(Boolean).join(", and ") + ".");
  }

  parts.push(nationCoda(s, legacy));
  parts.push(personalCoda(s));

  const title = !ran
    ? "One Term, By Choice"
    : reelected
      ? "Four More Years"
      : "A Single Term";

  return {
    id: reelected ? "reelected" : "single-term",
    title,
    blurb: parts.join("\n\n"),
    reelected: ran ? reelected : null,
    legacy: Math.round(legacy.total),
    grade: gradeFor(legacy.total),
  };
}

export function isTermOver(s: GameState): boolean {
  return s.month > TERM_MONTHS;
}
