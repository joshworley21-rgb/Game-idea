import { secretaryWith } from "./temperament.ts";
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

  // ------------------------------------------------ the people you appointed
  //
  // These five are about a specific temperament in the cabinet, so which of
  // them a run can even see depends on who the seed put in the jobs. A term
  // with no rival in it never gets the rival's arc, and a term with one gets
  // a story the other run cannot.
  {
    id: "arc-rival-positioning",
    source: "Your Own Cabinet",
    title: "One of your secretaries is running for something",
    brief: (s) => {
      const person = secretaryWith(s, "rival");
      return person
        ? `${person.name} has a speaking schedule. Not the department's — their own. Three of the stops are in states that vote early, and the ${person.title.toLowerCase()}'s office has stopped clearing them with you.`
        : "Somebody in your cabinet has a speaking schedule nobody cleared with you.";
    },
    after: 9,
    when: (s) => {
      const person = secretaryWith(s, "rival");
      return Boolean(person && person.loyalty < 58);
    },
    weight: 1.5,
    choices: [
      {
        id: "let-them-run",
        label: "Let them run, and keep them in the room",
        detail: "A rival inside the tent is a rival you can see.",
        effects: { "politics.capital": -4, "politics.party": -3, "personal.stress": 4 },
        resultText:
          "They stay, and they are good at the job, and every meeting now has a second agenda in it that everybody can see and nobody says.",
      },
      {
        id: "clip-them",
        label: "Cut the travel budget and the press office",
        detail: "Petty, effective, and they will know exactly what happened.",
        effects: { "politics.capital": -2, "politics.party": 2, "personal.integrity": -2 },
        risk: 0.3,
        onFail: { "politics.scandal": 6, "politics.media": -6 },
        failText:
          "A memo about their travel schedule reaches a reporter within the week. It reads exactly as small as it was.",
        resultText:
          "The schedule thins out. They do not mention it and neither do you, and the temperature in the Cabinet Room drops four degrees for a month.",
      },
      {
        id: "promote-them",
        label: "Give them something big and public to own",
        detail: "Ambition with a deliverable attached is just work.",
        effects: { "politics.capital": -6, "politics.party": 4, "nation.standing": 2 },
        resultText:
          "They take it, because it is too good to refuse, and because taking it means owning whatever it turns into. Both of you understand the trade.",
      },
    ],
  },

  {
    id: "arc-believer-ultimatum",
    source: "Your Own Cabinet",
    title: "The one who came for the agenda would like to see it",
    brief: (s) => {
      const person = secretaryWith(s, "believer");
      const passed = s.counters.billsPassed ?? 0;
      return person
        ? `${person.name} took this job to do one thing, and ${passed === 0 ? "nothing has gone to the floor yet" : `${passed} ${passed === 1 ? "bill has" : "bills have"} passed and none of them were it`}. They have asked for twenty minutes and they have not said what about.`
        : "Somebody who came here to do one thing has asked for twenty minutes.";
    },
    after: 7,
    when: (s) => {
      const person = secretaryWith(s, "believer");
      return Boolean(person && person.loyalty < 62 && (s.counters.billsPassed ?? 0) < 2);
    },
    weight: 1.4,
    choices: [
      {
        id: "commit",
        label: "Promise them the floor this year, and mean it",
        detail: "It is a real commitment and the Hill will read it as one.",
        effects: { "politics.capital": -7, "politics.party": 3, "personal.integrity": 3 },
        resultText:
          "They go back to work like somebody who has been given a date. You have just spent capital you have not raised yet, on a vote you have not counted.",
      },
      {
        id: "level",
        label: "Tell them the truth: the votes are not there",
        detail: "Honest. It is also the thing they least want to hear.",
        effects: { "politics.capital": 2, "personal.integrity": 2, "personal.stress": 3 },
        resultText:
          "They take it better than you expected and worse than they let on. Something goes out of the way they argue in meetings after that.",
      },
      {
        id: "stall",
        label: "Tell them it is coming",
        detail: "It might be. Next year is a year.",
        effects: { "politics.capital": 3, "personal.integrity": -3 },
        risk: 0.35,
        onFail: { "politics.scandal": 5, "politics.party": -5 },
        failText:
          "They repeat your timeline to somebody who writes it down, and now it is a promise with a date on it that you did not make.",
        resultText:
          "They leave the room satisfied. You have bought about four months, and you have spent something you cannot put a number on.",
      },
    ],
  },

  {
    id: "arc-friend-cost",
    source: "The West Wing",
    title: "The job is taking somebody you brought with you",
    brief: (s) => {
      const person = secretaryWith(s, "friend");
      return person
        ? `${person.name} has been in this building ${person.months} months and has aged more than that. You have known them long enough to see it, which is the problem with knowing somebody that long.`
        : "Somebody you have known for twenty years is not doing well in this building.";
    },
    after: 11,
    when: (s) => {
      const person = secretaryWith(s, "friend");
      return Boolean(person && person.loyalty < 60) && s.personal.stress > 55;
    },
    weight: 1.3,
    choices: [
      {
        id: "let-them-go",
        label: "Give them a way out with their dignity",
        detail: "You lose a friend from the cabinet and keep one.",
        effects: { "politics.capital": -4, "politics.media": -2, "personal.stress": -4, "personal.integrity": 3 },
        resultText:
          "They argue for about ninety seconds and then they stop, which tells you they had been waiting for someone to say it. You get the friend back and the department gets somebody who is not tired.",
      },
      {
        id: "lighten-it",
        label: "Take some of it off them yourself",
        detail: "There is only one place that work can go.",
        effects: { "personal.stress": 9, "personal.health": -2, "politics.capital": 2 },
        resultText:
          "You take three of their files and two of their meetings. They look better within a month. You do not.",
      },
      {
        id: "say-nothing",
        label: "Say nothing and let them decide",
        detail: "They are an adult and this was their choice.",
        effects: { "personal.stress": 4 },
        risk: 0.4,
        onFail: { "politics.capital": -6, "personal.stress": 8, "politics.media": -3 },
        failText:
          "They keep going until they cannot, and it happens in front of people, and you knew and did nothing and both of you know that.",
        resultText:
          "They pull out of it on their own over the winter. You never raise it, and neither do they, and it sits in the room with you for the rest of the term.",
      },
    ],
  },

  {
    id: "arc-institutionalist-paper",
    source: "The Department",
    title: "Somebody has started putting things in writing",
    brief: (s) => {
      const person = secretaryWith(s, "institutionalist");
      return person
        ? `${person.name} has begun confirming your instructions by memo. Every one is polite, accurate, and copied to their own counsel. Thirty years in this building teaches you what a file is for.`
        : "Instructions from this office are being confirmed back to it in writing, and copied to counsel.";
    },
    after: 8,
    when: (s) => {
      const person = secretaryWith(s, "institutionalist");
      return Boolean(person) && s.politics.scandal > 38;
    },
    weight: 1.35,
    choices: [
      {
        id: "welcome-it",
        label: "Tell them to keep doing it, and copy you in",
        detail: "If the record is going to exist, it should be complete.",
        effects: { "politics.scandal": -6, "personal.integrity": 4, "politics.capital": -2 },
        resultText:
          "They are visibly surprised, which is the first time you have managed that. The memos keep coming and they start containing advice again rather than only dates.",
      },
      {
        id: "stop-it",
        label: "Make it clear the memos are not helping",
        detail: "A paper trail is a paper trail whoever is keeping it.",
        effects: { "politics.scandal": 4, "politics.media": -3, "personal.integrity": -4 },
        risk: 0.32,
        onFail: { "politics.scandal": 9, "politics.media": -7 },
        failText:
          "The memo in which you asked them to stop writing memos is itself a memo. It is a very good one and somebody else has it now.",
        resultText:
          "The memos stop. So does most of what they used to tell you before you asked, and you will not find out what you missed until later.",
      },
      {
        id: "ignore-paper",
        label: "Let them cover themselves",
        detail: "They are not wrong to. That is the uncomfortable part.",
        effects: { "personal.stress": 4, "politics.scandal": 1 },
        resultText:
          "You read every memo and answer none of them. The file grows all year, accurate and unanswered, and one day it will be read by somebody who was not in the room.",
      },
    ],
  },

  {
    id: "arc-technocrat-starved",
    source: "The Department",
    title: "The department that works wants to know why it is last",
    brief: (s) => {
      const person = secretaryWith(s, "technocrat");
      return person
        ? `${person.name} has sent a four-page note with a graph on page one. It shows their department's funding against what it is being asked to deliver, and the two lines crossed eleven months ago.`
        : "A four-page note with a graph on page one has arrived from a department that is running out of money.";
    },
    after: 9,
    when: (s) => {
      const person = secretaryWith(s, "technocrat");
      if (!person) return false;
      const sectors = Object.values(s.nation.sectors) as number[];
      return Boolean(person.loyalty < 64) && sectors.some((v) => v < 42);
    },
    weight: 1.3,
    choices: [
      {
        id: "fund-it",
        label: "Find the money out of the reserve",
        detail: "It comes from somewhere, and somewhere is always a deficit.",
        effects: { "nation.debtToGdp": 0.5, "politics.capital": -4, "nation.unrest": -3 },
        resultText:
          "The money moves. Nothing visible happens for five months and then a number that had been getting worse quietly stops.",
      },
      {
        id: "ask-for-cuts",
        label: "Ask them to do it for the money they have",
        detail: "Everybody is asked this. Most of them say yes.",
        effects: { "politics.capital": 3, "nation.unrest": 2 },
        resultText:
          "They send back a second note listing precisely what will not be done and when it will be noticed. It is dated, and they keep a copy.",
      },
      {
        id: "read-it",
        label: "Take the graph to the Cabinet Table yourself",
        detail: "Make it the budget's problem rather than a note in a drawer.",
        effects: { "politics.capital": -2, "politics.party": -2, "personal.stress": 3 },
        resultText:
          "The graph goes up on the wall in the Cabinet Room. Three other secretaries recognise their own department in it, which is either very useful or the start of a much bigger argument.",
      },
    ],
  },

  // ---------------------------------------------------- what you said to win
  {
    id: "arc-campaign-filing",
    source: "The Campaign, Still",
    title: "The October filing is back",
    brief: (s) =>
      s.flags["campaign:get-ahead"]
        ? "The financial filing you released yourself in October is back, because a committee has finished reading it. There is nothing in it. There is a hearing anyway, and hearings are not about what is in things."
        : s.flags["campaign:counterstory"]
          ? "The story you put out about your opponent ten days before the election has been traced to your campaign. Nobody has proved it. Everybody knows it."
          : "The financial filing your lawyers sat on in October has been obtained by a committee, and the part your lawyers were worried about is the part they have.",
    after: 6,
    when: (s) =>
      s.flags["campaign:get-ahead"] === true ||
      s.flags["campaign:lawyer-up"] === true ||
      s.flags["campaign:counterstory"] === true,
    weight: 1.2,
    choices: [
      {
        id: "testify",
        label: "Send counsel and answer everything",
        detail: "A week of coverage, and then it is a thing that was answered.",
        effects: { "politics.scandal": -7, "politics.media": 4, "politics.capital": -4, "personal.stress": 5 },
        resultText:
          "Four hours of it, live. It is not a good week and it is the last week it is about this.",
      },
      {
        id: "privilege",
        label: "Assert privilege and fight the subpoena",
        detail: "It buys months. It costs them in a particular way.",
        effects: { "politics.scandal": 5, "politics.media": -5, "politics.capital": 3 },
        risk: 0.3,
        onFail: { "politics.scandal": 8, "politics.party": -4 },
        failText:
          "The court is unimpressed and says so in a written opinion that is quoted for the rest of the term.",
        resultText:
          "The fight runs long enough that the committee's own term runs out first. You win it on the calendar, which is a way of winning.",
      },
      {
        id: "own-it",
        label: "Go on television and talk about it yourself",
        detail: "Unmediated, unscripted, and there is no second take.",
        effects: { "politics.media": 6, "personal.integrity": 3, "personal.stress": 6 },
        risk: 0.25,
        onFail: { "politics.approval": -3, "politics.scandal": 4 },
        failText:
          "You are asked a question you had not prepared for and you answer it honestly, and the honest answer is the clip.",
        resultText:
          "Twenty-two minutes, no notes. The people who were against you are still against you, and the people in the middle stop asking.",
      },
    ],
  },

  {
    id: "arc-base-play-bill",
    source: "The Base",
    title: "They want the thing you promised in the primary",
    brief: (s) =>
      `You won the primary by going to the flank and staying there. The people who carried you through February have been patient for ${s.month} months, and a letter with four hundred signatures on it says the patience is a loan, not a gift.`,
    after: 10,
    when: (s) => s.flags["campaign:base-play"] === true && s.politics.party < 62,
    weight: 1.3,
    choices: [
      {
        id: "deliver",
        label: "Put it on the floor, whatever it costs",
        detail: "It will not pass. Putting it there is the point.",
        effects: { "politics.capital": -8, "politics.party": 8, "politics.approval": -2 },
        resultText:
          "It fails by nine votes, on the record, with every name attached. Your base has never been happier with you and you have nothing to show for it but that.",
      },
      {
        id: "half-measure",
        label: "Give them an executive order instead",
        detail: "Smaller, faster, and reversible by the next person to sit here.",
        effects: { "politics.capital": -3, "politics.party": 3, "politics.media": -2 },
        resultText:
          "They take it, and they say the right things about it, and the letter-writers all understand exactly what they were given instead.",
      },
      {
        id: "move-on",
        label: "Tell them the primary is over",
        detail: "It is. That has never once made it easier to say.",
        effects: { "politics.party": -9, "politics.capital": 5, "blocs.activists": -5 },
        resultText:
          "The letter becomes an open letter, and then a group with a name, and by the spring it is somebody's campaign.",
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
