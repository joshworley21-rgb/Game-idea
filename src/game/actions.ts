import { childrenOf, spouseOf } from "./family.ts";
import type { FamilyMember, GameState, OfficeAction, StationId } from "./types.ts";

/** Fixed order, used for the number-key shortcuts and the HUD legend. */
export const STATION_ORDER: StationId[] = [
  "desk",
  "budget",
  "staff",
  "phone",
  "press",
  "family",
  "rest",
];

export const STATION_INFO: Record<StationId, { name: string; blurb: string }> = {
  desk: {
    name: "The Resolute Desk",
    blurb: "Legislation, executive orders, and the signature that makes them real.",
  },
  budget: {
    name: "The Cabinet Table",
    blurb: "Appropriations, taxes, and the arithmetic nobody wants to look at.",
  },
  phone: {
    name: "The Secure Line",
    blurb: "Allies, adversaries, and the world outside the fence.",
  },
  press: {
    name: "The Press Pool",
    blurb: "Cameras, questions, and whatever the country thinks it saw.",
  },
  family: {
    name: "The Residence",
    blurb: "The people who knew you before any of this.",
  },
  staff: {
    name: "The West Wing",
    blurb: "Your cabinet, your party, and the votes on the Hill.",
  },
  rest: {
    name: "The Private Study",
    blurb: "Sleep, the physician, and the hour that belongs to you.",
  },
};

export const ACTIONS: OfficeAction[] = [
  // --- The Resolute Desk ---
  {
    id: "executive-order",
    station: "desk",
    label: "Sign an executive order",
    detail: "Act alone. Fast, narrow, and reversible by the next person to sit here.",
    ap: 1,
    capitalCost: 6,
    cooldown: 2,
    effects: {
      "nation.sectors.justice": 2,
      "nation.sectors.environment": 2,
      "politics.party": 3,
      "nation.unrest": 2,
      "politics.approval": 1,
    },
    resultText:
      "Three agencies have new marching orders by Monday and a district judge has the filing by Friday.",
  },
  {
    id: "pardon",
    station: "desk",
    label: "Grant clemency",
    detail: "Commute a batch of sentences the Justice Department flagged years ago.",
    ap: 1,
    cooldown: 8,
    effects: {
      "nation.sectors.justice": 3,
      "nation.unrest": -2,
      "personal.integrity": 3,
      "politics.media": 2,
      "politics.approval": -1,
    },
    resultText: "Four hundred and eleven sentences commuted. Two op-eds call it courage; four call it weakness.",
  },
  {
    id: "veto",
    station: "desk",
    label: "Veto the opposition bill",
    detail: "Kill the bill Congress sent over and dare them to override.",
    ap: 1,
    capitalCost: 8,
    cooldown: 6,
    effects: {
      "politics.party": 8,
      "politics.house": -2,
      "politics.senate": -2,
      "politics.media": -2,
      "politics.approval": -1,
    },
    resultText: "The override attempt fails by nine votes. Your side is delighted; the Hill is not.",
  },

  // --- The West Wing ---
  {
    id: "cabinet",
    station: "staff",
    label: "Run a cabinet meeting",
    detail: "Two hours of alignment. Unglamorous, and it is where capital comes from.",
    ap: 1,
    cooldown: 2,
    effects: { "politics.capital": 9, "politics.party": 2, "personal.stress": 3 },
    resultText: "Everyone leaves with the same understanding of the same plan. It will last about a month.",
  },
  {
    id: "whip",
    station: "staff",
    label: "Work the Hill personally",
    detail: "Calls, favours, and a long afternoon in the Speaker's office.",
    ap: 1,
    capitalCost: 4,
    cooldown: 3,
    effects: {
      "politics.house": 2.5,
      "politics.senate": 2,
      "politics.party": 3,
      "personal.stress": 6,
      "personal.family": -2,
    },
    resultText: "Six members move from 'no' to 'undecided', which in this town is a landslide.",
  },
  {
    id: "fundraiser",
    station: "staff",
    label: "Headline a fundraiser",
    detail: "An evening of handshakes for money that is not, technically, yours.",
    ap: 1,
    cooldown: 3,
    effects: {
      "politics.party": 7,
      "politics.capital": 5,
      "personal.integrity": -2,
      "politics.media": -1,
      "personal.family": -3,
      "personal.stress": 4,
    },
    resultText: "Eleven million in a hotel ballroom. Your party chair stops returning other people's calls.",
  },
  {
    id: "reshuffle",
    station: "staff",
    label: "Reshuffle the cabinet",
    detail: "Move the dead weight. It buys a headline and costs you loyalty.",
    ap: 2,
    capitalCost: 10,
    cooldown: 12,
    effects: {
      "politics.capital": 6,
      "politics.media": 4,
      "politics.approval": 2,
      "politics.party": -4,
      "personal.stress": 6,
    },
    resultText: "Three new faces, one genuinely good one. The reset lasts about six weeks.",
  },

  // --- The Secure Line ---
  {
    id: "call-ally",
    station: "phone",
    label: "Call an ally",
    detail: "Forty minutes with a head of government who needs reassuring.",
    ap: 1,
    cooldown: 2,
    effects: { "nation.standing": 4, "personal.stress": 2 },
    resultText: "They go into their own parliament the next morning and say the alliance is solid.",
  },
  {
    id: "summit",
    station: "phone",
    label: "Fly to a summit",
    detail: "Nine time zones, four days, and a communiqué nobody will read.",
    ap: 2,
    capitalCost: 5,
    cooldown: 6,
    effects: {
      "nation.standing": 9,
      "nation.security": 3,
      "nation.growth": 0.1,
      "personal.stress": 9,
      "personal.health": -2,
      "personal.family": -5,
    },
    resultText: "A joint statement with real commitments in it, and a photograph you will use for two years.",
  },
  {
    id: "trade-deal",
    station: "phone",
    label: "Push a trade agreement",
    detail: "Market access for someone's exporters, pain for someone's factory town.",
    ap: 1,
    capitalCost: 6,
    cooldown: 8,
    effects: {
      "nation.growth": 0.22,
      "nation.standing": 4,
      "nation.inflation": -0.15,
      "politics.party": -4,
      "nation.unrest": 2,
    },
    resultText: "Tariffs fall in eleven categories. Two states will hold this against you forever.",
  },
  {
    id: "intel-brief",
    station: "phone",
    label: "Sit the full intelligence brief",
    detail: "The long version, with the analysts in the room instead of the summary.",
    ap: 1,
    cooldown: 4,
    effects: { "nation.security": 4, "personal.stress": 4 },
    resultText:
      "You now know three things you cannot tell anyone, and one of them will matter in a month.",
  },

  // --- The Press Pool ---
  {
    id: "address",
    station: "press",
    label: "Address the nation",
    detail: "Prime time from the Oval. You get one of these every few months before it stops working.",
    ap: 1,
    capitalCost: 4,
    cooldown: 4,
    effects: {
      "politics.approval": 5,
      "politics.media": 2,
      "nation.unrest": -2,
      "personal.stress": 5,
    },
    resultText: "Forty-one million watch. The bump is real, and it has a half-life of about five weeks.",
  },
  {
    id: "interview",
    station: "press",
    label: "Sit for a hostile interview",
    detail: "An hour with someone who has done the reading and does not like you.",
    ap: 1,
    cooldown: 4,
    effects: {
      "politics.media": 8,
      "politics.approval": 1,
      "personal.stress": 7,
      "personal.integrity": 2,
    },
    resultText: "You take four hard questions well and one badly. The press corps recalibrates upward.",
  },
  {
    id: "rally",
    station: "press",
    label: "Hold a rally",
    detail: "An arena, your people, and no follow-up questions.",
    ap: 1,
    cooldown: 2,
    effects: {
      "politics.party": 8,
      "politics.approval": 2,
      "nation.unrest": 2,
      "personal.stress": 5,
      "personal.family": -3,
      "politics.media": -2,
    },
    resultText: "Eighteen thousand people and a clip that runs for two days. Your base is fed.",
  },
  {
    id: "campaign-swing",
    station: "press",
    label: "Campaign swing",
    detail: "Six states in nine days. Only worth it when the election is close enough to smell.",
    ap: 2,
    capitalCost: 6,
    cooldown: 2,
    available: (s: GameState) => s.month >= 34,
    effects: {
      "politics.approval": 5,
      "politics.party": 6,
      "personal.stress": 12,
      "personal.health": -3,
      "personal.family": -6,
      "personal.marriage": -4,
    },
    resultText: "Nine days, twenty-two events, and a voice that will not come back until Thursday.",
  },

  // --- The Residence ---
  // The shared evenings. The named ones are generated per-person from the
  // family you actually have; see `residenceActions` below.
  {
    id: "family-dinner",
    station: "family",
    label: "Family dinner, no staff",
    detail: "Upstairs, phones in a basket, the schedule cleared for two hours.",
    ap: 1,
    cooldown: 2,
    // An evening with all of them counts for everyone, if less than an
    // evening with one of them counts for that one.
    target: "all",
    attention: 5,
    effects: { "personal.stress": -7 },
    resultText: "Two hours upstairs. Nobody mentions the polls once, which took visible effort from everyone.",
  },
  {
    id: "camp-david",
    station: "family",
    label: "A weekend at Camp David",
    detail: "Everyone comes. No staff, no cameras, and the country runs itself for two days.",
    ap: 2,
    cooldown: 5,
    target: "all",
    attention: 11,
    effects: {
      "personal.stress": -18,
      "personal.health": 3,
      "personal.sleepDebt": -12,
      "politics.capital": -4,
    },
    resultText: "Two days of walking, cards, and terrible movies. You come back recognisable to your own family.",
  },

  // --- The Private Study ---
  {
    id: "sleep",
    station: "rest",
    label: "Protect the schedule",
    detail: "No 5am calls for two weeks. The staff will hate it and do it anyway.",
    ap: 1,
    cooldown: 2,
    effects: { "personal.stress": -13, "personal.health": 2, "personal.sleepDebt": -26 },
    resultText: "Fourteen nights of real sleep. Everything is still on fire; you are simply awake for it.",
  },
  {
    id: "exercise",
    station: "rest",
    label: "Train with the physician",
    detail: "Five mornings a week, cardiology's plan, no negotiating.",
    ap: 1,
    cooldown: 2,
    effects: { "personal.health": 3, "personal.fitness": 9, "personal.stress": -5 },
    resultText: "Resting heart rate down nine points in a month. The doctor stops looking at you like that.",
  },
  {
    id: "physical",
    station: "rest",
    label: "Full physical at Walter Reed",
    detail: "The complete workup, results released to the public as tradition demands.",
    ap: 1,
    cooldown: 8,
    effects: {
      "personal.health": 3,
      "politics.media": 3,
      "personal.integrity": 2,
      "personal.stress": -2,
    },
    resultText: "Bloodwork, imaging, and a two-page letter the networks read out line by line.",
  },
  {
    id: "therapy",
    station: "rest",
    label: "See someone about it",
    detail: "A standing appointment, off the official schedule. It stays off it.",
    ap: 1,
    cooldown: 3,
    effects: { "personal.stress": -16, "personal.health": 2, "personal.sleepDebt": -8 },
    resultText:
      "An hour a week where nobody wants anything from you. It is the most useful hour on the calendar.",
  },
  {
    id: "read",
    station: "rest",
    label: "Read something that isn't a briefing",
    detail: "History, mostly. Other people's disasters are restful.",
    ap: 1,
    cooldown: 2,
    effects: { "personal.stress": -8, "personal.health": 1, "politics.capital": 2 },
    resultText: "Three hundred pages on a predecessor who had it worse. Oddly, it helps.",
  },
  {
    id: "manage-condition",
    station: "rest",
    label: "Do what the cardiologist said",
    detail: "The medication, the monitoring, and the half of the schedule they want cut.",
    ap: 1,
    cooldown: 2,
    available: (s) => Boolean(s.personal.condition),
    effects: {
      "personal.health": 6,
      "personal.fitness": 4,
      "personal.stress": -6,
      "politics.capital": -3,
    },
    resultText:
      "Numbers back where they should be, and two events dropped from the week to get them there.",
  },
];

/**
 * The evenings that belong to one person. These are built from the family you
 * actually have, so the residence offers "Take Elena out" and "Show up for
 * Maya" rather than "spouse" and "kid" — and each person has their own
 * cooldown, so seeing one of them is not seeing the others.
 */
function forChild(child: FamilyMember): OfficeAction[] {
  const showUp: OfficeAction =
    child.age <= 18
      ? {
          id: `show-up-${child.id}`,
          station: "family",
          label: `Show up for ${child.name}`,
          detail: "A game, a recital, whatever it is this month. Be in the third row.",
          ap: 1,
          cooldown: 3,
          target: child.id,
          attention: 9,
          effects: { "politics.media": 2, "personal.stress": -3, "politics.capital": -2 },
          resultText: `You are in the third row for all of it. ${child.name} pretends not to look over. ${child.name} looks over.`,
        }
      : {
          id: `visit-${child.id}`,
          station: "family",
          label: `Go and see ${child.name}`,
          detail: "Their place, their terms, no press pool. Two vehicles and an apology.",
          ap: 1,
          cooldown: 4,
          target: child.id,
          attention: 10,
          effects: { "personal.stress": -5, "politics.capital": -3 },
          resultText: `Four hours in a flat you have never been to. ${child.name} cooks. It is not good and you say it is.`,
        };

  return [
    {
      id: `call-${child.id}`,
      station: "family",
      label: `Call ${child.name}`,
      detail: "Twenty minutes on the residence line, badly timed for both of you.",
      ap: 1,
      cooldown: 1,
      target: child.id,
      attention: 5,
      effects: { "personal.stress": -3 },
      resultText: `${child.name} talks for nineteen minutes about something you do not follow. It is the best part of the week.`,
    },
    showUp,
  ];
}

function forSpouse(spouse: FamilyMember): OfficeAction[] {
  return [
    {
      id: "date-night",
      station: "family",
      label: `Take ${spouse.name} out`,
      detail: "A restaurant, a motorcade, and forty agents pretending not to exist.",
      ap: 1,
      cooldown: 3,
      target: spouse.id,
      attention: 8,
      effects: { "personal.stress": -6, "politics.media": 1 },
      resultText: `You get most of a meal before someone asks for a photo. ${spouse.name} laughs about it. It counts.`,
    },
    {
      id: "spouse-listen",
      station: "family",
      label: `Ask ${spouse.name} how it is going`,
      detail: "And then do not check the phone once, whatever the answer turns out to be.",
      ap: 1,
      cooldown: 2,
      target: spouse.id,
      attention: 7,
      effects: { "personal.stress": -4, "personal.integrity": 1 },
      resultText: `An hour, most of it theirs. Some of what you hear you did not want to know.`,
    },
  ];
}

/** Everything on offer upstairs tonight, for this particular family. */
export function residenceActions(state: GameState): OfficeAction[] {
  const spouse = spouseOf(state);
  return [
    ...(spouse ? forSpouse(spouse) : []),
    ...childrenOf(state).flatMap(forChild),
  ];
}

export function actionsFor(state: GameState, station: StationId): OfficeAction[] {
  const pool = station === "family" ? [...ACTIONS, ...residenceActions(state)] : ACTIONS;
  return pool.filter((a) => {
    if (a.station !== station) return false;
    if (a.available && !a.available(state)) return false;
    return true;
  });
}

export function actionCooldownLeft(state: GameState, action: OfficeAction): number {
  if (!action.cooldown) return 0;
  const last = state.actionHistory[action.id];
  if (last === undefined) return 0;
  return Math.max(0, action.cooldown - (state.month - last));
}

export function canAfford(state: GameState, action: OfficeAction): boolean {
  if (state.ap < action.ap) return false;
  if ((action.capitalCost ?? 0) > state.politics.capital) return false;
  return actionCooldownLeft(state, action) === 0;
}
