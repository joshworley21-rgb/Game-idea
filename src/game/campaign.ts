import type { BlocKey, Party } from "./types.ts";

/**
 * The six weeks before the oath. There is no `GameState` yet — no nation, no
 * cabinet, nothing but a name, a party and a story about how you got here —
 * so the campaign carries its own small, self-contained shape rather than
 * reusing `Conversation`. What it produces is a bag of deltas laid on top of
 * the seed-jittered starting state, so the numbers the presidency opens with
 * have a reason behind them beyond the roll of the dice.
 */
export interface CampaignDeltas {
  approval?: number;
  capital?: number;
  party?: number;
  media?: number;
  blocs?: Partial<Record<BlocKey, number>>;
}

export interface CampaignOption {
  id: string;
  label: string;
  detail: string;
  deltas: CampaignDeltas;
  /** The beat this leads to. Absent means the campaign ends here, on election night. */
  next?: string;
  requires?: (path: string[]) => boolean;
  resultText: string;
}

export interface CampaignBeat {
  id: string;
  speaker: string;
  prompt: string;
  options: CampaignOption[];
}

export const CAMPAIGN_INTRO =
  "Before any of it — the desk, the cabinet, the four years — there was a campaign. Here is how yours went.";

export const CAMPAIGN_START = "primary";

const baseBloc = (party: Party): BlocKey => (party === "blue" ? "activists" : "traditionalists");
const oppositionBloc = (party: Party): BlocKey => (party === "blue" ? "traditionalists" : "activists");

/** The campaign is the same shape for both parties; only which bloc is "the base" changes. */
export function campaignBeats(party: Party): Record<string, CampaignBeat> {
  const base = baseBloc(party);
  const opposition = oppositionBloc(party);

  return {
    primary: {
      id: "primary",
      speaker: "Your campaign manager",
      prompt:
        "The primary is tightening. Money is flowing to the flank candidate, and you have six weeks before the first real votes are counted. How do you spend them?",
      options: [
        {
          id: "grassroots",
          label: "Grind it out on the ground",
          detail: "Town halls, diners, retail politics. Slow, and it builds something that lasts.",
          deltas: { party: 6, blocs: { labour: 4, rural: 2 } },
          resultText: "",
          next: "debate",
        },
        {
          id: "air-war",
          label: "Go all-in on television",
          detail: "Expensive, fast, and it buys exactly the voters who are still deciding.",
          deltas: { approval: 3, capital: 6, media: -2, blocs: { suburban: 3 } },
          resultText: "",
          next: "debate",
        },
        {
          id: "base-play",
          label: "Lean hard into the base — damn the middle",
          detail: "Turnout over persuasion. It works until it doesn't.",
          deltas: { party: 10, blocs: { [base]: 8, [opposition]: -4 } },
          resultText: "",
          next: "debate",
        },
      ],
    },
    debate: {
      id: "debate",
      speaker: "Debate night",
      prompt:
        "Forty million people watching. Your opponent goes straight at your record, and you have ninety seconds to answer.",
      options: [
        {
          id: "ground-game",
          label: "Point to the fifty diners you sat in this month",
          detail: "The ground game becomes the answer.",
          requires: (path) => path.includes("grassroots"),
          deltas: { approval: 3, blocs: { labour: 2 } },
          resultText: "",
          next: "surprise",
        },
        {
          id: "specifics",
          label: "Answer with specifics and numbers",
          detail: "Slower television, and it reads as someone who did the homework.",
          deltas: { approval: 4, media: 2 },
          resultText: "",
          next: "surprise",
        },
        {
          id: "counterpunch",
          label: "Turn it around on their record instead",
          detail: "The base loves a fighter. Nobody else is scoring this one for you.",
          deltas: { party: 3, approval: -1, blocs: { [base]: 3 } },
          resultText: "",
          next: "surprise",
        },
        {
          id: "high-road",
          label: "Refuse to engage — pivot to your own plan",
          detail: "Discipline, on a night that rewards almost anything else.",
          deltas: { approval: 1, media: 1 },
          resultText: "",
          next: "surprise",
        },
      ],
    },
    surprise: {
      id: "surprise",
      speaker: "Ten days out",
      prompt:
        "A story breaks — an old financial filing, ambiguous, and easy to spin either way depending on who gets there first.",
      options: [
        {
          id: "get-ahead",
          label: "Get ahead of it — release everything yourself",
          detail: "Costs momentum this week. Buys credibility for four years.",
          deltas: { approval: 2, media: 4, capital: -3 },
          resultText:
            "You hold your own press conference before anyone asks you to. It is a strange thing to watch a candidate just answer the question.",
        },
        {
          id: "lawyer-up",
          label: "Let the lawyers handle it, say nothing",
          detail: "The safest sentence is the one you don't say.",
          deltas: { approval: -2, media: -4 },
          resultText:
            "\"I won't get into an ongoing matter,\" your campaign says, for the fourth time this week.",
        },
        {
          id: "counterstory",
          label: "Leak something on your opponent in return",
          detail: "Ugly, and it works on the people who were always going to vote for you anyway.",
          deltas: { party: 4, approval: -3, media: -3 },
          resultText: "It works exactly as well as it deserves to: your side is thrilled, and no one else is.",
        },
      ],
    },
  };
}

/** Adds every campaign delta together, for the election-night summary. */
export function mergeCampaignDeltas(deltas: CampaignDeltas[]): CampaignDeltas {
  const total: CampaignDeltas = { blocs: {} };
  for (const d of deltas) {
    if (d.approval) total.approval = (total.approval ?? 0) + d.approval;
    if (d.capital) total.capital = (total.capital ?? 0) + d.capital;
    if (d.party) total.party = (total.party ?? 0) + d.party;
    if (d.media) total.media = (total.media ?? 0) + d.media;
    for (const [k, v] of Object.entries(d.blocs ?? {})) {
      const key = k as BlocKey;
      total.blocs![key] = (total.blocs![key] ?? 0) + (v as number);
    }
  }
  return total;
}
