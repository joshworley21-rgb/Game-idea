import type { Conversation } from "../types.ts";
import { CHIEF_NAME, CHIEF_TITLE } from "../chief.ts";

/**
 * The address to a joint session of Congress.
 *
 * A new president speaks to the House and Senate in the first weeks. It is
 * not a legal requirement — it is a courtesy, and skipping it is a statement.
 * What you say in that room sets what the next year is about, which makes it
 * the first decision of the presidency that actually costs something.
 *
 * The three openings are the three ways a president can spend a first
 * address: on the country, on the Congress, or on the party. Each one buys a
 * different year.
 */
export const ADDRESS_HOUSE: Conversation = {
  id: "address-house",
  station: "press",
  label: "Address the joint session",
  detail:
    "The House, the Senate, the cabinet, the Court and the networks. You get one of these a year and this is the one that counts.",
  ap: 2,
  available: (s) => s.month <= 4 && !s.flags["addressed:house"],
  intro:
    "The Capitol, twenty past eight. The Sergeant at Arms has announced you twice. " +
    "Four hundred and thirty-five members of the House, a hundred senators, the cabinet, " +
    "the Court, and every network in the country. Ruth is in the gallery, watching.",
  startBeat: "walk-in",
  beats: {
    "walk-in": {
      id: "walk-in",
      speaker: {
        role: "chief",
        name: CHIEF_NAME,
        title: CHIEF_TITLE,
        mood: "guarded",
      },
      prompt:
        "You have the speech in your hand and eleven minutes of the country's attention. " +
        "Ruth's note, in the car, was three words: \"Pick one thing.\" " +
        "What is the address for?",
      options: [
        {
          id: "the-country",
          label: "The country — name the thing you were elected to fix",
          detail:
            "It is the honest speech. It is also the one that commits you to a number.",
          effects: {
            "politics.approval": 6,
            "politics.media": 3,
            "blocs.labour": 4,
            "blocs.young": 3,
            "politics.party": -2,
          },
          resultText: "",
          next: "the-country-2",
        },
        {
          id: "the-congress",
          label: "The Congress — tell them what you need from them",
          detail:
            "A working speech, aimed at four hundred people in the room rather than forty million outside it.",
          effects: {
            "politics.house": 5,
            "politics.senate": 4,
            "politics.capital": 6,
            "politics.approval": 1,
            "politics.media": -1,
          },
          resultText: "",
          next: "the-congress-2",
        },
        {
          id: "the-party",
          label: "Your own party — give them the fight they want",
          detail:
            "It will be a great night for your base and a difficult morning for everyone else.",
          effects: {
            "politics.party": 10,
            "blocs.activists": 6,
            "blocs.traditionalists": 5,
            "politics.approval": -2,
            "politics.media": -3,
          },
          resultText: "",
          next: "the-party-2",
        },
      ],
    },

    // ------------------------------------------------------- the country
    "the-country-2": {
      id: "the-country-2",
      speaker: "The chamber",
      prompt:
        "You name it plainly, and for about ninety seconds the room is completely still. " +
        "Then the two sides remember themselves: your benches stand, the other side sits " +
        "with their arms folded, and the networks cut to their panels before you have finished " +
        "the sentence. The number you said is now the number you own.",
      options: [
        {
          id: "hold-the-number",
          label: "Hold the number, whatever it costs",
          detail: "You have made it a promise. Promises are expensive and they are worth something.",
          effects: {
            "politics.approval": 3,
            "personal.integrity": 5,
            "politics.capital": -4,
            "personal.stress": 4,
          },
          resultText: "",
          next: "aftermath",
        },
        {
          id: "soften-it",
          label: "Soften it in the follow-up interviews",
          detail: "The number becomes a goal, and a goal is not a promise.",
          effects: {
            "politics.approval": 1,
            "personal.integrity": -3,
            "politics.media": -2,
            "politics.capital": 2,
          },
          resultText: "",
          next: "aftermath",
        },
      ],
    },

    // ------------------------------------------------------- the congress
    "the-congress-2": {
      id: "the-congress-2",
      speaker: "The chamber",
      prompt:
        "You speak to the room rather than the cameras, and the room notices. " +
        "You name three bills, two chairmen and one vote, and by the time you reach the " +
        "peroration there are members on both sides taking notes. It is not a speech that " +
        "will be replayed. It is a speech that will be acted on.",
      options: [
        {
          id: "name-the-vote",
          label: "Name the vote and dare them to hold it",
          detail: "It puts a date on the calendar and your name on the line.",
          effects: {
            "politics.house": 3,
            "politics.capital": 4,
            "politics.party": -2,
            "personal.stress": 3,
          },
          resultText: "",
          next: "aftermath",
        },
        {
          id: "leave-it-open",
          label: "Leave the timing to the leadership",
          detail: "It keeps the goodwill and gives away the leverage.",
          effects: {
            "politics.house": 5,
            "politics.senate": 3,
            "politics.capital": -2,
          },
          resultText: "",
          next: "aftermath",
        },
      ],
    },

    // ---------------------------------------------------------- the party
    "the-party-2": {
      id: "the-party-2",
      speaker: "The chamber",
      prompt:
        "You give them the fight. Your benches are on their feet four times before you reach " +
        "the second page, and the other side stops pretending to listen. " +
        "It is the best speech of your life and it was not addressed to the country.",
      options: [
        {
          id: "own-it",
          label: "Own it — this is who you are",
          detail: "The base is yours for four years. The middle is not.",
          effects: {
            "politics.party": 6,
            "blocs.activists": 4,
            "politics.approval": -3,
            "blocs.suburban": -4,
          },
          resultText: "",
          next: "aftermath",
        },
        {
          id: "reach-out",
          label: "Reach for the middle in the last two minutes",
          detail: "It is a different speech bolted onto the end of this one, and it shows.",
          effects: {
            "politics.party": -3,
            "politics.approval": 2,
            "blocs.suburban": 3,
            "politics.media": 1,
          },
          resultText: "",
          next: "aftermath",
        },
      ],
    },

    // ------------------------------------------------------------ aftermath
    aftermath: {
      id: "aftermath",
      speaker: {
        role: "chief",
        name: CHIEF_NAME,
        title: CHIEF_TITLE,
        mood: "neutral",
      },
      prompt:
        "The car, afterwards. Ruth has the overnight numbers on her phone and does not read them out. " +
        "\"That is the year set,\" she says. \"Everything you do from here is either keeping that " +
        "promise or explaining why you did not.\" She looks out of the window for a moment. " +
        "\"The last one who spoke like that lasted a term. The one before lasted two.\"",
      options: [
        {
          id: "ask-which",
          label: "Ask her which one you just was",
          detail: "She has an answer. She has had it since the car door closed.",
          effects: { "personal.stress": 2, "politics.capital": 2 },
          resultText:
            "\"Too early,\" she says, and goes back to her phone. It is the first time she has " +
            "refused you anything, and you notice it.",
        },
        {
          id: "say-nothing",
          label: "Say nothing, and watch the city go past",
          detail: "There is nothing to say. It is done.",
          effects: { "personal.stress": -2, "personal.integrity": 1 },
          resultText:
            "You ride the rest of the way in silence. It is the most comfortable you have been " +
            "since the oath.",
        },
      ],
    },
  },
};
