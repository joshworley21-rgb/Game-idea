import { Rng } from "../core/rng.ts";
import { FACTIONS } from "./congress.ts";
import type { CrisisTag, FactionKey, GameState, Secretary } from "./types.ts";

/**
 * The cabinet: six people with names, who are good at their jobs to varying
 * degrees and loyal to you for as long as it suits them.
 *
 * Competence makes their department work and takes the edge off crises in
 * their domain. Loyalty decides whether they are still there next year, and
 * whether what you said in private stays private.
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

/**
 * A fixed cast rather than the full 480-name combinatorial space (24
 * first names × 20 last names). Two numbers decide how repeats feel:
 * within one game, six offices plus a handful of resignations draw maybe
 * 10-15 names, so any pool comfortably above that never collides — but the
 * pool also needs to be big enough that two playthroughs don't draw nearly
 * the same roster. For two games each drawing k names from a pool of size
 * N, the expected number of names they share is roughly k²/N. At k≈15,
 * N=100 puts that at just over 2 — a familiar face turning up again now
 * and then, not a rerun of your last administration. Smaller pools would
 * make that recurrence heavy fast: N=40 would put it past 5.
 *
 * Fixed seed, not `rng`: the pool itself has to be the same roster every
 * time the game runs, only the draw from it should vary.
 */
const CAST_POOL_SIZE = 100;
export const NAME_POOL: string[] = (() => {
  const pairs: string[] = [];
  for (const first of FIRST) for (const last of LAST) pairs.push(`${first} ${last}`);
  const shuffle = new Rng(0xc0ffee);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = shuffle.int(0, i);
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.slice(0, CAST_POOL_SIZE);
})();

function makeSecretary(
  rng: Rng,
  office: (typeof OFFICES)[number],
  taken: Set<string> = new Set(),
): Secretary {
  const faction = rng.pick(FACTIONS).key;
  // Two secretaries with the same name would read as a bug, so keep drawing.
  let name = rng.pick(NAME_POOL);
  for (let tries = 0; taken.has(name) && tries < 60; tries++) {
    name = rng.pick(NAME_POOL);
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

export function createCabinet(rng: Rng): Secretary[] {
  const taken = new Set<string>();
  return OFFICES.map((office) => makeSecretary(rng, office, taken));
}

/** Replaces one office with a fresh appointment. */
export function replaceSecretary(rng: Rng, cabinet: Secretary[], officeKey: string): Secretary {
  const office = OFFICES.find((o) => o.key === officeKey) ?? OFFICES[0];
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
export const TAG_DOMAIN: Partial<Record<CrisisTag, string>> = {
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
 */
export function tickCabinet(s: GameState, rng: Rng): CabinetEvent[] {
  const events: CabinetEvent[] = [];
  if (!s.cabinet?.length) return events;

  for (const person of s.cabinet) {
    person.months += 1;
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
