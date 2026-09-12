import type { Conversation } from "../types.ts";

/**
 * Family dinner, no staff.
 *
 * The speakers here are `spouse` and `child`, which resolve to the actual
 * people the run generated — so the face at the table is the same face that
 * appears upstairs in the residence, and the same one the bond meters belong
 * to. The second beat is deliberately a child rather than the spouse: the
 * thing that has been sitting there all week is usually theirs.
 */
export const FAMILY_DINNER: Conversation = {
  id: "family-dinner",
  station: "family",
  label: "Family dinner, no staff",
  detail: "Upstairs, phones in a basket, the schedule cleared for two hours.",
  ap: 1,
  cooldown: 2,
  intro: "Upstairs, phones in a basket. Two hours, if nothing breaks in on it.",
  startBeat: "open",
  beats: {
    open: {
      id: "open",
      speaker: { role: "spouse", name: "Your spouse", title: "your spouse", mood: "warm" },
      prompt:
        "Nobody brings up the polls, which took visible effort from everyone. It falls to you to set the tone.",
      options: [
        {
          id: "listen",
          label: "Ask what everyone actually did today",
          detail: "The small, unglamorous version of paying attention.",
          effects: { "personal.stress": -4 },
          target: "all",
          attention: 6,
          resultText: "",
          next: "deep",
        },
        {
          id: "unwind",
          label: "Let the evening be nothing at all",
          detail: "No agenda. Sometimes that is the gift.",
          effects: { "personal.stress": -8 },
          target: "all",
          attention: 3,
          resultText: "",
          next: "deep",
        },
        {
          id: "work-creeps-in",
          label: "Take the one call you said you wouldn't",
          detail: "Ten minutes. It is never ten minutes.",
          effects: { "personal.stress": 2, "politics.capital": 3 },
          target: "all",
          attention: -2,
          resultText: "",
          next: "deep",
        },
      ],
    },
    deep: {
      id: "deep",
      speaker: { role: "child", name: "One of your children", title: "your child", mood: "concerned" },
      prompt: "One of them finally says the thing that has actually been sitting there all week.",
      options: [
        {
          id: "engage",
          label: "Put the fork down and actually talk it through",
          detail: "It takes the rest of the evening. That is the point.",
          requires: (path) => !path.includes("work-creeps-in"),
          effects: { "personal.stress": -3, "personal.integrity": 2 },
          target: "all",
          attention: 5,
          resultText: "It is not solved by dessert. It is heard, which is most of what was being asked for.",
        },
        {
          id: "reassure",
          label: "Reassure them without digging into it",
          detail: "Kinder in the moment, and it will come back around.",
          requires: (path) => !path.includes("work-creeps-in"),
          effects: {},
          target: "all",
          attention: 2,
          resultText: "It smooths the table over. It does not go away.",
        },
        {
          id: "apologize",
          label: "Apologize for the call, then listen",
          detail: "Start by admitting you weren't fully there.",
          requires: (path) => path.includes("work-creeps-in"),
          effects: { "personal.stress": -2 },
          target: "all",
          attention: 4,
          resultText: "\"I know,\" you say. \"I'm here now.\" It is enough to get the evening back.",
        },
        {
          id: "change-subject",
          label: "Steer it back to something lighter",
          detail: "Not tonight, is the message, however it's phrased.",
          effects: {},
          target: "all",
          attention: 1,
          resultText: "The table takes the hint and lets it go. It will keep, and it will cost interest.",
        },
      ],
    },
  },
};
