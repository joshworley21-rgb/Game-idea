import type { Effects, GameState } from "./types.ts";

/**
 * Story arcs: the things that take months to arrive.
 *
 * A crisis is something that happens to you. An arc is something you did,
 * coming back. The cabinet meeting where you overruled your treasury
 * secretary, the leak you sat on, the child you have not seen since the
 * inauguration — none of those are events. They are situations that ripen,
 * and this is where they are written.
 *
 * An arc is checked once a month. When its `when` holds and its `after` month
 * has passed, it fires as a decision with a name on it, and then it is done.
 * Arcs are one-shot: `flags` records that one has fired so it cannot repeat.
 */

export interface ArcChoice {
  id: string;
  label: string;
  detail: string;
  effects: Effects;
  resultText: string;
  /** Chance this backfires, 0-1. */
  risk?: number;
  onFail?: Effects;
  failText?: string;
}

export interface Arc {
  id: string;
  /** Who it is about, shown above the decision. */
  source: string;
  title: string;
  /** The brief. A function when it needs to name the people involved. */
  brief: string | ((s: GameState) => string);
  /** Only fires once this month has passed. */
  after: number;
  /** Only fires while this holds. */
  when: (s: GameState) => boolean;
  /** Relative likelihood once eligible. */
  weight: number;
  choices: ArcChoice[];
}

/**
 * The arcs. Each one is a consequence with a face on it: something the player
 * did earlier, arriving as a person who wants an answer.
 */
export const ARCS: Arc[] = [
  // ------------------------------------------------------------- the cabinet
  {
    id: "arc-treasury-feud",
    source: "The Treasury Department",
    title: "Your Treasury Secretary has stopped returning calls",
    brief: (s) => {
      const person = s.cabinet?.find((c) => c.office === "treasury");
      return person
        ? `${person.name} has been in the job ${person.months} months and has not been in the Oval Office since the spring. Her department is answering the White House in writing now, which is a way of saying no.`
        : "The Treasury has gone quiet, and quiet is not the same as agreement.";
    },
    after: 8,
    when: (s) => {
      const person = s.cabinet?.find((c) => c.office === "treasury");
      return Boolean(person && person.loyalty < 42);
    },
    weight: 1.4,
    choices: [
      {
        id: "repair",
        label: "Bring her in and give her the room",
        detail: "It costs you an afternoon and some of the agenda.",
        effects: { "politics.capital": -3, "personal.stress": 3, "nation.growth": 0.08 },
        resultText:
          "She talks for forty minutes without notes. Half of it is a complaint and half of it is the best economic advice you have had this year.",
      },
      {
        id: "replace",
        label: "Move her out and put your own person in",
        detail: "Cleaner, and everyone will read it as a purge.",
        effects: { "politics.capital": -6, "politics.party": -4, "politics.media": -3, "personal.stress": 5 },
        resultText:
          "The resignation is announced as a return to the private sector. Nobody in Washington believes that, and the markets take a day to decide how they feel.",
      },
      {
        id: "ignore",
        label: "Let her work it out on her own",
        detail: "She is a professional. She will either come round or she will not.",
        effects: { "politics.capital": 2, "nation.growth": -0.12 },
        resultText:
          "The Treasury keeps producing competent documents that quietly assume none of your priorities are going to happen.",
      },
    ],
  },

  // ---------------------------------------------------------------- the leak
  {
    id: "arc-leak-source",
    source: "The West Wing",
    title: "They have found who has been talking",
    brief: (s) => {
      const person = s.cabinet?.find((c) => c.office === "chief");
      return person
        ? `The counsel's office has a name, and it is somebody who sits in ${person.name}'s meetings. The file is on your desk and nobody else has read it.`
        : "The counsel's office has a name. The file is on your desk and nobody else has read it.";
    },
    after: 10,
    when: (s) => s.politics.scandal > 34,
    weight: 1.3,
    choices: [
      {
        id: "prosecute",
        label: "Refer it to Justice and let it run",
        detail: "The process is the point, and the process is slow.",
        effects: { "politics.scandal": -9, "politics.media": 4, "politics.party": -3, "personal.stress": 4 },
        resultText:
          "You hand the file over and say nothing else about it. It takes four months and it ends with a plea, and the story dies with it.",
      },
      {
        id: "confront-privately",
        label: "Call them in and end it in the room",
        detail: "No lawyers. No file. Just the two of you.",
        effects: { "politics.scandal": -5, "personal.stress": 6, "personal.integrity": 3 },
        risk: 0.25,
        onFail: { "politics.scandal": 6, "politics.media": -6 },
        failText:
          "They deny it to your face, and then they go and tell three people you asked. The leak gets worse and now it has a grievance.",
        resultText:
          "They do not admit it. They do not have to. The leaking stops within the month, which is its own kind of answer.",
      },
      {
        id: "sit-on-it",
        label: "Put the file in a drawer",
        detail: "You know. That is enough for now.",
        effects: { "personal.stress": 8, "politics.scandal": 3 },
        resultText:
          "You know who it is every time you walk into the room, and you have to behave as though you do not. That is a tax you pay every day.",
      },
    ],
  },

  // -------------------------------------------------------------- the family
  {
    id: "arc-child-away",
    source: "The Residence",
    title: "Your child has stopped coming home",
    brief: (s) => {
      const child = s.family?.find((m) => m.kind === "child" && m.since >= 6);
      return child
        ? `${child.name} has not been in the residence since the spring. They are ${child.age}, they are ${child.doing}, and the last three calls went to voicemail.`
        : "One of them has stopped coming home, and the residence is quieter for it.";
    },
    after: 12,
    when: (s) => Boolean(s.family?.some((m) => m.kind === "child" && m.since >= 6)),
    weight: 1.5,
    choices: [
      {
        id: "go-to-them",
        label: "Clear a day and go to them",
        detail: "Not the residence. Not with a detail in the room.",
        effects: { "personal.stress": -6, "personal.integrity": 3, "politics.capital": -4 },
        resultText:
          "You take one car and two agents and you sit in a kitchen that is not yours for four hours. It is awkward for the first one. It is not by the fourth.",
      },
      {
        id: "bring-them-in",
        label: "Have them brought to the residence for a weekend",
        detail: "The schedule can hold a weekend. Probably.",
        effects: { "personal.stress": -2 },
        risk: 0.35,
        onFail: { "personal.stress": 5 },
        failText:
          "A crisis lands on the Friday and you spend the weekend in the Situation Room. They leave on Sunday without saying goodbye, which is a thing they have learned from you.",
        resultText:
          "The weekend holds. Nobody talks about anything important, which turns out to be the important part.",
      },
      {
        id: "let-them-be",
        label: "Let them have their own life",
        detail: "They are an adult. So are you.",
        effects: { "personal.stress": 3 },
        resultText:
          "You decide not to make it a thing. They are doing what people their age do, which is not a crisis, and you tell yourself that more than once.",
      },
    ],
  },

  // ------------------------------------------------------------- the party
  {
    id: "arc-primary-challenge",
    source: "Your Own Party",
    title: "Someone is measuring the drapes",
    brief: (s) =>
      `A governor has been making calls. Nothing announced, nothing on the record, but three of your own senators have taken the meeting. Your party's patience with ${Math.round(s.politics.approval)}% approval has run out.`,
    after: 20,
    when: (s) => s.politics.approval < 40 && s.politics.party < 45,
    weight: 1.2,
    choices: [
      {
        id: "muscle",
        label: "Call every one of them personally",
        detail: "Remind them what you have done for their districts.",
        effects: { "politics.party": 9, "politics.capital": -5, "personal.stress": 5 },
        resultText:
          "You spend two days on the phone. Nobody commits to anything, and nobody takes another meeting either.",
      },
      {
        id: "let-them",
        label: "Let them have their primary",
        detail: "You have never lost a fight you did not take.",
        effects: { "politics.party": -8, "politics.capital": 4, "personal.stress": -3 },
        risk: 0.4,
        onFail: { "politics.party": -6, "politics.media": -5 },
        failText:
          "The challenge becomes real, and it becomes the story of the year. Every decision you make from here is read through it.",
        resultText:
          "The governor looks at the numbers, decides the moment has passed, and announces for something else entirely.",
      },
      {
        id: "buy-them",
        label: "Find something for the governor to do",
        detail: "An ambassadorship is cheaper than a primary.",
        effects: { "politics.party": 4, "politics.capital": -8, "politics.media": -2 },
        resultText:
          "There is a posting that suits them, and it is far away. The party settles, and everyone understands exactly what happened.",
      },
    ],
  },

  // ------------------------------------------------------------ the country
  {
    id: "arc-unrest-organised",
    source: "The Streets",
    title: "The protests have organisers now",
    brief: (s) =>
      `What began as a crowd has become a movement with a name, a bank account and a list of demands. Unrest is at ${Math.round(s.nation.unrest)} and it is no longer weather. It is a constituency.`,
    after: 14,
    when: (s) => s.nation.unrest > 62,
    weight: 1.4,
    choices: [
      {
        id: "meet",
        label: "Meet their leadership, on the record",
        detail: "It legitimises them. It also ends the standoff.",
        effects: { "nation.unrest": -14, "politics.media": 3, "blocs.activists": 6, "blocs.traditionalists": -5 },
        resultText:
          "You sit down with four people who have never been in the White House and will not forget it. Half the country calls it surrender. The other half stops marching.",
      },
      {
        id: "police",
        label: "Restore order first, talk later",
        detail: "The polls say the country wants the streets clear.",
        effects: { "nation.unrest": -8, "blocs.suburban": 5, "blocs.activists": -9, "blocs.young": -6, "politics.media": -4 },
        resultText:
          "The streets are clear within a week. The footage is not, and it will be in every ad made about you for the rest of your life.",
      },
      {
        id: "wait",
        label: "Let it burn itself out",
        detail: "Movements without a win lose momentum.",
        effects: { "nation.unrest": 4, "politics.approval": -2 },
        resultText:
          "It does not burn out. It gets smaller, and harder, and it is still there in the spring.",
      },
    ],
  },
];

/** Arcs that could fire right now, given the state. */
export function eligibleArcs(s: GameState): Arc[] {
  return ARCS.filter((a) => !s.flags[`arc:${a.id}`] && s.month >= a.after && a.when(s));
}

export function arcById(id: string): Arc | undefined {
  return ARCS.find((a) => a.id === id);
}
