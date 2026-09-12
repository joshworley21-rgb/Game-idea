import { applyEffects } from "./effects.ts";
import { attend, mostNeglected } from "./family.ts";
import { tickCabinet, replaceSecretary } from "./cabinet.ts";
import { applyMidtermSwing } from "./congress.ts";
import { pushNews } from "./news.ts";
import { calendar } from "./state.ts";
import type { MonthReport } from "./sim.ts";
import type { Rng } from "../core/rng.ts";
import type { GameState } from "./types.ts";

/**
 * The things that happen at the end of a month, outside the economic model.
 *
 * These were private methods on the engine. They are plain functions over the
 * state here, because the engine had grown to the point where the month flow
 * was a third of the file and the simulation was hard to read in one sitting.
 */

/** The cabinet's month: resignations and leaks. */
export function runCabinet(s: GameState, rng: Rng, report: MonthReport): void {
  for (const event of tickCabinet(s, rng)) {
    if (event.kind === "resigned") {
      const successor = replaceSecretary(rng, s.cabinet, event.person.office);
      applyEffects(s, {
        "politics.capital": -5,
        "politics.approval": -1.4,
        "politics.media": -3,
        "personal.stress": 5,
      });
      s.counters.resignations = (s.counters.resignations ?? 0) + 1;
      s.log.unshift({
        month: s.month,
        text: `${event.person.title} ${event.person.name} resigns; ${successor.name} sworn in.`,
        kind: "system",
      });
      report.notes.push(`${event.person.name} is gone. ${successor.name} takes the department.`);
      pushNews(s, [
        {
          month: s.month,
          headline: `${event.person.name} resigns as ${event.person.title}, citing "differences of direction"`,
          source: "The Beacon",
          tone: "bad",
        },
      ]);
    } else {
      event.person.loyalty = Math.min(100, event.person.loyalty + 6); // the leak vents the pressure
      applyEffects(s, { "politics.scandal": 7, "politics.media": -5, "personal.stress": 4 });
      s.counters.leaks = (s.counters.leaks ?? 0) + 1;
      s.log.unshift({
        month: s.month,
        text: `A private meeting with ${event.person.name} appears in print.`,
        kind: "system",
      });
      report.notes.push(`Someone in the room is talking to the press.`);
      pushNews(s, [
        {
          month: s.month,
          headline: `Leaked account of Oval Office meeting contradicts White House line`,
          source: "The Beacon",
          tone: "bad",
        },
      ]);
    }
  }
}

export interface BodyEvent {
  title: string;
  text: string;
  tone: "good" | "bad";
}

/**
 * The body's month. A full physical is what finds a condition before it finds
 * you; left long enough, exhaustion and a bad heart collect on their own
 * terms, and the country watches you do it.
 */
export function runBody(s: GameState, rng: Rng, report: MonthReport): BodyEvent | null {
  const p = s.personal;

  // The physician cannot diagnose what you never let them look at.
  const lastPhysical = s.actionHistory["physical"];
  const looked = lastPhysical !== undefined && s.month - lastPhysical <= 2;
  if (!p.condition && looked) {
    const risk =
      (Math.max(0, p.age - 58) * 0.02 +
        Math.max(0, 55 - p.fitness) * 0.006 +
        Math.max(0, p.sleepDebt - 40) * 0.004) *
      (p.health < 55 ? 1.6 : 1);
    if (rng.chance(Math.min(0.6, risk))) {
      p.condition = rng.pick([
        "atrial fibrillation",
        'hypertension the letter called "managed"',
        "a coronary narrowing they want watched",
        "type 2 diabetes",
      ]);
      applyEffects(s, { "personal.stress": 8, "politics.media": -2 });
      s.log.unshift({ month: s.month, text: `Walter Reed finds ${p.condition}.`, kind: "personal" });
      report.notes.push(`The physical found something: ${p.condition}.`);
      return {
        title: "The Physical",
        text: `The letter the networks read out is two pages. The one your physician hands you privately is longer, and it names ${p.condition}. There is a plan. The plan involves the schedule.`,
        tone: "bad",
      };
    }
  }

  // An episode: exhaustion, a heart, a body that has had enough.
  const episodeRisk =
    Math.max(0, p.sleepDebt - 62) * 0.004 +
    Math.max(0, 45 - p.health) * 0.005 +
    (p.condition ? 0.012 : 0) +
    Math.max(0, p.stress - 78) * 0.003;
  if (episodeRisk > 0 && rng.chance(Math.min(0.14, episodeRisk))) {
    const kind = p.condition
      ? "an episode the cardiology team had warned you about"
      : "a collapse in the residence corridor at four in the morning";
    applyEffects(s, {
      "personal.health": -9,
      "personal.stress": -14,
      "personal.sleepDebt": -35,
      "politics.capital": -8,
      "politics.approval": -2,
    });
    s.counters.healthEpisodes = (s.counters.healthEpisodes ?? 0) + 1;
    // A week at Walter Reed is a week you do not get back.
    s.ap = Math.max(0, s.ap - 1);
    s.log.unshift({
      month: s.month,
      text: "A week at Walter Reed. The Vice President signs three things.",
      kind: "personal",
    });
    report.notes.push("You lost a week of the month to a hospital bed.");
    pushNews(s, [
      {
        month: s.month,
        headline: "President admitted to Walter Reed; White House says tests are precautionary",
        source: "Channel 8 Nightly",
        tone: "bad",
      },
    ]);
    return {
      title: "Walter Reed",
      text: `It is ${kind}. You wake up with a cannula in your arm and your chief of staff already in the room. The country is told it was precautionary. Your family is told the truth.`,
      tone: "bad",
    };
  }
  return null;
}

/**
 * Upstairs. Nobody schedules this, so the month says once, plainly, who has
 * been waiting longest — and the country eventually notices a first family
 * that is never in the same room.
 */
export function runResidence(s: GameState, report: MonthReport): void {
  const waiting = mostNeglected(s);
  if (waiting && waiting.since >= 4) {
    report.notes.push(`${waiting.name} has been waiting ${waiting.since} months for an evening.`);
  }
  // A visibly absent family is a story, and a visibly close one is an asset.
  const closeness = (s.personal.marriage + s.personal.family) / 2;
  if (closeness < 38) {
    applyEffects(s, { "blocs.traditionalists": -0.9, "blocs.suburban": -0.5, "politics.media": -0.4 });
  } else if (closeness > 74) {
    applyEffects(s, { "blocs.traditionalists": 0.5, "blocs.suburban": 0.4, "politics.media": 0.3 });
  }
}

export interface MidtermResult {
  swing: number;
  won: boolean;
}

/** The midterms. The president's party almost always loses ground. */
export function runMidterms(s: GameState, rng: Rng): MidtermResult {
  const swing = (s.politics.approval - 50) * 0.55 + rng.range(-4, 4) - 4;
  applyEffects(s, { "politics.house": swing, "politics.senate": swing * 0.7 });
  // Seats actually change hands between the factions.
  applyMidtermSwing(s, swing);
  const won = swing > 0;
  s.log.unshift({
    month: s.month,
    text: `Midterm elections: ${won ? "gains" : "losses"} of ${Math.abs(swing).toFixed(1)} points.`,
    kind: "system",
  });
  pushNews(s, [
    {
      month: s.month,
      headline: won
        ? "President's party defies history and holds the line at the midterms"
        : "Voters deliver a rebuke: opposition picks up seats in both chambers",
      source: "Channel 8 Nightly",
      tone: won ? "good" : "bad",
    },
  ]);
  return { swing, won };
}

/** An unsigned budget means a continuing resolution: last year's numbers. */
export function runStopgap(s: GameState): void {
  s.flags[`budget${s.month}`] = true;
  applyEffects(s, {
    "politics.approval": -2.5,
    "politics.capital": -4,
    "nation.unrest": 2,
    "personal.stress": 5,
  });
  s.log.unshift({
    month: s.month,
    text: "No budget signed; the government runs on a continuing resolution.",
    kind: "policy",
  });
  pushNews(s, [
    {
      month: s.month,
      headline: "Government funded by stopgap again as budget talks stall",
      source: "Capitol Wire",
      tone: "bad",
    },
  ]);
}

/** The label for a midterm outcome, for the toast. */
export function midtermText(result: MidtermResult): string {
  return result.won
    ? "Your party holds. Nobody in this building can quite believe it, including you."
    : "Your party loses seats in both chambers. Every vote from here is harder than the last one was.";
}

export { calendar, attend };
