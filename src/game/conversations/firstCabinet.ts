import type { Conversation } from "../types.ts";
import { CHIEF_NAME, CHIEF_TITLE } from "../chief.ts";

/**
 * The first cabinet meeting, in the first month.
 *
 * This is not the standing monthly meeting — that is `cabinet.ts`. This is
 * the one where you walk into the Cabinet Room for the first time and six
 * people who were appointed before you arrived decide what kind of president
 * they have. It fires once, in month 1, and it is how the player learns who
 * is running the departments.
 *
 * The speakers are roles, so the meeting reads correctly whoever the seed
 * put in the jobs.
 */
export const FIRST_CABINET: Conversation = {
  id: "first-cabinet",
  station: "staff",
  label: "Meet your cabinet",
  detail:
    "Six people you did not appoint are waiting in the Cabinet Room. They have read your speeches. They want to know which one you meant.",
  ap: 1,
  available: (s) => s.month <= 3 && !s.flags["met:cabinet"],
  intro:
    "The Cabinet Room, ten past nine. Six secretaries, already seated, already briefed. " +
    "Ruth has put you at the head of the table and left the door open behind her.",
  startBeat: "open",
  beats: {
    open: {
      id: "open",
      speaker: {
        role: "chief",
        name: CHIEF_NAME,
        title: CHIEF_TITLE,
        mood: "guarded",
      },
      prompt:
        "Ruth does not sit down. \"They have all read your acceptance speech,\" she says, quietly, at your shoulder. " +
        "\"They have each decided which half of it you meant. This is the meeting where you tell them.\" " +
        "Six faces, waiting. How do you open?",
      options: [
        {
          id: "ask-them",
          label: "Ask each of them what they think the job is",
          detail:
            "Slow, and it tells you more about the room than any briefing would.",
          effects: { "politics.capital": 3, "politics.party": 2, "personal.stress": 2 },
          resultText: "",
          next: "answers",
        },
        {
          id: "set-direction",
          label: "Tell them what the next year is for",
          detail:
            "Fast, and it makes you the author of the agenda rather than its editor.",
          effects: { "politics.capital": 6, "politics.party": 4, "personal.stress": 3 },
          resultText: "",
          next: "direction",
        },
        {
          id: "defer-ruth",
          label: "Let Ruth run it, and listen",
          detail:
            "She has done this four times. You have done it once, today.",
          effects: { "politics.capital": 2, "personal.stress": -2, "politics.party": 1 },
          resultText: "",
          next: "ruth-runs",
        },
      ],
    },

    // ------------------------------------------------------- ask them first
    answers: {
      id: "answers",
      speaker: {
        role: "treasury",
        name: "The Treasury Secretary",
        title: "Treasury Secretary",
        mood: "neutral",
      },
      prompt:
        "The Treasury Secretary goes first, because of course she does. She talks for four minutes about " +
        "the deficit and does not once look at her notes. When she finishes, the Defense Secretary is " +
        "waiting, and he has clearly been waiting since before you sat down.",
      options: [
        {
          id: "let-defense",
          label: "Let him have the room",
          detail: "He has something to say and it will be worse if he holds it.",
          effects: { "nation.security": 2, "politics.party": 1, "personal.stress": 2 },
          resultText: "",
          next: "defense-speaks",
        },
        {
          id: "cut-to-it",
          label: "Cut to the decision you actually need",
          detail: "The room has given you what it has. Now you want a vote.",
          effects: { "politics.capital": 4, "politics.party": -1, "personal.stress": 1 },
          resultText: "",
          next: "the-ask",
        },
      ],
    },

    defense-speaks: {
      id: "defense-speaks",
      speaker: {
        role: "defense",
        name: "The Defense Secretary",
        title: "Defense Secretary",
        mood: "concerned",
      },
      prompt:
        "He does not talk about the deficit. He talks about a carrier group that has been at sea for " +
        "seven months and a readiness report he has read twice. \"Nobody in this room has been told " +
        "what we are for,\" he says. \"I would like to know before I have to spend money on it.\"",
      options: [
        {
          id: "give-him-a-doctrine",
          label: "Give him a doctrine, there and then",
          detail: "It commits you to something in front of six witnesses.",
          effects: {
            "nation.standing": 3,
            "nation.security": 3,
            "politics.party": 2,
            "personal.stress": 4,
          },
          resultText: "",
          next: "the-ask",
        },
        {
          id: "defer-doctrine",
          label: "Tell him the doctrine is coming, and mean it",
          detail: "Honest, and it leaves him holding the question.",
          effects: { "nation.security": -1, "politics.party": -2, "personal.integrity": 2 },
          resultText: "",
          next: "the-ask",
        },
      ],
    },

    // ------------------------------------------------------ set the direction
    direction: {
      id: "direction",
      speaker: "The room",
      prompt:
        "You talk for eleven minutes. Nobody interrupts, which is not the same as agreement. " +
        "When you stop, the Attorney General is writing something down and the Health Secretary " +
        "has not moved since you started.",
      options: [
        {
          id: "ask-for-objections",
          label: "Ask who disagrees",
          detail: "You will find out now or you will find out in six months.",
          effects: { "politics.capital": 2, "politics.party": 3, "personal.stress": 3 },
          resultText: "",
          next: "objections",
        },
        {
          id: "move-to-work",
          label: "Move straight to the work",
          detail: "The direction is set. The details are theirs.",
          effects: { "politics.capital": 5, "politics.party": 1 },
          resultText: "",
          next: "the-ask",
        },
      ],
    },

    objections: {
      id: "objections",
      speaker: {
        role: "justice",
        name: "The Attorney General",
        title: "Attorney General",
        mood: "guarded",
      },
      prompt:
        "The Attorney General puts her pen down. \"I disagree with about a third of it,\" she says, " +
        "and she does not soften it. \"I am telling you that now because you asked, and because " +
        "the last president did not ask, and I spent two years finding out the hard way.\"",
      options: [
        {
          id: "thank-her",
          label: "Thank her for it, in front of everyone",
          detail: "It costs you nothing and it buys the whole room.",
          effects: { "politics.party": 5, "politics.capital": 2, "personal.integrity": 2 },
          resultText: "",
          next: "the-ask",
        },
        {
          id: "note-it",
          label: "Note it, and move on",
          detail: "You have heard her. You have not agreed to anything.",
          effects: { "politics.capital": 3, "politics.party": -2 },
          resultText: "",
          next: "the-ask",
        },
      ],
    },

    // ---------------------------------------------------------- ruth runs it
    "ruth-runs": {
      id: "ruth-runs",
      speaker: {
        role: "chief",
        name: CHIEF_NAME,
        title: CHIEF_TITLE,
        mood: "neutral",
      },
      prompt:
        "Ruth runs it like a woman who has run four hundred of these. Agenda, timings, who speaks " +
        "when, and a hard stop at ten. You watch six people be managed by somebody who has never " +
        "once raised her voice, and you learn more about your cabinet in forty minutes than any " +
        "briefing would have told you.",
      options: [
        {
          id: "watch-and-learn",
          label: "Keep watching",
          detail: "There is a version of this job where you never have to do this yourself.",
          effects: { "politics.capital": 3, "personal.stress": -3, "politics.party": 2 },
          resultText: "",
          next: "the-ask",
        },
        {
          id: "take-it-back",
          label: "Take the room back halfway through",
          detail: "It is your cabinet. It should be your meeting.",
          effects: { "politics.capital": 4, "politics.party": 3, "personal.stress": 2 },
          resultText: "",
          next: "the-ask",
        },
      ],
    },

    // ------------------------------------------------------------- the ask
    "the-ask": {
      id: "the-ask",
      speaker: {
        role: "chief",
        name: CHIEF_NAME,
        title: CHIEF_TITLE,
        mood: "guarded",
      },
      prompt:
        "The meeting is nearly done. Ruth catches your eye from the end of the table and taps her watch. " +
        "There is one thing left, and it is the thing the whole room has been waiting for: " +
        "what you actually want from them this year.",
      options: [
        {
          id: "ask-for-loyalty",
          label: "Ask for their loyalty",
          detail: "They will give it. Whether they mean it is a different question.",
          effects: {
            "politics.party": 6,
            "politics.capital": 3,
            "personal.integrity": -2,
          },
          resultText:
            "Six people say yes. Two of them mean it, and you will not find out which two for a year.",
        },
        {
          id: "ask-for-candour",
          label: "Ask them to tell you when you are wrong",
          detail: "It is a harder thing to ask for and a harder thing to give.",
          effects: {
            "politics.party": 3,
            "personal.integrity": 4,
            "politics.capital": 1,
            "personal.stress": 2,
          },
          resultText:
            "The Attorney General nods. The Treasury Secretary does not, and that tells you something too.",
        },
        {
          id: "ask-for-results",
          label: "Ask for results, and nothing else",
          detail: "The job is the job. Sentiment is for other rooms.",
          effects: {
            "politics.capital": 7,
            "politics.party": -2,
            "personal.stress": 3,
          },
          resultText:
            "They understand the terms. It is a clean way to run a cabinet and a cold one.",
        },
      ],
    },
  },
};
