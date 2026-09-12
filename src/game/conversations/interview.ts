import type { Conversation } from "../types.ts";

/**
 * The hostile interview. The correspondent is not a member of the cast, so she
 * carries her own name and seed — but she is a person with a face, and she is
 * hostile from the first beat.
 */
export const INTERVIEW: Conversation = {
  id: "interview",
  station: "press",
  label: "Sit for a hostile interview",
  detail: "An hour with someone who has done the reading and does not like you.",
  ap: 1,
  cooldown: 4,
  intro: "The lights are already hot. She has done her homework, and she is not here to be liked either.",
  startBeat: "open",
  beats: {
    open: {
      id: "open",
      speaker: { role: "press", name: "The correspondent", title: "Political correspondent", mood: "hostile" },
      prompt:
        "She opens with the unemployment numbers, and whether you still stand behind last quarter's forecast.",
      options: [
        {
          id: "own-it",
          label: "Own the number, explain the plan",
          detail: "Slower, and it reads as honest.",
          effects: { "politics.media": 5, "politics.approval": 2, "personal.integrity": 2 },
          resultText: "",
          next: "follow",
        },
        {
          id: "deflect",
          label: "Pivot to the bigger picture",
          detail: "Safe. Also visibly a pivot.",
          effects: { "politics.media": 1, "politics.approval": 1 },
          resultText: "",
          next: "follow",
        },
        {
          id: "counterattack",
          label: "Question where her numbers come from",
          detail: "It plays well with people who already like you.",
          effects: { "politics.media": -4, "politics.party": 3 },
          risk: 0.3,
          onFail: { "politics.media": -9, "politics.approval": -3 },
          failText: "The clip is thirty seconds long and it is everywhere by morning.",
          resultText: "",
          next: "follow",
        },
      ],
    },
    follow: {
      id: "follow",
      speaker: { role: "press", name: "The correspondent", title: "Political correspondent", mood: "guarded" },
      prompt:
        "She follows up on whether the cabinet actually agrees with you, and names the memo that leaked last month.",
      options: [
        {
          id: "double-down",
          label: "Say the leak is the real story here",
          detail: "Turn the question back on the room that produced it.",
          requires: (path) => path.includes("counterattack"),
          effects: { "politics.media": -3, "politics.scandal": 3, "politics.party": 4 },
          resultText: "It lands with people already on your side. It does not land anywhere else.",
        },
        {
          id: "straight-answer",
          label: "Answer straight — yes, there was disagreement, and that's fine",
          detail: "Disagreement in a cabinet is not, on its own, a scandal.",
          requires: (path) => !path.includes("counterattack"),
          effects: { "politics.media": 4, "personal.integrity": 3, "politics.party": -1 },
          resultText: "It is a strange thing to watch a politician just answer the question. The room notices.",
        },
        {
          id: "no-comment",
          label: "Decline to discuss internal deliberations",
          detail: "The safest thing to say, and it reads that way.",
          effects: { "politics.media": -2, "politics.scandal": -1 },
          resultText: "\"I won't get into internal conversations,\" you say, for the fourth time this year.",
        },
      ],
    },
  },
};
