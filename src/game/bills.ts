import { Rng } from "../core/rng.ts";
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
      cost: 220,
      capitalCost: 28,
      partisanship: 34,
      onPass: { "nation.sectors.healthcare": 8, "politics.approval": 3, "nation.unrest": -3 },
      perMonth: { "nation.sectors.welfare": 0.12 },
    },
    {
      id: "green-grid",
      title: "Green Grid Investment Act",
      summary: "Rebuilds the national transmission grid around renewables and storage.",
      ideology: "progressive",
      cost: 160,
      capitalCost: 22,
      partisanship: 28,
      onPass: { "nation.sectors.environment": 10, "nation.sectors.infrastructure": 3, "nation.standing": 4 },
      perMonth: { "nation.growth": 0.012 },
    },
    {
      id: "min-wage",
      title: "Fair Wage Act",
      summary: "Raises the federal minimum wage and indexes it to inflation.",
      ideology: "progressive",
      cost: 0,
      capitalCost: 20,
      partisanship: 30,
      onPass: {
        "nation.unemployment": 0.3,
        "nation.unrest": -5,
        "politics.approval": 3,
        "nation.sectors.welfare": 3,
      },
    },
    {
      id: "student-debt",
      title: "Student Debt Relief Act",
      summary: "Cancels up to $20,000 of federal student loan debt per borrower.",
      ideology: "progressive",
      cost: 90,
      capitalCost: 18,
      partisanship: 26,
      onPass: { "nation.sectors.education": 5, "politics.approval": 4, "politics.party": 4 },
    },
    {
      id: "wealth-surtax",
      title: "Ultra-Wealth Surtax",
      summary: "A surcharge on net worth above $50 million, aimed squarely at the deficit.",
      ideology: "progressive",
      cost: -180,
      capitalCost: 26,
      partisanship: 36,
      onPass: { "nation.taxRate": 0.7, "politics.party": 5, "nation.growth": -0.15, "politics.approval": 1 },
    },
    {
      id: "prek",
      title: "Universal Pre-K Act",
      summary: "Free preschool for every four-year-old, run through the states.",
      ideology: "progressive",
      cost: 70,
      capitalCost: 16,
      partisanship: 22,
      onPass: { "nation.sectors.education": 7, "nation.unemployment": -0.1, "politics.approval": 2 },
    },
    {
      id: "infrastructure",
      title: "National Infrastructure Renewal",
      summary: "A decade of bridges, water systems, rail and broadband, built union.",
      ideology: "centrist",
      cost: 190,
      capitalCost: 20,
      partisanship: 14,
      onPass: {
        "nation.sectors.infrastructure": 12,
        "nation.unemployment": -0.3,
        "politics.approval": 4,
      },
      perMonth: { "nation.growth": 0.01 },
    },
    {
      id: "border-deal",
      title: "Border Security & Immigration Compromise",
      summary: "Enforcement funding traded for a path to status for long-term residents.",
      ideology: "centrist",
      cost: 45,
      capitalCost: 24,
      partisanship: 30,
      onPass: {
        "nation.security": 6,
        "nation.unrest": -4,
        "politics.party": -4,
        "politics.media": 5,
        "politics.approval": 3,
      },
    },
    {
      id: "veterans",
      title: "Veterans Care Overhaul",
      summary: "Rebuilds VA hospitals and clears the disability claims backlog.",
      ideology: "centrist",
      cost: 55,
      capitalCost: 12,
      partisanship: 8,
      onPass: { "nation.sectors.veterans": 12, "politics.approval": 3, "politics.media": 3 },
    },
    {
      id: "pandemic",
      title: "Pandemic Preparedness Act",
      summary: "Standing vaccine capacity, stockpiles, and a rapid-response corps.",
      ideology: "centrist",
      cost: 40,
      capitalCost: 12,
      partisanship: 12,
      onPass: { "nation.sectors.healthcare": 4, "nation.security": 3 },
    },
    {
      id: "elections",
      title: "Election Integrity & Access Act",
      summary: "National standards for voter access, audits, and campaign disclosure.",
      ideology: "centrist",
      cost: 15,
      capitalCost: 22,
      partisanship: 34,
      onPass: { "nation.unrest": -6, "personal.integrity": 4, "politics.media": 5 },
    },
    {
      id: "deficit-framework",
      title: "Deficit Reduction Framework",
      summary: "Statutory caps and a slow trim to entitlement growth. Nobody will thank you.",
      ideology: "centrist",
      cost: -120,
      capitalCost: 25,
      partisanship: 24,
      onPass: {
        "nation.debtToGdp": -3,
        "politics.approval": -4,
        "nation.sectors.welfare": -3,
        "nation.growth": -0.1,
      },
      requires: (s) => s.nation.debtToGdp > 95,
    },
    {
      id: "chips-ai",
      title: "AI & Semiconductor Initiative",
      summary: "Domestic fabs, compute for universities, and a federal AI safety institute.",
      ideology: "centrist",
      cost: 85,
      capitalCost: 14,
      partisanship: 10,
      onPass: { "nation.sectors.science": 10, "nation.growth": 0.15, "nation.standing": 3 },
    },
    {
      id: "corp-tax-cut",
      title: "Corporate Competitiveness Act",
      summary: "Cuts the corporate rate and expands capital expensing.",
      ideology: "conservative",
      cost: 0,
      capitalCost: 24,
      partisanship: 32,
      onPass: { "nation.taxRate": -1.2, "nation.growth": 0.35, "politics.approval": -2 },
    },
    {
      id: "defense-mod",
      title: "Defense Modernization Act",
      summary: "Shipbuilding, missile defense, and a serious drone program.",
      ideology: "conservative",
      cost: 130,
      capitalCost: 16,
      partisanship: 18,
      onPass: { "nation.sectors.defense": 9, "nation.security": 5, "nation.standing": 3 },
    },
    {
      id: "dereg",
      title: "Regulatory Freedom Act",
      summary: "Sunsets thousands of federal rules and puts a brake on new ones.",
      ideology: "conservative",
      cost: 0,
      capitalCost: 18,
      partisanship: 28,
      onPass: { "nation.growth": 0.25, "nation.sectors.environment": -6, "politics.approval": -1 },
    },
    {
      id: "public-safety",
      title: "Police & Public Safety Act",
      summary: "Hiring grants, body cameras, and mandatory minimums for gun crime.",
      ideology: "conservative",
      cost: 60,
      capitalCost: 14,
      partisanship: 24,
      onPass: { "nation.sectors.justice": 9, "nation.unrest": -5, "personal.integrity": -2 },
    },
    {
      id: "energy-independence",
      title: "Energy Independence Act",
      summary: "Opens federal leases and fast-tracks pipelines and LNG terminals.",
      ideology: "conservative",
      cost: 70,
      capitalCost: 18,
      partisanship: 26,
      onPass: {
        "nation.growth": 0.2,
        "nation.sectors.environment": -8,
        "nation.standing": -3,
        "nation.security": 4,
      },
    },
    {
      id: "emergency-relief",
      title: "Emergency Relief Package",
      summary: "Direct payments and state aid to steady a country coming apart.",
      ideology: "centrist",
      cost: 250,
      capitalCost: 10,
      partisanship: 8,
      onPass: { "nation.unrest": -12, "nation.sectors.welfare": 5, "politics.approval": 5 },
      requires: (s) => s.nation.unrest > 55 || s.nation.unemployment > 7,
    },
  ];
  return bills.map((b) => ({ ...b, status: "available" as const }));
}

export interface VoteForecast {
  /** Expected floor score; 55 is the passing line. */
  score: number;
  /** Rough probability of passage, 0-1. */
  odds: number;
  /** Plain-language read of the whip count. */
  read: string;
  /** True when the bill crosses the president's own party. */
  crossesParty: boolean;
}

function mismatchFactor(bill: Bill, state: GameState): { factor: number; crossesParty: boolean } {
  const mine = partyIdeology(state);
  if (bill.ideology === "centrist") return { factor: 0.3, crossesParty: false };
  if (bill.ideology === mine) return { factor: 0.7, crossesParty: false };
  return { factor: 0.5, crossesParty: true };
}

/** Deterministic part of the floor math; the roll call adds the noise. */
export function forecastVote(state: GameState, bill: Bill, capitalSpent: number): VoteForecast {
  const chamber = (state.politics.house + state.politics.senate) / 2;
  const { factor, crossesParty } = mismatchFactor(bill, state);
  const debtSensitivity = state.nation.debtToGdp > 110 ? 1.6 : 1;
  const costPenalty = bill.cost > 0 ? (bill.cost / 70) * debtSensitivity : 0;

  const score =
    chamber +
    capitalSpent * 0.55 +
    (state.politics.approval - 50) * 0.35 +
    (state.politics.party - 50) * 0.2 -
    bill.partisanship * factor -
    costPenalty +
    (crossesParty ? 4 : 0);

  // The roll call adds +/-8 uniform noise, so odds are linear in that window.
  const odds = Math.min(0.97, Math.max(0.03, (score - 55 + 8) / 16));
  const read =
    odds > 0.85 ? "Locked up" :
    odds > 0.62 ? "Likely to pass" :
    odds > 0.38 ? "Too close to call" :
    odds > 0.15 ? "Uphill" : "Dead on arrival";
  return { score, odds, read, crossesParty };
}

export interface VoteResult {
  passed: boolean;
  margin: number;
  forecast: VoteForecast;
  narrative: string;
}

export function holdVote(state: GameState, bill: Bill, capitalSpent: number, rng: Rng): VoteResult {
  const forecast = forecastVote(state, bill, capitalSpent);
  const roll = rng.range(-8, 8);
  const final = forecast.score + roll;
  const passed = final > 55;
  const margin = final - 55;
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
