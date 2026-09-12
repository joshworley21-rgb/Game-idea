import { Rng } from "../core/rng.ts";
import { FACTIONS } from "./congress.ts";
import { CHIEF_NAME } from "./chief.ts";
import type { CrisisTag, FactionKey, GameState, Secretary } from "./types.ts";

/**
 * The cabinet: six people with names, who are good at their jobs to varying
 * degrees and loyal to you for as long as it suits them.
 *
 * Competence makes their department work and takes the edge off crises in
 * their domain. Loyalty decides whether they are still there next year, and
 * whether what you said in private stays private.
 *
 * The Chief of Staff is the exception: she is always Ruth Ellery, because she
 * is the voice that teaches the job and a teacher who changes every run
 * teaches nothing. See `chief.ts`. The other five are drawn from the seed.
 */

export const OFFICES = [
  { key: "chief", title: "Chief of Staff", domain: "politics" },
  { key: "treasury", title: "Treasury Secretary", domain: "economy" },
  { key: "state", title: "Secretary of State", domain: "foreign" },
  { key: "defense", title: "Defense Secretary", domain: "security" },
  { key: "justice", title: "Attorney General", domain: "justice" },
  { key: "health", title: "Health Secretary", domain: "health" },
] as const;

const FIRST = [
  "Margaret", "Daniel", "Ruth", "Marcus", "Eleanor", "Priya", "Thomas", "Grace",
  "Andre", "Helen", "Victor", "Naomi", "Charles", "Rosa", "Edward", "Fiona",
  "Malcolm", "Diane", "Samuel", "Yusuf", "Claire", "Nathan", "Imani", "Walter",
];
const LAST = [
  "Halloran", "Nakamura", "Beaumont", "Osei", "Lindqvist", "Marchetti", "Whitfield",
  "Okonkwo", "Petrov", "Calderon", "Ashworth", "Dubois", "Ferreira", "Kowalski",
  "Sandoval", "Brennan", "Vasquez", "Ellery", "Rasmussen", "Tanaka",
];

function makeSecretary(
  rng: Rng,
  office: (typeof OFFICES)[number],
  taken: Set<string> = new Set(),
): Secretary {
  const faction = rng.pick(FACTIONS).key;
  // Two secretaries with the same name would read as a bug, so keep drawing.
  let name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  for (let tries = 0; taken.has(name) && tries < 40; tries++) {
    name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  }
  taken.add(name);
  return {
    office: office.key,
    title: office.title,
    name,
    competence: Math.round(rng.range(38, 88)),
    loyalty: Math.round(rng.range(52, 92)),
    faction,
    months: 0,
  };
}

/**
 * Ruth. Fixed name, fixed competence, fixed loyalty — she is the one person
 * in the building whose numbers do not move with the seed, because the
 * player has to be able to trust her before they can trust anything else.
 *
 * Her loyalty starts high and her competence is the highest in the room. She
 * is not a stat to be managed; she is the person who tells you what the stats
 * mean.
 */
function makeChief(): Secretary {
  return {
    office: "chief",
    title: "Chief of Staff",
    name: CHIEF_NAME,
    competence: 91,
    loyalty: 88,
    faction: "moderates",
    months: 0,
  };
}

export function createCabinet(rng: Rng): Secretary[] {
  const taken = new Set<string>([CHIEF_NAME]);
  return OFFICES.map((office) =>
    office.key === "chief" ? makeChief() : makeSecretary(rng, office, taken),
  );
}

/** Replaces one office with a fresh appointment. */
export function replaceSecretary(rng: Rng, cabinet: Secretary[], officeKey: string): Secretary {
  const office = OFFICES.find((o) => o.key === officeKey) ?? OFFICES[0];
  // The Chief of Staff is not replaceable by the reshuffle mechanic: she is
  // the narrator of the job, and a run without her has no voice.
  if (officeKey === "chief") {
    const existing = cabinet.find((c) => c.office === "chief");
    if (existing) return existing;
  }
  const fresh = makeSecretary(rng, office, new Set(cabinet.map((c) => c.name)));
  const index = cabinet.findIndex((c) => c.office === officeKey);
  if (index >= 0) cabinet[index] = fresh;
  return fresh;
}

/** Average competence, 0-100. Drives how well the machine actually runs. */
export function cabinetStrength(s: GameState): number {
  if (!s.cabinet?.length) return 55;
  return s.cabinet.reduce((sum, c) => sum + c.competence, 0) / s.cabinet.length;
}

/** How exposed you are to resignations and leaks. */
export function cabinetLoyalty(s: GameState): number {
  if (!s.cabinet?.length) return 65;
  return s.cabinet.reduce((sum, c) => sum + c.loyalty, 0) / s.cabinet.length;
}

/** Competence in one domain, for crises that fall in a department's lane. */
export function domainCompetence(s: GameState, domain: string): number {
  const office = OFFICES.find((o) => o.domain === domain);
  const person = s.cabinet?.find((c) => c.office === office?.key);
  return person?.competence ?? 55;
}

/** Which department owns a crisis, by the domains it touches. */
const TAG_DOMAIN: Partial<Record<CrisisTag, string>> = {
  economy: "economy",
  labour: "economy",
  foreign: "foreign",
  war: "security",
  security: "security",
  justice: "justice",
  scandal: "justice",
  health: "health",
  politics: "politics",
};

/**
 * The competence brought to bear on a crisis: the best-placed secretary, with
 * the Chief of Staff counting for a little on anything that reaches the desk.
 */
export function crisisCompetence(s: GameState, tags: CrisisTag[] = []): number {
  const owners = tags
    .map((tag) => TAG_DOMAIN[tag])
    .filter((d): d is string => Boolean(d))
    .map((d) => domainCompetence(s, d));
  const best = owners.length ? Math.max(...owners) : 55;
  const chief = domainCompetence(s, "politics");
  return best * 0.78 + chief * 0.22;
}

/** The faction moods your appointments buy you, by who you put in the room. */
export function cabinetFactionSupport(s: GameState): Partial<Record<FactionKey, number>> {
  const support: Partial<Record<FactionKey, number>> = {};
  for (const person of s.cabinet ?? []) {
    support[person.faction] = (support[person.faction] ?? 0) + person.competence / 40;
  }
  return support;
}

export interface CabinetEvent {
  kind: "resigned" | "leaked";
  person: Secretary;
}

/**
 * Runs the cabinet for a month. Loyalty erodes when you are unpopular, mired
 * in scandal, or simply have been there a while; a secretary who has stopped
 * believing in you either walks or talks.
 *
 * The Chief of Staff is exempt from the erosion. She has been in this building
 * through four presidents and she does not leave because a poll moved. She
 * can still be disappointed in you, and she will say so, but she stays.
 */
export function tickCabinet(s: GameState, rng: Rng): CabinetEvent[] {
  const events: CabinetEvent[] = [];
  if (!s.cabinet?.length) return events;

  for (const person of s.cabinet) {
    person.months += 1;
    if (person.office === "chief") continue;

    // Loyalty only ever erodes; a strong party position slows it, never
    // reverses it. Nobody gets more loyal the longer they serve.
    const strain =
      Math.max(0, 48 - s.politics.approval) * 0.075 +
      s.politics.scandal * 0.04 +
      Math.max(0, s.nation.unrest - 55) * 0.025;
    const shelter = Math.min(0.45, Math.max(0, s.politics.party - 52) * 0.035);
    const fatigue = person.months * 0.007; // four years in this building is a long time
    person.loyalty = Math.max(
      0,
      Math.min(100, person.loyalty - 0.5 - fatigue - strain + shelter),
    );

    if (person.loyalty < 28 && rng.chance((28 - person.loyalty) / 190)) {
      events.push({ kind: rng.chance(0.62) ? "resigned" : "leaked", person });
    }
  }
  return events;
}
