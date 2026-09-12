import type { GameState } from "./types.ts";

/**
 * The Chief of Staff.
 *
 * She is the one fixed person in the building. The cabinet is drawn from a
 * seed, the family is drawn from a seed, the crises are drawn from a seed —
 * but Ruth Ellery is always Ruth Ellery, because she is the voice that
 * teaches the job and a teacher who changes every run teaches nothing.
 *
 * She has been in the West Wing since she was twenty-six. She has served
 * four presidents and watched two of them lose. She ran your transition
 * because nobody else could hold the egos in the room. She is not warm and
 * she is not cold; she is competent, and she has decided you are worth her
 * time until you prove otherwise.
 *
 * Her register is dry, specific and slightly tired. She never says "you
 * should". She says "here is what happens if you don't".
 */

export const CHIEF_NAME = "Ruth Ellery";
export const CHIEF_TITLE = "Chief of Staff";

/** How much she is still holding your hand, by month. */
export type GuidanceLevel = "full" | "settled" | "distant";

/**
 * Full guidance for the first three months, then she steps back to the
 * morning brief and the things that actually need her. She never disappears
 * entirely — a president with no chief of staff is not a president.
 */
export function guidanceLevel(s: GameState): GuidanceLevel {
  if (s.month <= 3) return "full";
  if (s.month <= 8) return "settled";
  return "distant";
}

/**
 * A line from her, chosen by what is actually happening. The first match
 * wins, so the list is ordered from most urgent to least.
 *
 * These are the things she says at the top of the day. They are not hints —
 * they are her reading the room out loud, which is the job.
 */
interface Briefing {
  id: string;
  when: (s: GameState) => boolean;
  /** Only offered at these guidance levels. Absent means always. */
  levels?: GuidanceLevel[];
  text: string;
}

const BRIEFINGS: Briefing[] = [
  // ------------------------------------------------------------- the opening
  {
    id: "first-day",
    when: (s) => s.month === 1 && !s.flags["briefed:first-day"],
    levels: ["full"],
    text:
      "The desk is yours as of noon. Everything on it was somebody else's problem yesterday and is yours now. " +
      "I have cleared the first month so you can find your feet — three things a month is what a person can actually do, " +
      "and anyone who tells you otherwise is selling something.",
  },
  {
    id: "first-month-cabinet",
    when: (s) => s.month === 1 && !s.flags["briefed:cabinet"],
    levels: ["full"],
    text:
      "Your cabinet is confirmed and in the building. Six people, and you did not pick most of them — " +
      "that is what a transition is. Go and meet them before you need them. " +
      "The West Wing is where you will find them.",
  },
  {
    id: "first-month-address",
    when: (s) => s.month === 1 && !s.flags["briefed:address"],
    levels: ["full"],
    text:
      "The House expects you this month. A new president addresses a joint session in the first weeks — " +
      "it is not a legal requirement, it is a courtesy, and skipping it is a statement. " +
      "Whatever you say in that room sets what the next year is about. Choose it carefully.",
  },

  // ------------------------------------------------------------ the standing
  {
    id: "no-actions",
    when: (s) => s.ap === 0 && s.pendingCrises.length === 0 && s.pendingArc === null,
    text:
      "You are out of hours. There is nothing left on today that cannot wait until tomorrow, " +
      "and the ones that cannot wait will find you anyway. End the month when you are ready.",
  },
  {
    id: "crisis-waiting",
    when: (s) => s.pendingCrises.length > 0,
    text:
      "There is something on your desk that will not keep. I have put it in front of you because " +
      "the alternative was putting it in front of somebody else, and that is how these become other people's decisions.",
  },
  {
    id: "arc-waiting",
    when: (s) => s.pendingArc !== null,
    text:
      "This one is not a crisis. This one is something you did, arriving. " +
      "I would rather you dealt with it now than let it sit — they always get worse sitting.",
  },

  // ------------------------------------------------------------- the country
  {
    id: "unrest-high",
    when: (s) => s.nation.unrest > 62,
    text:
      "The streets are not weather any more. Somebody is organising them, and organised people have demands, " +
      "and demands are a thing you can actually answer. That is better news than it sounds.",
  },
  {
    id: "approval-low",
    when: (s) => s.politics.approval < 36,
    text:
      "You are at " + "thirty-something" + " in the polls and your own party has started taking meetings without you. " +
      "I have seen this before. It is survivable, but not by doing nothing.",
  },
  {
    id: "scandal-high",
    when: (s) => s.politics.scandal > 45,
    text:
      "The counsel's office is getting calls it is not answering. Whatever this is, it is going to be a story " +
      "whether or not it is true, and the only question left is who tells it first.",
  },
  {
    id: "capital-empty",
    when: (s) => s.politics.capital < 18,
    text:
      "You have spent your goodwill down to nothing. Nobody on the Hill owes you a vote this month. " +
      "That is not a crisis, it is a fact, and it should shape what you attempt.",
  },

  // -------------------------------------------------------------- the person
  {
    id: "stress-high",
    when: (s) => s.personal.stress > 72,
    text:
      "You have not slept properly in three weeks and it is starting to show in the room. " +
      "I have moved two things off tomorrow. Do not argue with me about it.",
  },
  {
    id: "health-low",
    when: (s) => s.personal.health < 45,
    text:
      "The physician has asked me to raise something with you and I am raising it. " +
      "The Private Study is not a reward, it is maintenance, and you are overdue.",
  },
  {
    id: "family-neglected",
    when: (s) => (s.family ?? []).some((m) => m.since >= 5),
    text:
      "Somebody upstairs has not seen you in months. I am not going to tell you who — " +
      "you know who. The Residence is on your list whether or not you put it there.",
  },
  {
    id: "family-strain",
    when: (s) => (s.family ?? []).some((m) => (m.strain?.severity ?? 0) > 55),
    text:
      "There is something happening at home that you have been told about and have not acted on. " +
      "I would not raise it if it were going to keep.",
  },

  // ------------------------------------------------------------- the machine
  {
    id: "cabinet-loyalty",
    when: (s) => (s.cabinet ?? []).some((c) => c.loyalty < 32),
    text:
      "One of your secretaries has stopped returning my calls, which means they have stopped returning yours. " +
      "I would find out why before they tell somebody else instead.",
  },
  {
    id: "threads-running",
    when: (s) => s.threads.length >= 2,
    text:
      "You have " + "several" + " things running at once and none of them are finished. " +
      "That is normal. What is not normal is letting all of them run into the election.",
  },
  {
    id: "budget-month",
    when: (s) => (s.month - 1) % 12 === 0 && s.month > 1,
    text:
      "It is appropriations month. The Cabinet Table has the arithmetic and nobody enjoys it. " +
      "A frozen budget is a cut — the numbers move whether you do or not.",
  },
  {
    id: "election-near",
    when: (s) => s.month >= 40 && s.month <= 46,
    text:
      "We are inside the last stretch. Everything you do from here is read as a campaign decision, " +
      "including the things that are not. I would rather you knew that than found out.",
  },

  // ------------------------------------------------------------- the default
  {
    id: "quiet",
    when: () => true,
    text:
      "Nothing is on fire this morning. That is rarer than it sounds and it does not last. " +
      "Use it on something that will still matter in a year.",
  },
];

/** The line she opens the month with, given the state. */
export function morningBriefing(s: GameState): { id: string; text: string } {
  const level = guidanceLevel(s);
  for (const b of BRIEFINGS) {
    if (b.levels && !b.levels.includes(level)) continue;
    if (b.when(s)) return { id: b.id, text: b.text };
  }
  return { id: "quiet", text: BRIEFINGS[BRIEFINGS.length - 1].text };
}

/**
 * What she says when you do something she has an opinion about. Keyed by the
 * action or choice id, so a decision can carry her reaction with it.
 *
 * These are deliberately sparse. She comments on the things that matter and
 * stays quiet about the rest, which is what makes the comments land.
 */
export const CHIEF_REACTIONS: Record<string, string> = {
  "executive-order":
    "That will hold until a judge looks at it. Some of them do not, and you will not know which until they do.",
  veto:
    "You have made an enemy of the Speaker and a hero of your own backbench. Both of those are expensive.",
  pardon:
    "Nobody will thank you for that and four hundred families will. I would take that trade.",
  fundraiser:
    "Eleven million is eleven million. I have written down who was in the room, in case it matters later.",
  reshuffle:
    "You have moved the dead weight and made four people who know where the bodies are buried very unhappy.",
  summit:
    "Nine time zones for a communiqué. It was worth it, but you will pay for it next week.",
  "trade-deal":
    "Two states will hold that against you for the rest of your life. The other forty-eight will not notice.",
  address:
    "Forty-one million people. You had their attention for eleven minutes and you spent it on the thing you chose.",
  rally:
    "That was for your people and nobody else. Fine. Just do not mistake it for the country.",
  "camp-david":
    "Two days with no staff. I have moved everything. Do not check your phone — I will know.",
  sleep:
    "Good. You have been running on nothing and it was starting to show in the room.",
  therapy:
    "I have kept it off the schedule. Nobody in this building needs to know, and nobody will.",
  "physical":
    "The letter reads well. That is the point of it, and it is also true.",
};

/** Her reaction to a decision, if she has one. */
export function chiefReaction(id: string): string | undefined {
  return CHIEF_REACTIONS[id];
}

/**
 * The things she will not let you forget. These are the standing obligations
 * of the office, and she raises them until they are dealt with.
 */
export interface Obligation {
  id: string;
  label: string;
  detail: string;
  /** True once it has been satisfied. */
  done: (s: GameState) => boolean;
  /** Only raised from this month. */
  from: number;
}

export const OBLIGATIONS: Obligation[] = [
  {
    id: "address-house",
    label: "Address the joint session",
    detail:
      "A new president speaks to Congress in the first weeks. It sets the year.",
    from: 1,
    done: (s) => Boolean(s.flags["addressed:house"]),
  },
  {
    id: "meet-cabinet",
    label: "Meet your cabinet",
    detail: "Six people run the departments. You have not met most of them.",
    from: 1,
    done: (s) => Boolean(s.flags["met:cabinet"]),
  },
  {
    id: "first-budget",
    label: "Sign an appropriations bill",
    detail: "The government runs on money Congress has to vote for.",
    from: 1,
    done: (s) => Boolean(s.flags["budget:signed"]),
  },
];

/** The obligations still outstanding, in the order she would raise them. */
export function outstandingObligations(s: GameState): Obligation[] {
  return OBLIGATIONS.filter((o) => s.month >= o.from && !o.done(s));
}
