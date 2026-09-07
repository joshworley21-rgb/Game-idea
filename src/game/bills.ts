import { Rng } from "../core/rng.ts";
import { FACTIONS, billAxis, expectedVotes, whipCount } from "./congress.ts";
import type { FactionVote } from "./congress.ts";
import type { Bill, GameState, Ideology } from "./types.ts";

/** Which ideology each party's base rewards. */
export function partyIdeology(state: GameState): Ideology {
  return state.party === "blue" ? "progressive" : "conservative";
}

export function billCatalog(): Bill[] {
  const bills: Omit<Bill, "status">[] = [
    {
      id: "family-care",
      title: "Universal Family Care Act",
      summary: "Federal subsidy for childcare and long-term elder care, phased in over three years.",
      ideology: "progressive",
      domain: "health",
      cost: 220,
      capitalCost: 28,
      partisanship: 34,
      onPass: {
        "nation.sectors.healthcare": 8,
        "politics.approval": 3,
        "nation.unrest": -3,
        "blocs.labour": 7,
        "blocs.young": 6,
        "blocs.seniors": 5,
        "blocs.business": -5,
        "blocs.traditionalists": -8,
      },
      perMonth: { "nation.sectors.welfare": 0.12 },
    },
    {
      id: "green-grid",
      title: "Green Grid Investment Act",
      summary: "Rebuilds the national transmission grid around renewables and storage.",
      ideology: "progressive",
      domain: "economy",
      cost: 160,
      capitalCost: 22,
      partisanship: 28,
      onPass: {
        "nation.sectors.environment": 10,
        "nation.sectors.infrastructure": 3,
        "nation.standing": 4,
        "blocs.young": 9,
        "blocs.activists": 12,
        "blocs.rural": -7,
        "blocs.business": -3,
        "blocs.traditionalists": -6,
      },
      perMonth: { "nation.growth": 0.012 },
    },
    {
      id: "min-wage",
      title: "Fair Wage Act",
      summary: "Raises the federal minimum wage and indexes it to inflation.",
      ideology: "progressive",
      domain: "economy",
      cost: 0,
      capitalCost: 20,
      partisanship: 30,
      onPass: {
        "nation.unemployment": 0.3,
        "nation.unrest": -5,
        "politics.approval": 3,
        "nation.sectors.welfare": 3,
        "blocs.labour": 12,
        "blocs.young": 5,
        "blocs.business": -10,
        "blocs.traditionalists": -5,
      },
    },
    {
      id: "student-debt",
      title: "Student Debt Relief Act",
      summary: "Cancels up to $20,000 of federal student loan debt per borrower.",
      ideology: "progressive",
      domain: "economy",
      cost: 90,
      capitalCost: 18,
      partisanship: 26,
      onPass: {
        "nation.sectors.education": 5,
        "politics.approval": 4,
        "politics.party": 4,
        "blocs.young": 14,
        "blocs.activists": 6,
        "blocs.seniors": -5,
        "blocs.rural": -6,
        "blocs.traditionalists": -7,
      },
    },
    {
      id: "wealth-surtax",
      title: "Ultra-Wealth Surtax",
      summary: "A surcharge on net worth above $50 million, aimed squarely at the deficit.",
      ideology: "progressive",
      domain: "economy",
      cost: -180,
      capitalCost: 26,
      partisanship: 36,
      onPass: {
        "nation.taxRate": 0.7,
        "politics.party": 5,
        "nation.growth": -0.15,
        "politics.approval": 1,
        "blocs.labour": 8,
        "blocs.activists": 11,
        "blocs.business": -14,
        "blocs.traditionalists": -9,
        "blocs.suburban": -3,
      },
    },
    {
      id: "prek",
      title: "Universal Pre-K Act",
      summary: "Free preschool for every four-year-old, run through the states.",
      ideology: "progressive",
      domain: "economy",
      cost: 70,
      capitalCost: 16,
      partisanship: 22,
      onPass: {
        "nation.sectors.education": 7,
        "nation.unemployment": -0.1,
        "politics.approval": 2,
        "blocs.young": 7,
        "blocs.suburban": 8,
        "blocs.labour": 5,
        "blocs.traditionalists": -5,
      },
    },
    {
      id: "infrastructure",
      title: "National Infrastructure Renewal",
      summary: "A decade of bridges, water systems, rail and broadband, built union.",
      ideology: "centrist",
      domain: "economy",
      cost: 190,
      capitalCost: 20,
      partisanship: 14,
      onPass: {
        "nation.sectors.infrastructure": 12,
        "nation.unemployment": -0.3,
        "politics.approval": 4,
        "blocs.labour": 9,
        "blocs.rural": 7,
        "blocs.business": 6,
        "blocs.suburban": 4,
      },
      perMonth: { "nation.growth": 0.01 },
    },
    {
      id: "border-deal",
      title: "Border Security & Immigration Compromise",
      summary: "Enforcement funding traded for a path to status for long-term residents.",
      ideology: "centrist",
      domain: "security",
      cost: 45,
      capitalCost: 24,
      partisanship: 30,
      onPass: {
        "nation.security": 6,
        "nation.unrest": -4,
        "politics.party": -4,
        "politics.media": 5,
        "politics.approval": 3,
        "blocs.suburban": 6,
        "blocs.business": 5,
        "blocs.rural": -6,
        "blocs.traditionalists": -11,
        "blocs.activists": -7,
      },
    },
    {
      id: "veterans",
      title: "Veterans Care Overhaul",
      summary: "Rebuilds VA hospitals and clears the disability claims backlog.",
      ideology: "centrist",
      domain: "health",
      cost: 55,
      capitalCost: 12,
      partisanship: 8,
      onPass: {
        "nation.sectors.veterans": 12,
        "politics.approval": 3,
        "politics.media": 3,
        "blocs.rural": 8,
        "blocs.seniors": 6,
        "blocs.traditionalists": 5,
        "blocs.suburban": 3,
      },
    },
    {
      id: "pandemic",
      title: "Pandemic Preparedness Act",
      summary: "Standing vaccine capacity, stockpiles, and a rapid-response corps.",
      ideology: "centrist",
      domain: "health",
      cost: 40,
      capitalCost: 12,
      partisanship: 12,
      onPass: {
        "nation.sectors.healthcare": 4,
        "nation.security": 3,
        "blocs.seniors": 6,
        "blocs.suburban": 4,
        "blocs.traditionalists": -3,
      },
    },
    {
      id: "elections",
      title: "Election Integrity & Access Act",
      summary: "National standards for voter access, audits, and campaign disclosure.",
      ideology: "centrist",
      domain: "justice",
      cost: 15,
      capitalCost: 22,
      partisanship: 34,
      onPass: {
        "nation.unrest": -6,
        "personal.integrity": 4,
        "politics.media": 5,
        "blocs.young": 6,
        "blocs.activists": 7,
        "blocs.rural": -5,
        "blocs.traditionalists": -9,
      },
    },
    {
      id: "deficit-framework",
      title: "Deficit Reduction Framework",
      summary: "Statutory caps and a slow trim to entitlement growth. Nobody will thank you.",
      ideology: "centrist",
      domain: "economy",
      cost: -120,
      capitalCost: 25,
      partisanship: 24,
      onPass: {
        "nation.debtToGdp": -3,
        "politics.approval": -4,
        "nation.sectors.welfare": -3,
        "nation.growth": -0.1,
        "blocs.business": 12,
        "blocs.traditionalists": 8,
        "blocs.seniors": -9,
        "blocs.labour": -8,
        "blocs.activists": -10,
      },
      requires: (s) => s.nation.debtToGdp > 95,
    },
    {
      id: "chips-ai",
      title: "AI & Semiconductor Initiative",
      summary: "Domestic fabs, compute for universities, and a federal AI safety institute.",
      ideology: "centrist",
      domain: "economy",
      cost: 85,
      capitalCost: 14,
      partisanship: 10,
      onPass: {
        "nation.sectors.science": 10,
        "nation.growth": 0.15,
        "nation.standing": 3,
        "blocs.business": 8,
        "blocs.young": 5,
        "blocs.suburban": 4,
      },
    },
    {
      id: "corp-tax-cut",
      title: "Corporate Competitiveness Act",
      summary: "Cuts the corporate rate and expands capital expensing.",
      ideology: "conservative",
      domain: "economy",
      cost: 0,
      capitalCost: 24,
      partisanship: 32,
      onPass: {
        "nation.taxRate": -1.2,
        "nation.growth": 0.35,
        "politics.approval": -2,
        "blocs.business": 14,
        "blocs.traditionalists": 8,
        "blocs.labour": -9,
        "blocs.activists": -12,
        "blocs.young": -4,
      },
    },
    {
      id: "defense-mod",
      title: "Defense Modernization Act",
      summary: "Shipbuilding, missile defense, and a serious drone program.",
      ideology: "conservative",
      domain: "security",
      cost: 130,
      capitalCost: 16,
      partisanship: 18,
      onPass: {
        "nation.sectors.defense": 9,
        "nation.security": 5,
        "nation.standing": 3,
        "blocs.rural": 8,
        "blocs.traditionalists": 11,
        "blocs.activists": -10,
        "blocs.young": -4,
      },
    },
    {
      id: "dereg",
      title: "Regulatory Freedom Act",
      summary: "Sunsets thousands of federal rules and puts a brake on new ones.",
      ideology: "conservative",
      domain: "economy",
      cost: 0,
      capitalCost: 18,
      partisanship: 28,
      onPass: {
        "nation.growth": 0.25,
        "nation.sectors.environment": -6,
        "politics.approval": -1,
        "blocs.business": 11,
        "blocs.traditionalists": 7,
        "blocs.activists": -12,
        "blocs.young": -6,
      },
    },
    {
      id: "public-safety",
      title: "Police & Public Safety Act",
      summary: "Hiring grants, body cameras, and mandatory minimums for gun crime.",
      ideology: "conservative",
      domain: "justice",
      cost: 60,
      capitalCost: 14,
      partisanship: 24,
      onPass: {
        "nation.sectors.justice": 9,
        "nation.unrest": -5,
        "personal.integrity": -2,
        "blocs.suburban": 8,
        "blocs.rural": 7,
        "blocs.seniors": 5,
        "blocs.activists": -12,
        "blocs.young": -6,
      },
    },
    {
      id: "energy-independence",
      title: "Energy Independence Act",
      summary: "Opens federal leases and fast-tracks pipelines and LNG terminals.",
      ideology: "conservative",
      domain: "economy",
      cost: 70,
      capitalCost: 18,
      partisanship: 26,
      onPass: {
        "nation.growth": 0.2,
        "nation.sectors.environment": -8,
        "nation.standing": -3,
        "nation.security": 4,
        "blocs.rural": 11,
        "blocs.business": 7,
        "blocs.traditionalists": 6,
        "blocs.activists": -14,
        "blocs.young": -8,
      },
    },
    {
      id: "emergency-relief",
      title: "Emergency Relief Package",
      summary: "Direct payments and state aid to steady a country coming apart.",
      ideology: "centrist",
      domain: "economy",
      cost: 250,
      capitalCost: 10,
      partisanship: 8,
      onPass: {
        "nation.unrest": -12,
        "nation.sectors.welfare": 5,
        "politics.approval": 5,
        "blocs.labour": 9,
        "blocs.seniors": 6,
        "blocs.young": 4,
        "blocs.business": -4,
        "blocs.traditionalists": -6,
      },
      requires: (s) => s.nation.unrest > 55 || s.nation.unemployment > 7,
    },
  ];
  return bills.map((b) => ({ ...b, status: "available" as const }));
}

/** A simple majority of the chamber carries a bill. */
export const PASS_THRESHOLD = 50;

export interface VoteForecast {
  /** Expected votes out of one hundred; fifty carries it. */
  score: number;
  /** Rough probability of passage, 0-1. */
  odds: number;
  /** Plain-language read of the whip count. */
  read: string;
  /** True when the bill crosses the president's own party. */
  crossesParty: boolean;
  /** Where every faction stands, for the whip board. */
  factions: FactionVote[];
}

/**
 * The floor maths, faction by faction. A bill passes when the members who will
 * vote for it hold more than half the chamber, so the question is never "how
 * much capital" alone — it is which five groups you can get into one room.
 */
export function forecastVote(state: GameState, bill: Bill, capitalSpent: number): VoteForecast {
  const factions = whipCount(state, bill, capitalSpent);
  const score = expectedVotes(factions);
  const mine = partyIdeology(state);
  const crossesParty = bill.ideology !== "centrist" && bill.ideology !== mine;

  // The floor is not a spreadsheet: the roll adds +/-12, so a whip count near
  // the line is a genuine gamble and a hopeless one is not quite hopeless.
  const odds = Math.min(0.97, Math.max(0.03, (score - PASS_THRESHOLD + 12) / 24));
  const read =
    odds > 0.85 ? "Locked up" :
    odds > 0.62 ? "Likely to pass" :
    odds > 0.38 ? "Too close to call" :
    odds > 0.15 ? "Uphill" : "Dead on arrival";
  return { score, odds, read, crossesParty, factions };
}

export interface VoteResult {
  passed: boolean;
  margin: number;
  forecast: VoteForecast;
  narrative: string;
}

export function holdVote(state: GameState, bill: Bill, capitalSpent: number, rng: Rng): VoteResult {
  const forecast = forecastVote(state, bill, capitalSpent);
  const roll = rng.range(-12, 12);
  const final = forecast.score + roll;
  const passed = final > PASS_THRESHOLD;
  const margin = final - PASS_THRESHOLD;
  const narrative = passed
    ? margin > 12
      ? "It sails through both chambers with votes to spare."
      : "It squeaks through after a night of arm-twisting on the floor."
    : margin > -5
      ? "It dies two votes short. Two."
      : "The whip count was never there. It never reaches the floor intact.";
  return { passed, margin, forecast, narrative };
}

/** Effects on the president's own standing from the outcome of a vote. */
/**
 * How the factions feel afterwards. Members who wanted the bill warm to a
 * president who delivered it; members who fought it cool toward one who rammed
 * it through, and a failed bill annoys everybody who spent capital on it.
 */
export function factionAftermath(state: GameState, bill: Bill, passed: boolean): void {
  const axis = billAxis(bill.ideology);
  for (const def of FACTIONS) {
    const faction = state.factions[def.key];
    if (!faction) continue;
    const distance = Math.abs(axis - def.axis);
    // Close to the bill means they wanted it; far means they resented it.
    const affinity = 1 - distance;
    const shift = passed ? affinity * 5 : -Math.abs(affinity) * 1.5;
    faction.mood = Math.max(0, Math.min(100, faction.mood + shift));
  }
}

export function voteAftermath(bill: Bill, result: VoteResult) {
  const { crossesParty } = result.forecast;
  if (result.passed) {
    return {
      "politics.approval": 1.5,
      "politics.capital": 3,
      "politics.party": crossesParty ? -6 : 3,
      "politics.media": crossesParty ? 4 : 1,
      "nation.unrest": bill.partisanship > 28 ? 2 : 0,
      "personal.stress": 3,
    };
  }
  return {
    "politics.approval": -2,
    "politics.party": -3,
    "politics.media": -2,
    "personal.stress": 6,
  };
}
