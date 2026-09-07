import type { Conversation } from "./types.ts";

/**
 * Meetings, played out rather than resolved in one click. Each one replaces
 * a flat action of the same name that used to just apply its effects and
 * print a result line — these apply effects beat by beat, and what you say
 * first can open or close what you're offered next.
 */
export const CONVERSATIONS: Conversation[] = [
  // --------------------------------------------------------- Cabinet Room
  {
    id: "cabinet",
    station: "staff",
    label: "Run a cabinet meeting",
    detail: "Two hours of alignment. Unglamorous, and it is where capital comes from.",
    ap: 1,
    cooldown: 2,
    intro: "The Cabinet Room, half past nine. Six secretaries, six different ideas about what this hour is for.",
    startBeat: "open",
    beats: {
      open: {
        id: "open",
        speaker: "The Chief of Staff",
        prompt:
          "She opens with the agenda: budget pressure, a leak nobody has found the source of yet, and the appropriations vote next month. How do you run the room?",
        options: [
          {
            id: "listen",
            label: "Let them argue it out first",
            detail: "You learn more from who says what than from what you'd say yourself.",
            effects: { "politics.capital": 4, "politics.party": 1, "personal.stress": 1 },
            resultText: "",
            next: "treasury",
          },
          {
            id: "direct",
            label: "Set the agenda yourself",
            detail: "Faster, and it says who is actually in charge of this hour.",
            effects: { "politics.capital": 6, "politics.party": 3, "personal.stress": 3 },
            resultText: "",
            next: "agenda",
          },
          {
            id: "confront",
            label: "Raise the leak directly, in the room",
            detail: "Naming it costs you something if it lands badly.",
            effects: { "politics.capital": 2, "personal.stress": 4, "politics.scandal": -3 },
            risk: 0.18,
            onFail: { "politics.capital": -2, "politics.party": -6, "personal.stress": 6 },
            failText: "Someone takes it personally. The rest of the meeting is people being careful with each other.",
            resultText: "",
            next: "confront2",
          },
        ],
      },
      treasury: {
        id: "treasury",
        speaker: "The Treasury Secretary",
        prompt:
          "Letting the room argue put her case front and centre: freeze three agencies rather than touch the tax rate. Everyone is watching to see if you'll back her.",
        options: [
          {
            id: "back-treasury",
            label: "Back her, publicly",
            detail: "It is her call to defend from here.",
            effects: { "politics.capital": 3, "politics.party": 2, "nation.debtToGdp": -0.6 },
            resultText:
              "She has the room's attention now, and the freeze is hers to explain when it gets ugly.",
          },
          {
            id: "split-treasury",
            label: "Split the difference",
            detail: "Freeze two, not three. Nobody fully wins.",
            effects: { "politics.capital": 1, "politics.party": 1 },
            resultText: "A compromise everyone can live with and nobody will remember fondly.",
          },
          {
            id: "overrule-treasury",
            label: "Overrule her, in front of everyone",
            detail: "It will be faster. It will also be noted.",
            effects: { "politics.capital": -2, "politics.party": -3, "nation.debtToGdp": 0.4 },
            resultText: "She says nothing else for the rest of the meeting. Neither does anyone else.",
          },
        ],
      },
      agenda: {
        id: "agenda",
        speaker: "The room",
        prompt:
          "Setting the agenda yourself gets through the list twice as fast — but the Attorney General wanted five minutes on the leak investigation and didn't get one.",
        options: [
          {
            id: "circle-back",
            label: "Give her the five minutes anyway",
            detail: "Run over. It matters to her department.",
            effects: { "politics.capital": 2, "politics.party": 1, "politics.scandal": -2 },
            resultText: "She gets her five minutes. The meeting runs long; nobody complains out loud.",
          },
          {
            id: "move-on",
            label: "Move on — there's no more time",
            detail: "The list gets finished. The leak keeps leaking.",
            effects: { "politics.capital": 3, "politics.scandal": 2 },
            consequence: { heats: { scandal: 6 } },
            resultText: "The agenda is clear by ten. The investigation is nobody's job in particular.",
          },
        ],
      },
      confront2: {
        id: "confront2",
        speaker: "The room",
        prompt: "Naming it broke the tension, at least. Somebody now has to actually own the investigation.",
        options: [
          {
            id: "assign-doj",
            label: "Hand it to Justice, formally",
            detail: "It stops being a rumour and starts being a process.",
            effects: { "politics.scandal": -4, "politics.capital": 2, "politics.party": -1 },
            resultText: "Justice opens a file. That alone changes what people are willing to say out loud.",
          },
          {
            id: "handle-personally",
            label: "Say you'll handle it yourself",
            detail: "It signals you take it seriously. It also means it's now your problem alone.",
            effects: { "personal.stress": 5, "personal.integrity": 3, "politics.scandal": -2 },
            resultText: "Nobody argues with a president who says that in the room. Whether you follow through is a different question.",
          },
        ],
      },
    },
  },

  // ---------------------------------------------------------- Press Pool
  {
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
        speaker: "The correspondent",
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
        speaker: "The correspondent",
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
  },

  // --------------------------------------------------------- Secure Line
  {
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
        speaker: "The Prime Minister",
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
        speaker: "The Prime Minister",
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
  },

  // ------------------------------------------------------------ Residence
  {
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
        speaker: "Around the table",
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
        speaker: "Later, over dessert",
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
  },
];

export function conversationById(id: string): Conversation | undefined {
  return CONVERSATIONS.find((c) => c.id === id);
}
