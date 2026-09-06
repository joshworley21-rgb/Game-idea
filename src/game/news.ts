import { Rng } from "../core/rng.ts";
import type { GameState, NewsItem } from "./types.ts";

const OUTLETS = [
  "The National Ledger",
  "Capitol Wire",
  "Channel 8 Nightly",
  "The Beacon",
  "Public Radio Morning",
  "The Standard",
];

interface Template {
  when: (s: GameState) => boolean;
  tone: NewsItem["tone"];
  lines: string[];
}

const TEMPLATES: Template[] = [
  {
    when: (s) => s.politics.approval > 60,
    tone: "good",
    lines: [
      "President's approval hits {approval}% as voters credit steady hand",
      "Poll: {approval}% approve, the strongest number of the term so far",
    ],
  },
  {
    when: (s) => s.politics.approval < 38,
    tone: "bad",
    lines: [
      "Approval slides to {approval}% as allies begin distancing themselves",
      "Poll: only {approval}% approve; party strategists openly worried",
    ],
  },
  {
    when: (s) => s.nation.unemployment < 4,
    tone: "good",
    lines: [
      "Unemployment falls to {unemployment}%, lowest in a generation",
      "Hiring surge pushes joblessness to {unemployment}%",
    ],
  },
  {
    when: (s) => s.nation.unemployment > 6.5,
    tone: "bad",
    lines: [
      "Layoffs mount as unemployment reaches {unemployment}%",
      "Jobless rate climbs to {unemployment}%; manufacturing towns hit hardest",
    ],
  },
  {
    when: (s) => s.nation.inflation > 4.5,
    tone: "bad",
    lines: [
      "Prices up again: inflation running at {inflation}%",
      "Grocery costs dominate kitchen tables as inflation holds at {inflation}%",
    ],
  },
  {
    when: (s) => s.nation.growth < 0,
    tone: "bad",
    lines: [
      "Economy contracts; economists call it a recession in all but name",
      "Output shrinks for a second straight quarter",
    ],
  },
  {
    when: (s) => s.nation.growth > 3.4,
    tone: "good",
    lines: [
      "Economy expanding at {growth}%, fastest run in years",
      "Boom talk returns as growth hits {growth}%",
    ],
  },
  {
    when: (s) => s.nation.unrest > 62,
    tone: "bad",
    lines: [
      "Third straight weekend of protests in a dozen cities",
      "Governors activate the Guard as demonstrations spread",
    ],
  },
  {
    when: (s) => s.nation.unrest < 25,
    tone: "good",
    lines: [
      "A quieter country: civic tension at its lowest point in years",
      "Commentators note an unfamiliar calm in national politics",
    ],
  },
  {
    when: (s) => s.nation.debtToGdp > 125,
    tone: "bad",
    lines: [
      "Debt passes {debt}% of GDP; ratings agencies signal a review",
      "Interest costs now exceed the defense budget",
    ],
  },
  {
    when: (s) => s.politics.scandal > 45,
    tone: "bad",
    lines: [
      "Ethics questions widen as committee requests documents",
      "A drip of disclosures the White House cannot seem to stop",
    ],
  },
  {
    when: (s) => s.nation.sectors.healthcare < 32,
    tone: "bad",
    lines: [
      "Rural hospitals close at record pace",
      "Emergency rooms report the worst wait times on record",
    ],
  },
  {
    when: (s) => s.nation.sectors.infrastructure < 30,
    tone: "bad",
    lines: [
      "Another bridge closed for emergency inspection",
      "Water main failures leave two cities boiling their tap water",
    ],
  },
  {
    when: (s) => s.nation.standing > 70,
    tone: "good",
    lines: [
      "Allies call it the strongest alliance footing in a decade",
      "Summit ends with signatures on every line",
    ],
  },
  {
    when: (s) => s.nation.standing < 35,
    tone: "bad",
    lines: [
      "Allies quietly explore arrangements that do not involve us",
      "Diplomats describe a country talking mostly to itself",
    ],
  },
  {
    when: (s) => s.personal.marriage < 30,
    tone: "bad",
    lines: [
      "First Family spends another weekend apart, aides say nothing",
      "Speculation about the residence that the press office will not address",
    ],
  },
  {
    when: (s) => s.personal.health < 45,
    tone: "bad",
    lines: [
      "Questions about the president's stamina after a visibly hard week",
      "Physician's office declines to comment on schedule changes",
    ],
  },
  {
    when: () => true,
    tone: "neutral",
    lines: [
      "Congress returns to a docket nobody expects to finish",
      "A quiet week in Washington, which nobody trusts",
      "Sunday shows chew over the same three questions",
      "Governors gather to complain about the same funding formula",
    ],
  },
];

function fill(line: string, s: GameState): string {
  return line
    .replace("{approval}", Math.round(s.politics.approval).toString())
    .replace("{unemployment}", s.nation.unemployment.toFixed(1))
    .replace("{inflation}", s.nation.inflation.toFixed(1))
    .replace("{growth}", s.nation.growth.toFixed(1))
    .replace("{debt}", Math.round(s.nation.debtToGdp).toString());
}

/** Two headlines a month, drawn from whatever is actually true. */
export function generateNews(s: GameState, rng: Rng): NewsItem[] {
  const matching = TEMPLATES.filter((t) => t.when(s));
  const chosen: NewsItem[] = [];
  // Don't reprint a headline the reader saw in the last couple of months.
  const used = new Set(s.news.slice(0, 4).map((n) => n.headline));
  const wanted = Math.min(2, matching.length);
  for (let attempt = 0; attempt < 8 && chosen.length < wanted; attempt += 1) {
    const t = rng.pick(matching);
    const line = fill(rng.pick(t.lines), s);
    if (used.has(line)) continue;
    used.add(line);
    chosen.push({ month: s.month, headline: line, source: rng.pick(OUTLETS), tone: t.tone });
  }
  return chosen;
}

export function pushNews(s: GameState, items: NewsItem[]): void {
  s.news.unshift(...items);
  if (s.news.length > 60) s.news.length = 60;
}
