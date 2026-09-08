import { Rng } from "../core/rng.ts";
import { FACTIONS } from "./congress.ts";
import { CABINET_ELIGIBLE_CATEGORIES, ROSTER } from "./roster.ts";
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

/**
 * The pool every secretary's name is drawn from — the roster's own Cabinet
 * and Executive Staff people, not the whole roster. A foreign head of state
 * or a citizen off the street has no business turning up as Treasury
 * Secretary on a reshuffle; only people plausibly appointable to a cabinet
 * office are eligible.
 *
 * Two numbers decide how repeats feel: within one game, six offices plus a
 * handful of resignations draw maybe 10-15 names, so a pool this size only
 * just clears that — but two playthroughs also shouldn't draw nearly the
 * same roster. For two games each drawing k names from a pool of size N,
 * the expected number of names they share is roughly k²/N. At k≈15 against
 * this pool, a familiar face turning up again now and then is expected;
 * that's the trade a closed, plausible pool makes against a wider, emptier
 * one.
 */
export const NAME_POOL: string[] = ROSTER.filter((p) =>
  CABINET_ELIGIBLE_CATEGORIES.includes(p.category),
).map((p) => p.name);

/**
 * The roster already names a real Chief of Staff and five real Cabinet
 * secretaries — the same six offices this game has. A new administration
 * starts with exactly them, not a random draw; only a later reshuffle or
 * resignation reaches into the rest of the pool.
 */
const OFFICE_ROSTER_MATCH: Partial<Record<(typeof OFFICES)[number]["key"], string>> = {
  chief: "Arthur Vance",
  treasury: "Clara Lin",
  state: "Nadia Al-Mansoor",
  defense: "Gen. Marcus Hall",
  justice: "Tariq Morales",
  health: "Regina Phelps",
};

function makeSecretary(
  rng: Rng,
  office: (typeof OFFICES)[number],
  taken: Set<string> = new Set(),
  forcedName?: string,
): Secretary {
  const faction = rng.pick(FACTIONS).key;
  // Two secretaries with the same name would read as a bug, so keep drawing.
  let name = forcedName ?? rng.pick(NAME_POOL);
  if (!forcedName) {
    for (let tries = 0; taken.has(name) && tries < 60; tries++) {
      name = rng.pick(NAME_POOL);
    }
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
  return OFFICES.map((office) => makeSecretary(rng, office, taken, OFFICE_ROSTER_MATCH[office.key]));
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
