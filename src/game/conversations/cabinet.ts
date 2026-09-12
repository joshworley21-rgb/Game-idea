import type { Conversation } from "../types.ts";

/**
 * The cabinet meeting. Six secretaries, six ideas about what the hour is for.
 *
 * The speakers are roles rather than names: `chief` and `treasury` resolve to
 * whoever holds the office when the beat is shown, so a reshuffle changes who
 * is across the table without rewriting the meeting.
 */
export const CABINET: Conversation = {
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
      speaker: { role: "chief", name: "The Chief of Staff", title: "Chief of Staff", mood: "guarded" },
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
      speaker: { role: "treasury", name: "The Treasury Secretary", title: "Treasury Secretary", mood: "neutral" },
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
      speaker: { role: "justice", name: "The Attorney General", title: "Attorney General", mood: "concerned" },
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
};
