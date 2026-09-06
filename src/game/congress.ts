import type { Bill, FactionKey, GameState, Ideology, Party } from "./types.ts";

/**
 * Congress is not a support percentage. It is five blocs of members who each
 * want something, and a bill passes when enough of them can be brought along
 * at once.
 *
 * Every faction sits somewhere on a left-to-right axis, holds a number of
 * seats, and has a mood toward the president that moves with its own
 * constituency, its party's standing, and whether you have been giving it wins.
 */
export interface FactionDef {
  key: FactionKey;
  name: string;
  short: string;
  /** -1 is the left flank, +1 the right. */
  axis: number;
  /** Which side of the aisle they sit on; null for a genuine swing bloc. */
  party: Party | null;
  /** The constituency whose mood theirs follows. */
  backing: "activists" | "labour" | "young" | "suburban" | "business" | "traditionalists" | "rural";
  /** Deficit hawks punish expensive bills much harder. */
  fiscal: boolean;
  blurb: string;
}

export const FACTIONS: FactionDef[] = [
  {
    key: "progressives",
    name: "The Progressive Caucus",
    short: "Progressives",
    axis: -1,
    party: "blue",
    backing: "activists",
    fiscal: false,
    blurb: "Small, loud, and willing to sink your bill to make a point.",
  },
  {
    key: "liberals",
    name: "The Liberal Bloc",
    short: "Liberals",
    axis: -0.5,
    party: "blue",
    backing: "labour",
    fiscal: false,
    blurb: "The mainstream of the blue party. Reliable until they are not.",
  },
  {
    key: "moderates",
    name: "The Moderates",
    short: "Moderates",
    axis: 0,
    party: null,
    backing: "suburban",
    fiscal: true,
    blurb: "Cross-party, cautious, and the reason anything passes at all.",
  },
  {
    key: "conservatives",
    name: "The Conservative Bloc",
    short: "Conservatives",
    axis: 0.5,
    party: "red",
    backing: "business",
    fiscal: true,
    blurb: "Business-minded, allergic to deficits, open to a deal on the right terms.",
  },
  {
    key: "hardliners",
    name: "The Hardliners",
    short: "Hardliners",
    axis: 1,
    party: "red",
    backing: "traditionalists",
    fiscal: true,
    blurb: "They did not come here to compromise and they will tell you so.",
  },
];

export const FACTION_BY_KEY = new Map(FACTIONS.map((f) => [f.key, f]));

/** Where a bill sits on the same axis the factions are measured on. */
export function billAxis(ideology: Ideology): number {
  return ideology === "progressive" ? -1 : ideology === "conservative" ? 1 : 0;
}

export interface FactionVote {
  def: FactionDef;
  seats: number;
  /** Probability this faction comes with you, 0-1. */
  odds: number;
  mood: number;
}

/**
 * How one faction reads a bill. Distance on the axis does most of the work;
 * mood, money and the whip do the rest.
 */
function factionScore(s: GameState, bill: Bill, push: number, def: FactionDef): number {
  const distance = Math.abs(billAxis(bill.ideology) - def.axis);
  const mood = s.factions[def.key]?.mood ?? 50;
  const alignment = def.party === null ? 0 : def.party === s.party ? 1 : -1;
  const debtSensitivity = s.nation.debtToGdp > 110 ? 1.6 : 1;
  const cost = bill.cost > 0 ? (bill.cost / 85) * (def.fiscal ? 1.9 : 0.5) * debtSensitivity : 0;
  // The other side will cross the aisle for something uncontroversial, and
  // not for anything else.
  const aisle =
    alignment === 1
      ? 7
      : alignment === 0
        ? 2 + (22 - bill.partisanship) * 0.25
        : -3 + (22 - bill.partisanship) * 0.4;

  // Distance costs more the further out it goes: a faction one step away can
  // be bought, one on the far flank is not voting for this at any price.
  // A bill written for a faction gets its votes even when its members cannot
  // stand the president who sent it up.
  const home = 9 * Math.max(0, 1 - distance);

  return (
    48 +
    (mood - 50) * 0.42 +
    home -
    Math.pow(distance, 1.5) * 11 -
    bill.partisanship * 0.2 * distance +
    push * 0.42 +
    aisle -
    cost
  );
}

/** The whip count, faction by faction. */
export function whipCount(s: GameState, bill: Bill, push: number): FactionVote[] {
  return FACTIONS.map((def) => {
    const score = factionScore(s, bill, push, def);
    return {
      def,
      seats: s.factions[def.key]?.seats ?? 20,
      // A soft threshold, so a forecast can be read rather than just a coin flip.
      odds: Math.max(0, Math.min(1, (score - 50) / 24 + 0.5)),
      mood: s.factions[def.key]?.mood ?? 50,
    };
  });
}

/** Expected votes out of 100. Above fifty carries the bill. */
export function expectedVotes(votes: FactionVote[]): number {
  return votes.reduce((sum, v) => sum + v.seats * v.odds, 0);
}

/**
 * Moves every faction's mood toward what it should be, given its own
 * constituency, its side's standing, the state of the country, and whether it
 * has one of its own sitting in your cabinet.
 */
export function driftFactions(s: GameState, patronage?: Partial<Record<FactionKey, number>>): void {
  for (const def of FACTIONS) {
    const faction = s.factions[def.key];
    if (!faction) continue;
    const backing = s.blocs[def.backing] ?? 50;
    const alignment = def.party === null ? 0 : def.party === s.party ? 1 : -1;
    // A swing bloc has no party loyalty to fall back on, so it follows the
    // country's verdict on you far more closely than either flank does.
    const target =
      30 +
      backing * 0.42 +
      (alignment === 1 ? s.politics.party * 0.22 : alignment === -1 ? (100 - s.politics.party) * 0.1 : 8) +
      (s.politics.approval - 50) * (alignment === 0 ? 0.3 : 0.16) +
      (patronage?.[def.key] ?? 0) * 2.4 +
      alignment * 6;
    faction.mood = Math.max(0, Math.min(100, faction.mood + (target - faction.mood) * 0.2));
  }
}

/** Seats held by factions currently minded to back the president. */
export function friendlySeats(s: GameState): number {
  return FACTIONS.reduce(
    (sum, def) => sum + ((s.factions[def.key]?.mood ?? 50) > 52 ? s.factions[def.key]?.seats ?? 0 : 0),
    0,
  );
}

/**
 * The midterms move seats between the flanks. An unpopular president's own
 * side loses ground, and the gains go to the other party's blocs.
 */
export function applyMidtermSwing(s: GameState, swing: number): void {
  // The swing bloc in the middle neither gains nor loses; the flanks trade.
  const mine = FACTIONS.filter((f) => f.party === s.party);
  const theirs = FACTIONS.filter((f) => f.party !== null && f.party !== s.party);
  const move = Math.max(-14, Math.min(14, swing)) / mine.length;

  for (const def of mine) {
    const faction = s.factions[def.key];
    if (faction) faction.seats = Math.max(4, faction.seats + move);
  }
  for (const def of theirs) {
    const faction = s.factions[def.key];
    if (faction) faction.seats = Math.max(4, faction.seats - (move * mine.length) / theirs.length);
  }

  // Keep the chamber at a hundred seats however the swing lands.
  const total = FACTIONS.reduce((sum, f) => sum + (s.factions[f.key]?.seats ?? 0), 0);
  for (const def of FACTIONS) {
    const faction = s.factions[def.key];
    if (faction) faction.seats = (faction.seats / total) * 100;
  }
}
