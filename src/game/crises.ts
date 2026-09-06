import type { Consequence, Crisis, CrisisTag, GameState } from "./types.ts";

/** Pressure scales likelihood. Zero means the event cannot fire right now. */
const lack = (value: number, floor: number, k = 0.08) => Math.max(0, (floor - value) * k);

export const CRISES: Crisis[] = [
  {
    id: "hurricane",
    title: "Category 4 Landfall",
    brief:
      "A major hurricane has come ashore over a metro area of four million. Power is out, the airport is under water, and the governor is on television asking where the federal government is.",
    source: "FEMA / Situation Room",
    category: "disaster",
    tags: ["climate"],
    weight: 1,
    pressure: (s) => 1.2 + lack(s.nation.sectors.environment, 55, 0.05) + lack(s.nation.sectors.infrastructure, 55, 0.05),
    cooldown: 10,
    choices: [
      {
        id: "full-response",
        label: "Full federal deployment",
        detail: "Guard, Army Corps, emergency appropriation. Write the check now, argue later.",
        effects: {
          "politics.approval": 5,
          "nation.unrest": -4,
          "nation.debtToGdp": 0.5,
          "nation.sectors.infrastructure": 2,
          "personal.stress": 8,
        },
        resultText:
          "Convoys are rolling within eighteen hours. The coverage is wall-to-wall and, for once, kind.",
      },
      {
        id: "delegate",
        label: "Let the states lead",
        detail: "Federal support on request only. Cheaper, and it respects the governors.",
        effects: { "politics.capital": 3, "nation.debtToGdp": 0.1 },
        risk: 0.5,
        onFail: { "politics.approval": -8, "nation.unrest": 6, "politics.media": -6, "personal.stress": 10 },
        failText:
          "Two counties go four days without water. The footage runs on a loop with your face beside it.",
        resultText: "The state response holds. You stayed out of the way and it worked.",
      },
      {
        id: "visit",
        label: "Fly there tonight",
        detail: "Boots in the mud, cameras rolling, the whole schedule torn up.",
        effects: {
          "politics.approval": 7,
          "politics.media": 4,
          "personal.stress": 12,
          "personal.health": -2,
          "personal.family": -3,
          "nation.debtToGdp": 0.3,
        },
        resultText:
          "You stand in a flooded gymnasium and listen for two hours. It leads every broadcast.",
      },
    ],
  },
  {
    id: "bank-run",
    title: "A Bank Is Failing",
    brief:
      "The nation's fourth-largest regional lender cannot meet withdrawals. Treasury says contagion is possible by Monday. The markets open in fourteen hours.",
    source: "Treasury Secretary",
    category: "economic",
    tags: ["economy"],
    weight: 1,
    pressure: (s) => (s.nation.growth < 1 ? 2.2 : 0.5) + Math.max(0, s.nation.inflation - 4) * 0.4,
    cooldown: 14,
    choices: [
      {
        id: "backstop",
        label: "Guarantee all deposits",
        detail: "Unlimited backstop announced before the open. It ends the panic and enrages half the country.",
        capitalCost: 12,
        effects: {
          "nation.growth": 0.3,
          "nation.debtToGdp": 1.2,
          "politics.approval": -4,
          "nation.unrest": 3,
          "personal.stress": 10,
        },
        resultText: "The run stops at 9:31am. By noon the phrase 'bailout' is everywhere.",
      },
      {
        id: "orderly",
        label: "Force an orderly sale",
        detail: "Regulators broker a takeover overnight. Shareholders are wiped out; depositors are made whole.",
        capitalCost: 8,
        effects: { "nation.growth": -0.15, "politics.media": 3, "personal.stress": 8 },
        risk: 0.3,
        onFail: {
          "nation.growth": -0.8,
          "nation.unemployment": 0.5,
          "politics.approval": -7,
          "nation.unrest": 5,
        },
        failText: "No buyer materialises. Two more lenders wobble by Thursday.",
        resultText: "A rival bank swallows it whole by Sunday night. Barely a ripple.",
      },
      {
        id: "let-fail",
        label: "Let it fail",
        detail: "Moral hazard is real. So is a recession.",
        effects: {
          "nation.growth": -0.7,
          "nation.unemployment": 0.4,
          "politics.approval": -3,
          "politics.party": 4,
          "personal.integrity": 3,
        },
        consequence: {
          startsThread: {
            id: "downturn",
            label: "The downturn",
            detail: "Credit has tightened and firms are shedding staff faster than the models expected.",
            intensity: 55,
            drift: -1.6,
            perMonth: { "nation.growth": -0.04, "nation.unemployment": 0.035, "nation.unrest": 0.2 },
            feeds: ["bank-run", "strike", "unemployment-spiral"],
            tags: ["economy", "labour"],
          },
          unlocks: ["unemployment-spiral"],
          heats: { economy: 50, labour: 25 },
        },
        resultText:
          "The bank goes down. You are called principled and reckless in the same paragraph, repeatedly.",
      },
    ],
  },
  {
    id: "standoff",
    title: "Naval Standoff",
    brief:
      "A rival power has surrounded a contested island with 'fishing vessels' that are visibly not fishing vessels. An allied government is asking, publicly, what your treaty commitment is worth.",
    source: "National Security Advisor",
    category: "foreign",
    tags: ["foreign", "security"],
    weight: 1,
    pressure: (s) => 0.8 + lack(s.nation.security, 60, 0.06) + lack(s.nation.standing, 55, 0.04),
    cooldown: 12,
    choices: [
      {
        id: "carrier",
        label: "Send a carrier group",
        detail: "Visible, immediate, and impossible to walk back quietly.",
        capitalCost: 10,
        effects: { "nation.security": 6, "nation.standing": 5, "personal.stress": 12 },
        risk: 0.22,
        onFail: {
          "nation.security": -6,
          "nation.standing": -4,
          "nation.growth": -0.3,
          "politics.approval": -5,
          "personal.stress": 12,
        },
        failText: "A collision at sea kills four sailors. The escalation ladder is suddenly very short.",
        resultText: "They withdraw the vessels within nine days without ever admitting they were there.",
      },
      {
        id: "sanctions",
        label: "Coordinated sanctions",
        detail: "Slow, multilateral, and it hurts your own importers too.",
        capitalCost: 6,
        effects: {
          "nation.standing": 4,
          "nation.inflation": 0.3,
          "nation.growth": -0.15,
          "nation.security": 2,
        },
        resultText: "Eleven allies sign on. The island stays contested; the point is made.",
      },
      {
        id: "backchannel",
        label: "Open a back channel",
        detail: "Quiet talks, no cameras, and no way to claim credit if it works.",
        effects: { "nation.standing": 2, "personal.stress": 5, "politics.capital": 4 },
        risk: 0.35,
        onFail: { "nation.standing": -7, "nation.security": -4, "politics.media": -5, "politics.approval": -4 },
        failText: "The channel leaks. You are accused of negotiating with a gun to an ally's head.",
        resultText: "A deal is reached in a hotel in Geneva that no one will ever write about.",
      },
    ],
  },
  {
    id: "cyberattack",
    title: "Grid Intrusion",
    brief:
      "Someone is inside the control systems of three regional utilities. They have not turned anything off yet. That appears to be a choice.",
    source: "Cyber Command",
    category: "domestic",
    tags: ["security"],
    weight: 1,
    pressure: (s) => 0.7 + lack(s.nation.sectors.infrastructure, 55, 0.06) + lack(s.nation.sectors.science, 55, 0.04),
    cooldown: 14,
    choices: [
      {
        id: "go-public",
        label: "Go public and harden",
        detail: "Tell the country, mandate emergency standards, absorb the panic.",
        effects: {
          "nation.sectors.infrastructure": 4,
          "nation.security": 3,
          "nation.unrest": 4,
          "politics.approval": -2,
          "politics.media": 4,
        },
        resultText: "Three weeks of frightening headlines buy you a decade of better defaults.",
      },
      {
        id: "quiet-fix",
        label: "Fix it quietly",
        detail: "No announcement. Utilities patch under an emergency order nobody reads.",
        effects: { "nation.security": 2, "politics.capital": 2 },
        risk: 0.4,
        onFail: {
          "politics.media": -8,
          "personal.integrity": -6,
          "politics.scandal": 8,
          "politics.approval": -6,
        },
        failText: "A utility engineer talks to a reporter. The cover-up is now the story.",
        consequence: { unlocks: ["cover-up-unravels"], heats: { scandal: 22 } },
        failConsequence: { unlocks: ["cover-up-unravels"], heats: { scandal: 45 } },
        resultText: "The intrusion is scrubbed in eleven days and never makes a front page.",
      },
      {
        id: "retaliate",
        label: "Authorize a response",
        detail: "Offensive cyber against the responsible ministry. Deniable, mostly.",
        capitalCost: 8,
        effects: { "nation.security": 5, "nation.standing": -2, "personal.stress": 8 },
        risk: 0.3,
        onFail: { "nation.security": -5, "nation.standing": -6, "nation.growth": -0.2, "personal.stress": 10 },
        failText: "They escalate. A refinery goes offline for six days and everyone knows why.",
        resultText: "Their ministry loses email for a week. The intrusions stop.",
      },
    ],
  },
  {
    id: "opioid",
    title: "Overdose Surge",
    brief:
      "A new synthetic has pushed overdose deaths up forty percent in a single quarter. County morgues in four states are over capacity.",
    source: "Surgeon General",
    category: "domestic",
    tags: ["health"],
    weight: 1,
    pressure: (s) => lack(s.nation.sectors.healthcare, 60, 0.1) + 0.3,
    cooldown: 16,
    choices: [
      {
        id: "public-health",
        label: "Treat it as a health emergency",
        detail: "Naloxone everywhere, treatment beds funded, prosecution deprioritised for users.",
        capitalCost: 6,
        effects: {
          "nation.sectors.healthcare": 6,
          "nation.unrest": -3,
          "politics.approval": 2,
          "nation.debtToGdp": 0.3,
          "politics.party": -2,
        },
        resultText: "Deaths plateau within two quarters. The counties stop calling it a morgue problem.",
      },
      {
        id: "enforcement",
        label: "Enforcement surge",
        detail: "Interdiction, trafficking prosecutions, pressure on the source countries.",
        effects: {
          "nation.sectors.justice": 5,
          "nation.security": 2,
          "nation.standing": -2,
          "nation.sectors.healthcare": -1,
        },
        risk: 0.35,
        onFail: { "politics.approval": -4, "nation.unrest": 4 },
        failText: "Seizures triple. So do deaths. The supply just got more concentrated.",
        resultText: "Two major networks are dismantled and the wholesale price doubles.",
      },
    ],
  },
  {
    id: "strike",
    title: "National Rail Strike",
    brief:
      "Four unions have walked. Freight stops in seventy-two hours, which means grocery shelves in ten days. Both sides expect you to break the other one.",
    source: "Labor Secretary",
    category: "economic",
    tags: ["labour", "economy"],
    weight: 1,
    pressure: (s) => 0.6 + Math.max(0, s.nation.inflation - 3) * 0.4 + lack(s.nation.sectors.welfare, 50, 0.05),
    cooldown: 14,
    choices: [
      {
        id: "side-labor",
        label: "Back the workers",
        detail: "Push the carriers to settle. Your base will love it; the business press will not.",
        capitalCost: 8,
        effects: {
          "politics.party": 6,
          "nation.unrest": -4,
          "nation.inflation": 0.25,
          "nation.growth": -0.1,
          "politics.media": -3,
        },
        resultText: "A deal in nine days with paid sick leave in it. The trains move.",
      },
      {
        id: "impose",
        label: "Impose a settlement",
        detail: "Use federal authority to force them back to work under the last offer.",
        capitalCost: 10,
        effects: {
          "nation.growth": 0.1,
          "nation.unrest": 8,
          "politics.party": -8,
          "politics.approval": -3,
        },
        consequence: {
          startsThread: {
            id: "labour-anger",
            label: "Labour in revolt",
            detail: "The federations have stopped taking your calls and are co-ordinating.",
            intensity: 50,
            drift: -1.1,
            perMonth: { "nation.unrest": 0.32, "politics.party": -0.25 },
            feeds: ["strike", "general-strike"],
            tags: ["labour"],
          },
          unlocks: ["general-strike"],
          heats: { labour: 50 },
        },
        resultText: "Freight resumes Monday. The unions will remember this in November.",
      },
      {
        id: "mediate",
        label: "Mediate personally",
        detail: "Both sides in the Roosevelt Room until there is white smoke.",
        effects: {
          "personal.stress": 12,
          "personal.family": -4,
          "personal.health": -1,
          "politics.approval": 4,
          "nation.unrest": -3,
          "politics.party": 3,
        },
        risk: 0.35,
        onFail: {
          "nation.growth": -0.4,
          "nation.unrest": 7,
          "politics.approval": -6,
          "nation.inflation": 0.4,
        },
        failText: "Talks collapse on day six. Shelves empty on day eleven and it is your table they walked away from.",
        resultText: "Eighty hours in a windowless room and they sign. You look terrible and it was worth it.",
      },
    ],
  },
  {
    id: "outbreak",
    title: "Novel Respiratory Outbreak",
    brief:
      "Two hundred cases in three cities of something no one has a test for. The modelling team will not give you a number they are confident in.",
    source: "CDC Director",
    category: "disaster",
    tags: ["health"],
    weight: 1,
    pressure: (s) => (s.bills.some((b) => b.id === "pandemic" && b.status === "passed") ? 0.3 : 1.1) + lack(s.nation.sectors.healthcare, 55, 0.05),
    cooldown: 20,
    choices: [
      {
        id: "aggressive",
        label: "Move hard and early",
        detail: "Travel restrictions, emergency production, guidance the country will resent.",
        capitalCost: 10,
        effects: {
          "nation.sectors.healthcare": 4,
          "nation.growth": -0.4,
          "nation.unrest": 5,
          "politics.approval": -3,
          "personal.stress": 14,
        },
        resultText:
          "It burns out in eleven weeks. You will never be able to prove what you prevented.",
      },
      {
        id: "measured",
        label: "Follow the data",
        detail: "Targeted measures only, escalating if the curve turns.",
        effects: { "personal.stress": 8, "politics.capital": 4, "nation.growth": 0.1 },
        risk: 0.45,
        onFail: {
          "nation.sectors.healthcare": -8,
          "nation.growth": -1.1,
          "nation.unemployment": 0.9,
          "politics.approval": -10,
          "nation.unrest": 8,
          "personal.stress": 15,
        },
        failText: "The curve turns. You lost three weeks and the country knows exactly how many.",
        resultText: "The cluster stays a cluster. The economy never notices.",
      },
      {
        id: "downplay",
        label: "Keep it calm",
        detail: "No restrictions, reassuring language, protect the recovery.",
        effects: { "nation.growth": 0.15, "politics.media": -4 },
        risk: 0.6,
        onFail: {
          "nation.sectors.healthcare": -10,
          "nation.growth": -1.4,
          "politics.approval": -14,
          "personal.integrity": -8,
          "politics.scandal": 10,
        },
        failText: "It gets away from you completely, and the tape of your reassurance runs forever.",
        consequence: { unlocks: ["inquiry"], heats: { scandal: 20, health: 25 } },
        failConsequence: {
          startsThread: {
            id: "epidemic",
            label: "The epidemic",
            detail: "Hospitals are over capacity and the curve has not turned.",
            intensity: 70,
            drift: -2.2,
            perMonth: { "nation.sectors.healthcare": -0.28, "nation.growth": -0.05, "nation.unrest": 0.3 },
            feeds: ["outbreak", "inquiry"],
            tags: ["health"],
          },
          unlocks: ["inquiry"],
          heats: { health: 60, scandal: 40 },
        },
        resultText: "It fades on its own. You got away with it and you know you got away with it.",
      },
    ],
  },
  {
    id: "court-vacancy",
    title: "A Seat Opens",
    brief:
      "A Supreme Court justice has died. You have a nomination to make and roughly ninety days in which the entire country will talk about nothing else.",
    source: "White House Counsel",
    category: "domestic",
    tags: ["justice", "politics"],
    weight: 0.8,
    pressure: () => 0.5,
    cooldown: 30,
    choices: [
      {
        id: "base-pick",
        label: "Nominate a movement judge",
        detail: "Your side has waited a generation for this seat.",
        capitalCost: 18,
        effects: {
          "politics.party": 12,
          "nation.unrest": 6,
          "politics.approval": -2,
          "politics.media": -4,
          "personal.stress": 10,
        },
        resultText: "Confirmed on a party-line vote after six brutal weeks. Your base is euphoric.",
      },
      {
        id: "consensus",
        label: "Nominate a consensus judge",
        detail: "A respected circuit judge nobody can plausibly call an extremist.",
        capitalCost: 10,
        effects: {
          "politics.media": 6,
          "politics.approval": 3,
          "politics.party": -8,
          "nation.unrest": -2,
        },
        resultText: "Confirmed 78-22. Half your party calls it a wasted seat.",
      },
      {
        id: "leave-vacant",
        label: "Leave the seat empty",
        detail: "Nominate nobody for now. An eight-member court deadlocks, and everyone waits.",
        effects: {
          "politics.party": -7,
          "politics.media": -2,
          "nation.unrest": 3,
          "politics.capital": 4,
        },
        resultText:
          "The seat stays open into next term. Four-four rulings pile up and nobody is happy, which at least is even-handed.",
      },
      {
        id: "deal",
        label: "Trade the seat",
        detail: "Let the other side have the nominee in exchange for the votes you need elsewhere.",
        capitalCost: 4,
        effects: {
          "politics.capital": 18,
          "politics.party": -14,
          "politics.house": 3,
          "politics.senate": 3,
          "personal.integrity": -3,
        },
        resultText: "You get a legislative window nobody expected. Your party will never forgive it.",
      },
    ],
  },
  {
    id: "leak",
    title: "The Leak",
    brief:
      "A reporter has your deputy chief of staff's texts. They are not criminal. They are humiliating, and they contradict something you said from the podium.",
    source: "Press Secretary",
    category: "personal",
    tags: ["scandal"],
    weight: 1,
    pressure: (s) => 0.3 + s.politics.scandal * 0.05 + Math.max(0, 45 - s.politics.media) * 0.03,
    cooldown: 10,
    choices: [
      {
        id: "own-it",
        label: "Get ahead of it",
        detail: "Release everything yourself, take the questions, eat the bad day.",
        effects: {
          "politics.scandal": -8,
          "personal.integrity": 5,
          "politics.approval": -3,
          "politics.media": 5,
          "personal.stress": 8,
        },
        resultText: "One terrible news cycle instead of six. The press corps notices.",
      },
      {
        id: "fire",
        label: "Fire the deputy",
        detail: "Someone has to go, and it is not going to be you.",
        effects: {
          "politics.scandal": -4,
          "politics.approval": -1,
          "politics.party": -3,
          "personal.integrity": -3,
          "personal.stress": 5,
        },
        resultText: "A resignation letter by 6pm. The story lives another two days, then dies.",
      },
      {
        id: "stonewall",
        label: "Deny everything",
        detail: "No comment, no cooperation, no documents.",
        effects: { "politics.media": -6 },
        risk: 0.55,
        onFail: {
          "politics.scandal": 16,
          "personal.integrity": -10,
          "politics.approval": -8,
          "politics.media": -8,
        },
        failText: "The second tranche of texts is worse, and now there is a subpoena with it.",
        consequence: { heats: { scandal: 25 } },
        failConsequence: {
          startsThread: {
            id: "investigation",
            label: "The investigation",
            detail: "A committee has your documents and no particular deadline.",
            intensity: 58,
            drift: -0.9,
            perMonth: { "politics.scandal": 0.5, "politics.media": -0.2, "personal.stress": 0.3 },
            feeds: ["leak", "cabinet-resignation", "impeachment-push"],
            tags: ["scandal", "politics"],
          },
          unlocks: ["impeachment-push"],
          heats: { scandal: 55 },
        },
        resultText: "It never gets past the third day. Nobody can prove a thing.",
      },
    ],
  },
  {
    id: "health-scare",
    title: "Chest Pains",
    brief:
      "You woke at 4am unable to get a full breath. The White House physician wants you at Walter Reed today, and wants it on the record.",
    source: "White House Physician",
    category: "personal",
    tags: ["personal"],
    weight: 1.2,
    pressure: (s) => lack(s.personal.health, 65, 0.11) + Math.max(0, s.personal.stress - 70) * 0.05,
    cooldown: 8,
    choices: [
      {
        id: "go-now",
        label: "Go today, disclose it",
        detail: "Cancel the schedule. Tell the country. Let them worry for an afternoon.",
        effects: {
          "personal.health": 7,
          "personal.stress": -12,
          "politics.approval": -2,
          "politics.media": 4,
          "personal.integrity": 3,
        },
        resultText:
          "A stent, two nights, and a physician's statement. The markets shrug by Thursday.",
      },
      {
        id: "quiet-visit",
        label: "Go quietly at the weekend",
        detail: "No announcement. A routine physical, officially.",
        effects: { "personal.health": 4, "personal.stress": -5 },
        risk: 0.4,
        onFail: {
          "politics.scandal": 10,
          "personal.integrity": -7,
          "politics.media": -7,
          "politics.approval": -5,
        },
        failText: "A photographer gets the motorcade at the hospital gate. Now it is a cover-up.",
        resultText: "In and out on a Sunday. Nobody files a word about it.",
      },
      {
        id: "ignore",
        label: "Push through it",
        detail: "There is a summit on Tuesday. It was probably the coffee.",
        effects: { "personal.health": -10, "personal.stress": 6, "politics.capital": 3 },
        resultText:
          "You make the summit. You also make the stairs to Marine One look considerably harder than last year.",
      },
    ],
  },
  {
    id: "marriage",
    title: "An Ultimatum",
    brief:
      "Your spouse has asked for a conversation with the door closed and no staff. They have been asking for six weeks. Tonight they stopped asking.",
    source: "The Residence",
    category: "personal",
    tags: ["personal"],
    weight: 1.2,
    pressure: (s) => lack(s.personal.marriage, 55, 0.11),
    cooldown: 8,
    choices: [
      {
        id: "clear-week",
        label: "Clear the week",
        detail: "Camp David. No staff, no calls, no briefing book. The country can wait five days.",
        effects: {
          "personal.marriage": 20,
          "personal.family": 8,
          "personal.stress": -15,
          "politics.capital": -8,
          "politics.approval": -2,
        },
        resultText: "Five days of walking and talking. You come back with a marriage and a backlog.",
      },
      {
        id: "counseling",
        label: "Agree to counselling",
        detail: "Weekly, in the residence, permanently on the schedule.",
        effects: { "personal.marriage": 11, "personal.stress": -5, "personal.health": 2 },
        resultText: "Thursdays at seven, blocked out for the rest of the term. It helps.",
      },
      {
        id: "later",
        label: "Ask for more time",
        detail: "After the vote. After the summit. After the midterms.",
        effects: { "personal.marriage": -12, "personal.stress": 8, "politics.capital": 4 },
        resultText: "They say they understand. The way they say it is the problem.",
      },
    ],
  },
  {
    id: "child",
    title: "Your Daughter's Number",
    brief:
      "Your youngest was photographed leaving a club at 3am and the picture is being sold. She is nineteen. She has not picked up your calls since Tuesday.",
    source: "The Residence",
    category: "personal",
    tags: ["personal", "scandal"],
    weight: 1.1,
    pressure: (s) => lack(s.personal.family, 55, 0.1),
    cooldown: 10,
    choices: [
      {
        id: "protect",
        label: "Protect her publicly",
        detail: "A statement from the podium: my child is not a public figure. Then get on a plane.",
        effects: {
          "personal.family": 16,
          "politics.approval": 2,
          "politics.media": -2,
          "personal.stress": 4,
        },
        resultText: "The photo runs anyway. She calls you back that night, which is the part that matters.",
      },
      {
        id: "ignore-it",
        label: "Say nothing",
        detail: "Engaging feeds it. Let it burn out on its own.",
        effects: { "personal.family": -10, "personal.stress": 6, "politics.capital": 4 },
        risk: 0.3,
        onFail: { "politics.scandal": 6, "politics.approval": -3, "personal.family": -6 },
        failText: "It does not burn out. A second photographer follows her to campus.",
        resultText: "Four days and it is gone from the news. She is still not speaking to you.",
      },
      {
        id: "security",
        label: "Assign her a detail",
        detail: "Full protective detail, whether she wants it or not.",
        effects: { "personal.family": -5, "personal.stress": -3, "politics.capital": -2 },
        resultText: "She is safe and furious. You will take safe.",
      },
    ],
  },
  {
    id: "border-surge",
    title: "Border Surge",
    brief:
      "Crossings have tripled in six weeks. Processing centres are at four times capacity and there is footage from inside one of them.",
    source: "Homeland Security",
    category: "domestic",
    tags: ["security", "justice"],
    weight: 1,
    pressure: (s) => 0.6 + lack(s.nation.security, 60, 0.05) + Math.max(0, s.nation.unrest - 40) * 0.03,
    cooldown: 14,
    choices: [
      {
        id: "capacity",
        label: "Fund capacity and judges",
        detail: "Emergency money for processing, housing, and two hundred new immigration judges.",
        capitalCost: 8,
        effects: {
          "nation.sectors.justice": 4,
          "nation.unrest": -3,
          "nation.debtToGdp": 0.3,
          "politics.approval": 1,
          "politics.media": 3,
        },
        resultText: "The backlog starts falling within a quarter. The footage stops.",
      },
      {
        id: "crackdown",
        label: "Emergency restrictions",
        detail: "Suspend processing at the busiest sectors and deploy the Guard.",
        capitalCost: 10,
        effects: {
          "nation.security": 5,
          "nation.unrest": 6,
          "politics.party": -5,
          "politics.approval": 2,
          "nation.standing": -3,
        },
        consequence: {
          unlocks: ["court-defeat"],
          heats: { justice: 35, security: 20 },
        },
        resultText: "Crossings fall by half in a month. The courts will be hearing about it for years.",
      },
      {
        id: "absorb",
        label: "Ride it out",
        detail: "No emergency money, no deployment. Process what you can and let the story run.",
        effects: {
          "nation.unrest": 6,
          "politics.approval": -4,
          "politics.media": -3,
          "nation.security": -2,
          "politics.capital": 3,
        },
        resultText:
          "The centres stay over capacity for two months. The footage keeps coming and you keep having no answer for it.",
      },
      {
        id: "regional",
        label: "Regional agreement",
        detail: "Pay three neighbouring governments to process asylum claims at source.",
        capitalCost: 6,
        effects: { "nation.standing": 3, "nation.debtToGdp": 0.2, "nation.security": 2 },
        risk: 0.35,
        onFail: { "nation.standing": -5, "politics.approval": -4, "nation.unrest": 4 },
        failText: "One partner takes the money and does nothing. It is reported in detail.",
        resultText: "Two of the three deliver. Crossings ease without a single soldier deployed.",
      },
    ],
  },
  {
    id: "inflation-spike",
    title: "Prices Break Out",
    brief:
      "Core inflation printed far above forecast for the third month. The central bank is signalling it will do whatever it takes, which means unemployment.",
    source: "Council of Economic Advisers",
    category: "economic",
    tags: ["economy"],
    weight: 1,
    pressure: (s) => Math.max(0, s.nation.inflation - 3.5) * 1.2,
    cooldown: 10,
    choices: [
      {
        id: "back-fed",
        label: "Publicly back the central bank",
        detail: "Endorse the hikes, absorb the recession, protect the currency.",
        effects: {
          "nation.inflation": -0.8,
          "nation.growth": -0.4,
          "nation.unemployment": 0.4,
          "politics.approval": -4,
          "politics.media": 5,
        },
        resultText: "Inflation expectations come off the boil. So does the labour market.",
      },
      {
        id: "supply",
        label: "Attack it from the supply side",
        detail: "Suspend tariffs, release reserves, unclog ports.",
        capitalCost: 8,
        effects: {
          "nation.inflation": -0.5,
          "nation.growth": 0.1,
          "nation.standing": -2,
          "nation.sectors.infrastructure": 2,
        },
        resultText: "Goods prices ease within two months. Services do not, but it buys time.",
      },
      {
        id: "blame",
        label: "Blame the price gougers",
        detail: "Hearings, jawboning, an antitrust push at the grocery chains.",
        effects: { "politics.approval": 3, "nation.inflation": 0.1, "politics.media": -4, "personal.integrity": -2 },
        resultText: "It polls beautifully and does almost nothing. Both facts are widely reported.",
      },
    ],
  },
  {
    id: "ally-attacked",
    title: "An Ally Is Invaded",
    brief:
      "A treaty ally's border has been crossed by armour at 4am local. They have invoked the mutual defence clause. Your ambassador is asking for an answer within the hour.",
    source: "Situation Room",
    category: "foreign",
    tags: ["foreign", "war"],
    weight: 0.9,
    pressure: (s) => 0.4 + lack(s.nation.standing, 50, 0.05) + lack(s.nation.security, 55, 0.05),
    cooldown: 24,
    choices: [
      {
        id: "commit",
        label: "Commit forces",
        detail: "Honour the treaty in full. This is what the treaty is.",
        capitalCost: 20,
        effects: {
          "nation.standing": 12,
          "nation.security": -4,
          "nation.debtToGdp": 2,
          "nation.growth": -0.4,
          "nation.unrest": 6,
          "personal.stress": 20,
          "personal.health": -3,
        },
        consequence: {
          startsThread: {
            id: "war",
            label: "The war",
            detail: "Your forces are committed abroad, and the casualty lists arrive weekly.",
            intensity: 62,
            drift: -1.2,
            perMonth: { "nation.debtToGdp": 0.09, "personal.stress": 0.35, "politics.approval": -0.09 },
            feeds: ["war-casualties", "anti-war-protests", "coalition-strain"],
            tags: ["war", "foreign"],
          },
          unlocks: ["war-casualties", "anti-war-protests"],
          heats: { war: 55, foreign: 30 },
        },
        resultText:
          "The line holds. You start writing letters to families and you do not stop for the rest of your term.",
      },
      {
        id: "arm",
        label: "Arms and intelligence only",
        detail: "Everything short of troops. Enormous shipments, no boots.",
        capitalCost: 12,
        effects: {
          "nation.standing": 5,
          "nation.debtToGdp": 1.1,
          "nation.security": 2,
          "personal.stress": 14,
        },
        risk: 0.3,
        onFail: { "nation.standing": -8, "nation.security": -5, "politics.approval": -5 },
        failText: "It is not enough. The capital falls in eleven days and the alliance notices.",
        resultText: "The invasion stalls at the second river. The alliance holds together.",
      },
      {
        id: "diplomacy-only",
        label: "Sanctions and the UN",
        detail: "No weapons, no troops. Isolation and a ceasefire push.",
        effects: {
          "nation.standing": -10,
          "nation.security": -3,
          "nation.growth": -0.1,
          "politics.party": -5,
          "politics.approval": -3,
        },
        consequence: {
          startsThread: {
            id: "alliance-drift",
            label: "Allies drifting",
            detail: "Treaty partners are quietly hedging, and every negotiation starts further back.",
            intensity: 48,
            drift: -0.8,
            perMonth: { "nation.standing": -0.35, "nation.security": -0.12 },
            feeds: ["coalition-strain", "standoff"],
            tags: ["foreign"],
          },
          unlocks: ["coalition-strain"],
          heats: { foreign: 40 },
        },
        resultText:
          "You keep the country out of a war. Three allies open talks with the other side within a year.",
      },
    ],
  },
  {
    id: "wildfire",
    title: "Fire Season",
    brief:
      "Two million acres are burning across four states and the smoke has reached the eastern seaboard. It is the third record year in a row.",
    source: "Interior Department",
    category: "disaster",
    tags: ["climate"],
    weight: 1,
    pressure: (s) => 0.5 + lack(s.nation.sectors.environment, 60, 0.09),
    cooldown: 12,
    choices: [
      {
        id: "emergency-climate",
        label: "Declare a climate emergency",
        detail: "Unlock emergency authorities and spend against them. It will be litigated for years.",
        capitalCost: 14,
        effects: {
          "nation.sectors.environment": 8,
          "nation.standing": 4,
          "politics.party": 5,
          "nation.unrest": 4,
          "nation.debtToGdp": 0.6,
          "politics.media": 3,
        },
        consequence: {
          eases: { id: "fire-season", by: 30 },
          unlocks: ["court-defeat"],
          heats: { climate: -15, justice: 25 },
        },
        resultText: "The authorities hold up in the first three courts. The spending starts immediately.",
      },
      {
        id: "suppression",
        label: "Fund suppression and recovery",
        detail: "Aircraft, crews, and rebuilding money. No structural argument.",
        effects: {
          "politics.approval": 3,
          "nation.debtToGdp": 0.4,
          "nation.sectors.environment": 2,
          "personal.stress": 5,
        },
        consequence: {
          startsThread: {
            id: "fire-season",
            label: "Worsening fire seasons",
            detail: "Nothing structural changed, and the fuel load is worse than last year.",
            intensity: 45,
            drift: 0.6,
            perMonth: { "nation.sectors.environment": -0.15 },
            feeds: ["wildfire", "hurricane"],
            tags: ["climate"],
          },
          heats: { climate: 30 },
        },
        resultText: "The fires are out by October. The next season is somebody's problem.",
      },
    ],
  },
  {
    id: "cabinet-resignation",
    title: "A Resignation Letter",
    brief:
      "Your Treasury Secretary is resigning over the budget, and intends to say why on the way out. The letter is already with two newspapers.",
    source: "Chief of Staff",
    category: "domestic",
    tags: ["scandal", "politics"],
    weight: 0.9,
    pressure: (s) => 0.3 + Math.max(0, 40 - s.politics.party) * 0.05 + Math.max(0, s.nation.debtToGdp - 115) * 0.03,
    cooldown: 16,
    choices: [
      {
        id: "gracious",
        label: "Let them go gracefully",
        detail: "A warm statement, a Rose Garden send-off, no rebuttal.",
        effects: { "politics.media": 4, "politics.approval": -2, "personal.stress": 5, "politics.capital": -4 },
        resultText: "The letter runs and the story is over in three days. Grace is cheap and it works.",
      },
      {
        id: "fight",
        label: "Rebut it hard",
        detail: "Your people brief against them within the hour.",
        effects: {
          "politics.party": 4,
          "politics.media": -6,
          "politics.scandal": 5,
          "politics.approval": -3,
        },
        resultText: "It becomes a two-week fight with a former cabinet member. You do not win it.",
      },
      {
        id: "promote-deputy",
        label: "Promote the deputy immediately",
        detail: "Name a successor within the hour and change the subject with competence.",
        capitalCost: 6,
        effects: { "politics.capital": -2, "nation.growth": 0.1, "politics.media": 2, "politics.approval": 1 },
        resultText: "Markets barely move. The continuity is the message.",
      },
    ],
  },
  {
    id: "shooting",
    title: "Mass Shooting",
    brief:
      "Nineteen dead at a shopping centre, eleven of them under sixteen. You are expected to speak within four hours and there is nothing to say that you have not said before.",
    source: "Chief of Staff",
    category: "domestic",
    tags: ["justice", "security"],
    weight: 1,
    pressure: (s) => 0.7 + lack(s.nation.sectors.justice, 55, 0.05) + Math.max(0, s.nation.unrest - 45) * 0.03,
    cooldown: 12,
    choices: [
      {
        id: "push-legislation",
        label: "Spend everything on a bill",
        detail: "Go to the Capitol yourself and burn political capital until something passes.",
        capitalCost: 16,
        effects: {
          "nation.sectors.justice": 5,
          "nation.unrest": -4,
          "politics.party": 6,
          "politics.approval": 2,
          "personal.stress": 12,
        },
        risk: 0.4,
        onFail: {
          "politics.approval": -5,
          "politics.capital": -6,
          "nation.unrest": 5,
          "personal.stress": 12,
        },
        failText: "It dies in the Senate in eleven days and you spent everything on it.",
        resultText: "A narrow bill passes. It is less than you wanted and more than anyone expected.",
      },
      {
        id: "executive",
        label: "Executive action",
        detail: "Everything you can do with a pen alone, announced Friday.",
        effects: {
          "nation.sectors.justice": 2,
          "nation.unrest": 2,
          "politics.party": 3,
          "politics.media": 1,
        },
        resultText: "Three rules that will be enjoined by a district judge inside a month. It is something.",
      },
      {
        id: "mourn",
        label: "Go and grieve with them",
        detail: "No policy. Just the families, all afternoon, off camera.",
        effects: {
          "politics.approval": 3,
          "personal.stress": 14,
          "personal.health": -2,
          "nation.unrest": -1,
          "personal.integrity": 3,
        },
        resultText:
          "You sit with nineteen families. You do not sleep that night, or particularly well for a month.",
      },
    ],
  },
  {
    id: "primary-threat",
    title: "A Challenger",
    brief:
      "A governor from your own party is 'praying about' a primary challenge, which is how they announce these things. Your party's donors are taking meetings.",
    source: "Political Director",
    category: "domestic",
    tags: ["politics"],
    weight: 0.9,
    pressure: (s) => (s.month > 24 ? 0.6 : 0.1) + Math.max(0, 55 - s.politics.party) * 0.06,
    cooldown: 12,
    choices: [
      {
        id: "buy-off",
        label: "Offer them a cabinet seat",
        detail: "A big job with a big title and no independent base.",
        capitalCost: 12,
        effects: { "politics.party": 10, "personal.integrity": -3, "politics.capital": -4 },
        resultText: "They take Commerce. The prayers conclude.",
      },
      {
        id: "crush",
        label: "Crush it early",
        detail: "Lock up the state parties and the donors before they announce.",
        capitalCost: 16,
        effects: { "politics.party": 6, "politics.media": -3, "personal.stress": 8, "politics.approval": -1 },
        risk: 0.25,
        onFail: { "politics.party": -10, "politics.approval": -4, "politics.capital": -8 },
        failText: "They announce anyway, wounded and furious, and now it is a real primary.",
        resultText: "Twenty-six state chairs endorse you in a single week. There is no challenge.",
      },
      {
        id: "ignore-challenger",
        label: "Ignore them",
        detail: "Govern. Let them make their own case.",
        effects: { "politics.capital": 4 },
        risk: 0.4,
        onFail: { "politics.party": -12, "politics.approval": -3 },
        failText: "They announce in Iowa to a full room. Your own party starts hedging.",
        resultText: "The moment passes. They endorse you in the spring through gritted teeth.",
      },
    ],
  },

  // ------------------------------------------------------------------------
  // Consequences. None of these can fire on their own: each exists only
  // because of a decision taken earlier, or a situation still running.
  // ------------------------------------------------------------------------

  {
    id: "war-casualties",
    title: "Nineteen Letters",
    brief:
      "A convoy was hit outside the city your forces are holding. Nineteen dead, and the wire has the photographs before the families have the phone calls.",
    source: "Situation Room",
    category: "foreign",
    tags: ["war", "foreign"],
    weight: 1.3,
    pressure: () => 0,
    gated: true,
    cooldown: 5,
    choices: [
      {
        id: "reinforce",
        label: "Reinforce and press on",
        detail: "More troops, better armour, and the argument that leaving now wastes what it cost.",
        capitalCost: 12,
        effects: { "nation.standing": 3, "nation.debtToGdp": 0.8, "politics.approval": -4, "nation.unrest": 4, "personal.stress": 14 },
        consequence: { escalates: { id: "war", by: 12 }, heats: { war: 25 } },
        resultText: "Two more brigades deploy in eleven days. The line moves forward by four kilometres.",
      },
      {
        id: "grieve-war",
        label: "Meet every casket",
        detail: "Dover, at 4am, with no press pool. Every single one, for as long as it takes.",
        effects: { "politics.approval": 4, "personal.integrity": 5, "personal.stress": 18, "personal.health": -3, "personal.family": -4 },
        consequence: { heats: { war: 10 } },
        resultText: "You are there at four in the morning, nineteen times. It does not get easier and you do not stop.",
      },
      {
        id: "begin-withdrawal",
        label: "Begin drawing down",
        detail: "Announce a timetable. Your generals will call it a signal to the enemy, and they may be right.",
        capitalCost: 10,
        effects: { "politics.approval": 3, "nation.standing": -6, "nation.debtToGdp": -0.5, "personal.stress": -6 },
        consequence: { eases: { id: "war", by: 40 }, heats: { war: -20, foreign: 15 } },
        resultText: "A date is announced. Half the country is relieved and every ally is recalculating.",
      },
    ],
  },
  {
    id: "anti-war-protests",
    title: "The Square Is Full",
    brief:
      "Four hundred thousand people, and the organisers say this is the small one. The chants outside the fence are audible from the residence.",
    source: "Chief of Staff",
    category: "domestic",
    tags: ["war", "justice"],
    weight: 1.1,
    pressure: () => 0,
    gated: true,
    cooldown: 6,
    choices: [
      {
        id: "meet-organisers",
        label: "Invite the organisers in",
        detail: "No cameras, no agenda, two hours. They will not thank you and it may still be worth it.",
        effects: { "nation.unrest": -6, "politics.media": 4, "personal.stress": 8, "politics.party": -3 },
        consequence: { eases: { id: "war", by: 6 } },
        resultText: "They come, they are unmoved, and they tell the press you listened. That is worth something.",
      },
      {
        id: "hold-the-line",
        label: "Say nothing and hold",
        detail: "Governing is not done by crowd size. Let it burn itself out.",
        effects: { "nation.unrest": 6, "politics.approval": -3, "politics.party": 3 },
        consequence: { escalates: { id: "war", by: 5 }, heats: { justice: 15 } },
        resultText: "It does not burn itself out. It comes back larger in three weeks.",
      },
    ],
  },
  {
    id: "coalition-strain",
    title: "The Coalition Wobbles",
    brief:
      "Two partners want an exit ramp and a third has stopped attending the planning calls. If this breaks publicly, it breaks all at once.",
    source: "Secretary of State",
    category: "foreign",
    tags: ["foreign"],
    weight: 1,
    pressure: () => 0,
    gated: true,
    cooldown: 8,
    choices: [
      {
        id: "concessions",
        label: "Pay to keep them in",
        detail: "Trade concessions and security guarantees. Expensive, and it holds.",
        capitalCost: 10,
        effects: { "nation.standing": 6, "nation.growth": -0.15, "nation.debtToGdp": 0.5 },
        consequence: { eases: { id: "alliance-drift", by: 25 }, heats: { foreign: -10 } },
        resultText: "The communiqué is signed at 3am with everyone's flag on it. Nobody reads what it cost.",
      },
      {
        id: "let-them-go",
        label: "Let them leave",
        detail: "A coalition of the reluctant is not a coalition. Carry on with those who stay.",
        effects: { "nation.standing": -7, "politics.capital": 5, "personal.stress": -3 },
        consequence: { escalates: { id: "alliance-drift", by: 15 }, heats: { foreign: 20 } },
        resultText: "Two flags come down. The ones that remain are, at least, actually there.",
      },
    ],
  },
  {
    id: "unemployment-spiral",
    title: "The Layoffs Compound",
    brief:
      "Three national employers announced cuts in the same week. Unemployment claims are running at twice the forecast and the states are asking for help.",
    source: "Labor Secretary",
    category: "economic",
    tags: ["economy", "labour"],
    weight: 1.2,
    pressure: () => 0,
    gated: true,
    cooldown: 6,
    choices: [
      {
        id: "stimulus",
        label: "Emergency stimulus",
        detail: "Direct payments, extended benefits, and infrastructure brought forward. Spend into it.",
        capitalCost: 14,
        effects: { "nation.growth": 0.4, "nation.unemployment": -0.4, "nation.debtToGdp": 2.2, "politics.approval": 4, "nation.inflation": 0.3 },
        consequence: { eases: { id: "downturn", by: 35 }, heats: { economy: -20 } },
        resultText: "The cheques go out in six weeks. Growth turns by the second quarter and the debt does not forget.",
      },
      {
        id: "ride-it-out",
        label: "Let the cycle run",
        detail: "Recessions end. Spending into one leaves you with the debt and the recession.",
        effects: { "nation.unemployment": 0.35, "nation.unrest": 5, "politics.approval": -6, "politics.party": -4 },
        consequence: { escalates: { id: "downturn", by: 12 }, heats: { economy: 20, labour: 20 } },
        resultText: "It does end, eventually, on its own schedule rather than yours.",
      },
      {
        id: "targeted-relief",
        label: "Targeted relief only",
        detail: "Help the worst-hit regions and nobody else. Cheaper, and half the country notices it missed them.",
        capitalCost: 6,
        effects: { "nation.unemployment": -0.15, "nation.debtToGdp": 0.7, "politics.approval": -1, "nation.unrest": 1 },
        consequence: { eases: { id: "downturn", by: 12 } },
        resultText: "Four states get help and the rest read about it. The arithmetic works; the politics does not.",
      },
    ],
  },
  {
    id: "general-strike",
    title: "General Strike",
    brief:
      "Nine federations have called it together for the first time in fifty years. Ports, freight, transit, and the teachers, from Monday.",
    source: "Labor Secretary",
    category: "economic",
    tags: ["labour", "economy"],
    weight: 1.3,
    pressure: () => 0,
    gated: true,
    cooldown: 10,
    choices: [
      {
        id: "concede",
        label: "Concede the settlement",
        detail: "Reverse the imposed terms and take the humiliation in public.",
        capitalCost: 8,
        effects: { "nation.unrest": -8, "politics.party": 5, "politics.approval": -3, "nation.growth": -0.15, "politics.media": -3 },
        consequence: { eases: { id: "labour-anger", by: 45 }, heats: { labour: -25 } },
        resultText: "You climb down in a televised statement. The trains run Tuesday, and everyone saw it.",
      },
      {
        id: "emergency-powers",
        label: "Invoke emergency powers",
        detail: "Compel a return to work. This has been done twice in a century and both times are still argued about.",
        capitalCost: 16,
        effects: { "nation.growth": 0.1, "nation.unrest": 12, "politics.party": -10, "personal.integrity": -5, "politics.approval": -5 },
        consequence: { escalates: { id: "labour-anger", by: 20 }, heats: { labour: 30, justice: 20 } },
        resultText: "The order is signed and obeyed. Something in the relationship does not come back.",
      },
    ],
  },
  {
    id: "cover-up-unravels",
    title: "What You Knew",
    brief:
      "A reporter has the timeline: what you were told, and what was said publicly three days later. They are running it Sunday with or without comment.",
    source: "White House Counsel",
    category: "personal",
    tags: ["scandal"],
    weight: 1.2,
    pressure: () => 0,
    gated: true,
    cooldown: 10,
    choices: [
      {
        id: "full-disclosure",
        label: "Release everything first",
        detail: "Every document, unredacted, before the story runs. Take the whole hit at once.",
        effects: { "politics.scandal": -12, "personal.integrity": 8, "politics.approval": -6, "politics.media": 7, "personal.stress": 12 },
        consequence: { eases: { id: "investigation", by: 30 }, heats: { scandal: -20 } },
        resultText: "It is a brutal fortnight and then it is genuinely over, which is more than most manage.",
      },
      {
        id: "limited-hangout",
        label: "Release part of it",
        detail: "The defensible documents now, the rest under privilege. Buy time.",
        effects: { "politics.scandal": 5, "politics.media": -4, "politics.approval": -2 },
        risk: 0.5,
        onFail: { "politics.scandal": 18, "personal.integrity": -10, "politics.approval": -8, "politics.media": -8 },
        failText: "The withheld pages leak within a month, and the withholding is now the story.",
        consequence: { heats: { scandal: 15 } },
        failConsequence: { escalates: { id: "investigation", by: 25 }, unlocks: ["impeachment-push"], heats: { scandal: 40 } },
        resultText: "The partial release holds. Nobody can prove what is missing, though everyone suspects.",
      },
    ],
  },
  {
    id: "inquiry",
    title: "The Independent Inquiry",
    brief:
      "Congress has voted to establish a commission with subpoena power. It will run for two years and it will call you.",
    source: "White House Counsel",
    category: "domestic",
    tags: ["scandal", "health", "politics"],
    weight: 1,
    pressure: () => 0,
    gated: true,
    cooldown: 14,
    choices: [
      {
        id: "cooperate",
        label: "Cooperate fully",
        detail: "Waive privilege, hand over the calendars, testify in public.",
        effects: { "personal.integrity": 7, "politics.media": 6, "politics.scandal": -6, "personal.stress": 12, "politics.capital": -6 },
        consequence: { eases: { id: "investigation", by: 25 }, heats: { scandal: -18 } },
        resultText: "Six hours under oath, televised. The findings are hard and your conduct during them is not.",
      },
      {
        id: "assert-privilege",
        label: "Assert executive privilege",
        detail: "Protect the office, and be seen protecting yourself.",
        effects: { "politics.scandal": 8, "politics.media": -6, "politics.party": 4, "personal.integrity": -4 },
        consequence: { escalates: { id: "investigation", by: 15 }, heats: { scandal: 25, justice: 15 } },
        resultText: "The litigation will outlast your term. So, now, will the suspicion.",
      },
    ],
  },
  {
    id: "impeachment-push",
    title: "Articles Are Drafted",
    brief:
      "The Judiciary Committee has drafted two articles. The whip count in the House is closer than your people admitted to you last week.",
    source: "Political Director",
    category: "domestic",
    tags: ["scandal", "politics"],
    weight: 1.4,
    pressure: () => 0,
    gated: true,
    cooldown: 18,
    choices: [
      {
        id: "fight-it",
        label: "Fight it in public",
        detail: "Rallies, surrogates, and a war room. Make it a partisan brawl, because you win those.",
        capitalCost: 18,
        effects: { "politics.party": 10, "nation.unrest": 8, "politics.media": -6, "politics.approval": -3, "personal.stress": 16 },
        consequence: { escalates: { id: "investigation", by: 10 }, heats: { scandal: 25, politics: 30 } },
        resultText: "It fails in the Senate on a party-line vote. Nothing about the country is better for it.",
      },
      {
        id: "negotiate",
        label: "Give them something",
        detail: "A resignation, a document release, an admission. Take the wind out of it.",
        capitalCost: 10,
        effects: { "politics.scandal": -14, "politics.party": -8, "personal.integrity": 3, "politics.approval": 2 },
        consequence: { eases: { id: "investigation", by: 40 }, heats: { scandal: -25 } },
        resultText: "The articles are withdrawn before a floor vote. Your own side calls it a surrender.",
      },
    ],
  },
  {
    id: "court-defeat",
    title: "Struck Down",
    brief:
      "The appellate court has vacated your order, in language that goes out of its way to be quotable about executive overreach.",
    source: "Attorney General",
    category: "domestic",
    tags: ["justice", "politics"],
    weight: 1,
    pressure: () => 0,
    gated: true,
    cooldown: 10,
    choices: [
      {
        id: "comply",
        label: "Comply and redraft",
        detail: "Accept the ruling, narrow the order, live to argue another day.",
        effects: { "personal.integrity": 5, "politics.media": 4, "politics.party": -5, "nation.sectors.justice": 2 },
        consequence: { heats: { justice: -15 } },
        resultText: "A narrower version survives review in the spring. Slower, and it holds.",
      },
      {
        id: "appeal-hard",
        label: "Appeal to the Supreme Court",
        detail: "Take it all the way and make the argument about presidential authority itself.",
        capitalCost: 10,
        effects: { "politics.party": 7, "nation.unrest": 3, "personal.stress": 6 },
        risk: 0.45,
        onFail: { "politics.approval": -5, "personal.integrity": -5, "nation.sectors.justice": -4, "politics.media": -5 },
        failText: "They decline to hear it. The lower ruling stands and is now precedent with your name on it.",
        consequence: { heats: { justice: 20 } },
        resultText: "They take the case and they side with you, six to three. The authority is now settled and yours.",
      },
    ],
  },
];

/**
 * How likely a crisis is right now, once the rest of the term is taken into
 * account. Three things push it up: the state of the country, any running
 * situation that feeds this particular crisis, and how hot its domain is —
 * so a bad year for the economy keeps producing economic trouble.
 *
 * Gated crises exist only as consequences. They stay at zero until something
 * unlocks them or a situation starts feeding them.
 */
export function crisisPressure(s: GameState, c: Crisis): number {
  const feed = s.threads.reduce(
    (sum, t) => sum + (t.feeds?.includes(c.id) ? t.intensity / 45 : 0),
    0,
  );
  if (c.gated && feed === 0 && !s.unlocked.includes(c.id)) return 0;

  const heat = c.tags.reduce((sum, tag) => sum + Math.max(0, s.heat[tag] ?? 0) / 70, 0);
  const base = c.pressure(s) + (c.gated ? 0.85 : 0);
  return Math.max(0, base * (1 + heat) + feed);
}

export function eligibleCrises(s: GameState): Crisis[] {
  return CRISES.filter((c) => {
    const last = s.crisisHistory[c.id];
    if (last !== undefined && s.month - last < c.cooldown) return false;
    return crisisPressure(s, c) > 0;
  });
}

/** Applies what a choice set in motion: situations, unlocks, and heat. */
export function applyConsequence(s: GameState, consequence: Consequence | undefined): void {
  if (!consequence) return;

  if (consequence.startsThread) {
    const def = consequence.startsThread;
    const existing = s.threads.find((t) => t.id === def.id);
    // Starting a situation that is already running deepens it instead.
    if (existing) existing.intensity = Math.min(100, existing.intensity + def.intensity * 0.5);
    else s.threads.push({ ...def, age: 0 });
  }

  if (consequence.escalates) {
    const t = s.threads.find((x) => x.id === consequence.escalates!.id);
    if (t) t.intensity = Math.min(100, t.intensity + consequence.escalates.by);
  }

  if (consequence.eases) {
    const t = s.threads.find((x) => x.id === consequence.eases!.id);
    if (t) t.intensity = Math.max(0, t.intensity - consequence.eases.by);
  }

  for (const id of consequence.unlocks ?? []) {
    if (!s.unlocked.includes(id)) s.unlocked.push(id);
  }

  for (const [tag, amount] of Object.entries(consequence.heats ?? {})) {
    const key = tag as CrisisTag;
    s.heat[key] = Math.max(0, Math.min(100, (s.heat[key] ?? 0) + (amount as number)));
  }
}
