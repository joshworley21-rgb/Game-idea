import type { GameState, Secretary } from "./types.ts";

/**
 * Why a secretary is in the room.
 *
 * Competence and loyalty say how good someone is and how long they will
 * stay. Neither says anything about who they are, and a cabinet of five
 * names carrying two numbers each is a spreadsheet with faces on it — the
 * difference between Margaret Halloran and Yusuf Okonkwo was which random
 * integers they drew.
 *
 * A temperament is the missing third thing: what brought them here, which
 * is also what would drive them out. It is drawn from the seed alongside the
 * numbers, and it is not decoration — it decides what erodes them, how much
 * they bring to a crisis in their lane, and whether the day they stop
 * believing in you ends with a resignation letter or a reporter's phone
 * number.
 *
 * The Chief of Staff has no temperament. She is written rather than drawn,
 * and `chief.ts` is where her voice lives.
 */

export type TemperamentKey =
  | "believer"
  | "operator"
  | "institutionalist"
  | "rival"
  | "friend"
  | "technocrat";

export interface Temperament {
  key: TemperamentKey;
  /** How the roster names them: "a true believer". */
  label: string;
  /** One line on who they are, under their name. */
  note: string;

  /**
   * Multipliers on the cabinet's base erosion coefficients, not absolute
   * rates. Expressing them this way is what keeps the temperaments from
   * changing how fast a cabinet turns over on average: each set averages
   * about 1, so a cabinet still loses roughly what it always did, and what
   * changes is *which* of them goes and *why*.
   */
  /** Flat monthly drift. */
  baseDrift: number;
  /** How hard your unpopularity lands on them. */
  approvalWeight: number;
  /** How hard scandal lands on them. */
  scandalWeight: number;
  /** How hard civil unrest lands on them. */
  unrestWeight: number;
  /**
   * Loyalty that ordinary unpopularity cannot take them below. Somebody who
   * is here for the work does not stop turning up because a poll moved, so
   * the flat drift and the approval term stop here.
   *
   * Scandal and unrest are not ordinary and go straight through it: an
   * institutionalist resigning over something real is the most familiar
   * cabinet resignation there is, and a floor that made that impossible
   * would be modelling the wrong thing.
   */
  floor: number;
  /** Of the people who break, the share who go to a reporter rather than resign. */
  leakChance: number;
  /** Added to their competence on a crisis in their own department. */
  crisisEdge: number;

  /** What they say when they are still with you. */
  linesLoyal: string[];
  /** What they say once they are not. */
  linesSour: string[];
  /** The line under the news when they go. */
  parting: string;
}

export const TEMPERAMENTS: Record<TemperamentKey, Temperament> = {
  // Here for the agenda. Will follow you into a fight and out of a compromise.
  believer: {
    key: "believer",
    label: "a true believer",
    note: "Came for the agenda, not the job. Reads every compromise as a retreat.",
    baseDrift: 0.9,
    approvalWeight: 0.6,
    scandalWeight: 1.3,
    unrestWeight: 0.8,
    floor: 22,
    leakChance: 0.2,
    crisisEdge: 0,
    linesLoyal: [
      "says the thing you are all avoiding, and says it first",
      "has rewritten the proposal overnight, again, and it is better",
    ],
    linesSour: [
      "has stopped arguing with you, which is worse than when they did",
      "asks, carefully, what the plan was supposed to have been",
    ],
    parting: "leaves saying the administration lost its nerve, and is quoted saying it",
  },

  // Here for themselves. Excellent while you are winning.
  operator: {
    key: "operator",
    label: "an operator",
    note: "Was somebody before this and intends to be somebody after. Counts the room.",
    baseDrift: 1.25,
    approvalWeight: 1.8,
    scandalWeight: 1.2,
    unrestWeight: 0.9,
    floor: 0,
    leakChance: 0.78,
    crisisEdge: -5,
    linesLoyal: [
      "agrees with whatever the room has decided, a half-second after it decides",
      "has already told three reporters this was your idea",
    ],
    linesSour: [
      "is taking meetings that are not on the schedule",
      "has begun saying “the President's decision” where they used to say “we”",
    ],
    parting: "resigns to spend time with a family nobody has met, and takes the file with them",
  },

  // Career. Was here before you and expects to be here after.
  institutionalist: {
    key: "institutionalist",
    label: "an institutionalist",
    note: "Thirty years in the building. Serves the office, and is not confused about which one.",
    baseDrift: 0.75,
    approvalWeight: 0.2,
    scandalWeight: 2.0,
    unrestWeight: 0.7,
    floor: 30,
    leakChance: 0.1,
    crisisEdge: 7,
    linesLoyal: [
      "notes, without emphasis, that this has been tried twice before",
      "has the precedent, the memo and the date it went wrong",
    ],
    linesSour: [
      "has started putting things in writing",
      "asks for the instruction in a signed document, which is not a question",
    ],
    parting: "resigns on principle, in a letter the whole country reads",
  },

  // Wanted the job you have.
  rival: {
    key: "rival",
    label: "a rival",
    note: "Wanted this desk, nearly got it, and took the department instead.",
    baseDrift: 1.35,
    approvalWeight: 1.6,
    scandalWeight: 0.9,
    unrestWeight: 1.1,
    floor: 0,
    leakChance: 0.7,
    crisisEdge: 4,
    linesLoyal: [
      "disagrees with you fluently, in front of people, and is often right",
      "runs their department like a campaign, because it is one",
    ],
    linesSour: [
      "has a speech scheduled in a state that votes early",
      "praised you this morning in a way that will be clipped",
    ],
    parting: "resigns without warning, and books the Sunday shows for the weekend",
  },

  // Knew you before any of this.
  friend: {
    key: "friend",
    label: "an old friend",
    note: "Knew you before the motorcade. Tells you the truth and takes the hit for it.",
    baseDrift: 0.7,
    approvalWeight: 0.4,
    scandalWeight: 0.7,
    unrestWeight: 0.7,
    floor: 34,
    leakChance: 0,
    crisisEdge: -3,
    linesLoyal: [
      "asks how you are, and waits for the real answer",
      "stays behind after the room empties, the way they always have",
    ],
    linesSour: [
      "looks tired in a way that is about this building rather than the hours",
      "has stopped saying the thing they used to say to you in private",
    ],
    parting: "steps down quietly for health reasons, and means it",
  },

  // Here for the work. Politics is weather.
  technocrat: {
    key: "technocrat",
    label: "a technocrat",
    note: "Here for the work. Your approval rating is weather, and they brought a coat.",
    baseDrift: 0.85,
    approvalWeight: 0.3,
    scandalWeight: 0.8,
    unrestWeight: 2.2,
    floor: 26,
    leakChance: 0.28,
    crisisEdge: 9,
    linesLoyal: [
      "has brought a chart nobody asked for and everybody needed",
      "answers the question that was asked, which startles the room",
    ],
    linesSour: [
      "has stopped bringing the chart",
      "gives you the number and no longer tells you what it means",
    ],
    parting: "returns to the university, and publishes within the year",
  },
};

export const TEMPERAMENT_KEYS = Object.keys(TEMPERAMENTS) as TemperamentKey[];

/**
 * The first secretary of a given temperament, if you have one.
 *
 * Arcs use this to find the person they are about: an arc written about a
 * rival in the cabinet only fires in the runs that drew one, which is what
 * makes the seed produce different stories rather than the same five.
 */
export function secretaryWith(s: GameState, key: TemperamentKey): Secretary | undefined {
  return s.cabinet?.find((c) => c.office !== "chief" && c.temperament === key);
}

/** The temperament a secretary holds, with a safe default for old saves. */
export function temperamentOf(person: Secretary): Temperament {
  return TEMPERAMENTS[person.temperament as TemperamentKey] ?? TEMPERAMENTS.technocrat;
}

/**
 * The cabinet's base erosion coefficients. Every temperament is a set of
 * multipliers on these, so this is the one place the overall rate lives.
 */
const BASE = { drift: 0.5, approval: 0.075, scandal: 0.04, unrest: 0.025 };

/**
 * How much loyalty this person loses this month, split into two kinds.
 *
 * Everybody erodes — loyalty never rises on its own, which is the rule the
 * cabinet has always run on. What the temperament changes is *what* erodes
 * them: an operator reads the polls, an institutionalist does not care about
 * the polls at all and reads the scandal column, and a technocrat looks out
 * of the window at the country.
 *
 * `ambient` is the slow stuff — the flat drift, your polling, the years — and
 * it stops at the temperament's floor. `acute` is scandal and unrest, and it
 * goes through the floor, because those are the things that actually make
 * somebody who likes the job quit it.
 */
export function loyaltyErosion(
  person: Secretary,
  s: GameState,
): { ambient: number; acute: number } {
  const t = temperamentOf(person);

  // A party that is behind you shelters everybody a little, and four years in
  // this building wears on everybody the same.
  const shelter = Math.min(0.45, Math.max(0, s.politics.party - 52) * 0.035);
  const fatigue = person.months * 0.007;

  const ambient =
    BASE.drift * t.baseDrift +
    Math.max(0, 48 - s.politics.approval) * BASE.approval * t.approvalWeight +
    fatigue -
    shelter;

  const acute =
    s.politics.scandal * BASE.scandal * t.scandalWeight +
    Math.max(0, s.nation.unrest - 55) * BASE.unrest * t.unrestWeight;

  return { ambient: Math.max(0, ambient), acute: Math.max(0, acute) };
}

/**
 * A line about where this person is with you, for the roster.
 *
 * It is drawn from the temperament rather than the numbers, so the reason a
 * secretary is drifting reads as a person rather than a falling bar.
 */
export function temperamentLine(person: Secretary): string {
  const t = temperamentOf(person);
  const pool = person.loyalty < 46 ? t.linesSour : t.linesLoyal;
  // Stable per person and per side of the line: the same secretary in the
  // same mood says the same thing every time you open the roster.
  const index = Math.abs(hash(person.name + (person.loyalty < 46 ? ":sour" : ":loyal"))) % pool.length;
  return pool[index];
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h;
}
