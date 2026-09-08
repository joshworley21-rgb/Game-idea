import { WORLD_LEADERS, relationFor } from "./diplomacy.ts";
import type { WorldLeader } from "./diplomacy.ts";
import type { Conversation, ConversationOption, Effects, GameState } from "./types.ts";

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

// -------------------------------------------------------- The Secure Line

/** What can actually be offered on a call, and what it takes to get there. */
interface Offer {
  kind: string;
  label: string;
  detail: string;
  threshold: number;
  effects: Effects;
  resultText: string;
}

function offersFor(leader: WorldLeader): Offer[] {
  if (leader.disposition === "adversary") {
    return [
      {
        kind: "backchannel",
        label: "Open a quiet back-channel",
        detail: "Not friendship. Just a line that still gets answered when things get worse.",
        threshold: 28,
        effects: { "nation.security": 3, "nation.unrest": -1 },
        resultText: "It isn't trust. It's a number someone will actually pick up at three in the morning.",
      },
    ];
  }
  const offers: Offer[] = [
    {
      kind: "trade",
      label: "Open trade talks",
      detail: "Market access each side actually wants, on the table.",
      threshold: leader.disposition === "rival" ? 58 : 42,
      effects: {
        "nation.growth": leader.disposition === "rival" ? 0.1 : 0.16,
        "nation.standing": 3,
      },
      resultText: "The terms are narrower than either delegation wanted going in. It's real, and it's signed.",
    },
  ];
  if (leader.disposition === "ally") {
    offers.push({
      kind: "defense",
      label: "Formalize a defense arrangement",
      detail: "Joint exercises, shared intelligence, a commitment on paper.",
      threshold: 55,
      effects: { "nation.security": 4, "nation.standing": 4 },
      resultText: "It reads, on both sides, as the alliance actually meaning what it says.",
    });
  }
  return offers;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** One option per offer: not ready yet, ready to sign, or already in force. */
function offerOptions(leader: WorldLeader, standing: number, agreements: string[]): ConversationOption[] {
  return offersFor(leader).map((offer) => {
    const active = agreements.includes(offer.kind);
    const target = `leader:${leader.id}`;
    if (active) {
      return {
        id: `check-${offer.kind}`,
        label: `Check in on the ${offer.label.toLowerCase()}`,
        detail: "Making sure it's still holding on their end.",
        effects: {},
        target,
        attention: 2,
        resultText: `Still standing. Neither of you is in a hurry to test it.`,
      };
    }
    if (standing >= offer.threshold) {
      return {
        id: `offer-${offer.kind}`,
        label: offer.label,
        detail: offer.detail,
        effects: offer.effects,
        target,
        attention: 5,
        agreement: { leaderId: String(leader.id), kind: offer.kind },
        resultText: offer.resultText,
      };
    }
    return {
      id: `press-${offer.kind}`,
      label: `Lay the groundwork for it`,
      detail: `Not ready to sign. ${offer.label} is the ask, eventually.`,
      effects: {},
      target,
      attention: 6,
      resultText: "Nothing signed today. The next call starts from a slightly better place.",
    };
  });
}

/**
 * One conversation per world leader — a real person, not a fixed label, with
 * their own relationship, their own agenda, and their own path toward the
 * kind of agreement their disposition actually allows. Regenerated fresh
 * from the current relationship each time it's offered, the same way the
 * residence's evenings are generated from the family you actually have.
 */
function buildLeaderConversation(state: GameState, leader: WorldLeader): Conversation {
  const rel = relationFor(state, String(leader.id));
  const standing = rel?.standing ?? 50;
  const agreements = rel?.agreements ?? [];
  const target = `leader:${leader.id}`;
  const adversarial = leader.disposition === "adversary" || leader.disposition === "rival";

  const openOptions: ConversationOption[] = adversarial
    ? [
        {
          id: "firm",
          label: "Hold the line, plainly",
          detail: "No concessions, no theatrics.",
          effects: { "nation.security": 1 },
          target,
          attention: 3,
          resultText: "",
          next: "ask",
        },
        {
          id: "probe",
          label: "Test whether there's room to talk",
          detail: "Careful, and it could go nowhere.",
          effects: {},
          target,
          attention: 5,
          resultText: "",
          next: "ask",
        },
        {
          id: "warn",
          label: "Deliver a pointed warning",
          detail: "Says you're watching. Costs the option of pretending otherwise.",
          effects: { "nation.standing": -1, "nation.security": 2 },
          resultText: "",
          next: "ask",
        },
      ]
    : [
        {
          id: "warm",
          label: "Reaffirm the relationship, plainly",
          detail: "No hedging. It costs nothing today and is remembered later.",
          effects: { "nation.standing": 2 },
          target,
          attention: 6,
          resultText: "",
          next: "ask",
        },
        {
          id: "measured",
          label: "Keep it warm, but noncommittal",
          detail: "Friendly, and short on specifics.",
          effects: { "politics.capital": 2 },
          target,
          attention: 2,
          resultText: "",
          next: "ask",
        },
        {
          id: "transactional",
          label: "Steer the call toward business",
          detail: "Less warmth, more agenda.",
          effects: { "nation.growth": 0.03 },
          target,
          attention: 1,
          resultText: "",
          next: "ask",
        },
      ];

  return {
    id: `talk-${leader.id}`,
    station: "phone",
    label: `Call ${leader.name}`,
    detail: `${leader.role} — ${leader.agenda}`,
    ap: 1,
    cooldown: 2,
    intro: `Forty minutes on the secure line with ${leader.name}, ${leader.role}. ${leader.quirks}`,
    startBeat: "open",
    beats: {
      open: {
        id: "open",
        speaker: leader.name,
        prompt: `${leader.name} raises it plainly: ${lowerFirst(leader.agenda)} How do you want to leave this call?`,
        options: openOptions,
      },
      ask: {
        id: "ask",
        speaker: leader.name,
        prompt: adversarial
          ? "Before the line goes dead, there's the question of whether this call ever happens again."
          : "Before the call ends, they want something concrete to bring home.",
        options: [
          ...offerOptions(leader, standing, agreements),
          {
            id: "wind-down",
            label: "End the call there",
            detail: "Nothing further today.",
            effects: {},
            resultText: "The call ends where it started. Nothing lost, nothing gained.",
          },
        ],
      },
    },
  };
}

export function worldLeaderConversations(state: GameState): Conversation[] {
  return WORLD_LEADERS.map((leader) => buildLeaderConversation(state, leader));
}

/** Every conversation on offer right now: the fixed set, plus one per world leader. */
export function allConversations(state: GameState): Conversation[] {
  return [...CONVERSATIONS, ...worldLeaderConversations(state)];
}
