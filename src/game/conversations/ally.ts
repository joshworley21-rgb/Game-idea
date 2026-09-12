import type { Conversation } from "../types.ts";

/**
 * The call with an ally. A head of government, not a member of the cast, so
 * they carry their own name and seed — and they open worried, which is what
 * the portrait shows.
 */
export const CALL_ALLY: Conversation = {
  id: "call-ally",
  station: "phone",
  label: "Call an ally",
  detail: "Forty minutes with a head of government who needs reassuring.",
  ap: 1,
  cooldown: 2,
  intro: "Forty minutes, a translator on the line, and a head of government who needs reassuring.",
  startBeat: "open",
  beats: {
    open: {
      id: "open",
      speaker: { role: "ally", name: "The Prime Minister", title: "Head of government", mood: "concerned" },
      prompt:
        "They open worried: their own parliament is asking out loud whether the alliance still means what it used to.",
      options: [
        {
          id: "reassure",
          label: "Reaffirm the commitment plainly",
          detail: "No hedging. It costs nothing today and is remembered later.",
          effects: { "nation.standing": 5, "personal.stress": 1 },
          resultText: "",
          next: "ask",
        },
        {
          id: "hedge",
          label: "Reassure them, but hedge on specifics",
          detail: "Keeps your options open at home.",
          effects: { "nation.standing": 2, "politics.capital": 2 },
          resultText: "",
          next: "ask",
        },
        {
          id: "redirect",
          label: "Turn it into a trade conversation instead",
          detail: "Transactional, and they will notice that it is.",
          effects: { "nation.standing": 1, "nation.growth": 0.05 },
          resultText: "",
          next: "ask",
        },
      ],
    },
    ask: {
      id: "ask",
      speaker: { role: "ally", name: "The Prime Minister", title: "Head of government", mood: "neutral" },
      prompt:
        "Satisfied for now, they ask for something concrete before the call ends — a joint statement, or forces for a coming exercise.",
      options: [
        {
          id: "statement",
          label: "Agree to the joint statement",
          detail: "Words, mostly. Words that get quoted for years.",
          requires: (path) => path.includes("reassure") || path.includes("hedge"),
          effects: { "nation.standing": 4, "politics.capital": -2 },
          resultText: "The statement is stronger than either side's lawyers wanted. It holds.",
        },
        {
          id: "exercise",
          label: "Commit forces to the exercise",
          detail: "Real, visible, and not free.",
          requires: (path) => path.includes("reassure") || path.includes("hedge"),
          effects: { "nation.standing": 6, "nation.security": 2, "personal.stress": 3, "politics.capital": -3 },
          resultText: "It is a small deployment with a large photograph. Both governments get their headline.",
        },
        {
          id: "trade-terms",
          label: "Give ground on trade terms",
          detail: "The conversation you steered it toward.",
          requires: (path) => path.includes("redirect"),
          effects: { "nation.standing": 3, "nation.growth": -0.05, "politics.party": -2 },
          resultText: "They get their market access. Someone at home will call it a giveaway by Friday.",
        },
        {
          id: "stall",
          label: "Say you'll need to take it back to your team",
          detail: "True, and also a way of saying not yet.",
          effects: { "nation.standing": -2 },
          resultText: "They hear the delay for what it is. The call ends warm anyway.",
        },
      ],
    },
  },
};
