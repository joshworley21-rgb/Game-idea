import type { Rng } from "../core/rng.ts";
import type { FamilyMember, GameState, Strain } from "./types.ts";

/**
 * The family is not two numbers. It is a spouse and two children who each have
 * a life running whether you are in it or not, a bond with you that erodes on
 * its own schedule, and difficulties of their own that get worse while you are
 * in the Situation Room.
 *
 * `personal.marriage` and `personal.family` are derived from these people the
 * same way approval is derived from the constituencies: the scalar is a
 * readout, not the model.
 */

const SPOUSE_FIRST = [
  "Elena", "Marcus", "Nadia", "David", "Priya", "Jonah", "Claire", "Samuel",
  "Rosa", "Michael", "Ines", "Adam", "Leah", "Nicholas",
];

const CHILD_FIRST = [
  "Maya", "Theo", "Aisha", "Danny", "Nora", "Elliot", "Sofia", "Caleb",
  "Ruth", "Jonah", "Cleo", "Isaac", "Mara", "Owen", "Nell", "Felix",
];

/** What a spouse gave up, or put on hold, to stand behind you on a stage. */
const SPOUSE_LIVES = [
  "a paediatric surgery practice, now down to one clinic a month",
  "a law school deanship, deferred until the term is over",
  "a novel that has been three chapters from finished for two years",
  "an architecture firm they still call into at seven every morning",
  "a career in public health they left the week you announced",
  "a restaurant they opened at thirty and handed to a manager at fifty",
];

/** What a child is doing with their life, by stage. */
const CHILD_LIVES: { min: number; max: number; lines: string[] }[] = [
  {
    min: 7,
    max: 12,
    lines: [
      "third grade, and a school run that now involves two vehicles",
      "obsessed with astronomy and unimpressed by your job",
      "learning the cello badly and with total commitment",
      "the only kid at school whose friends get background checks",
    ],
  },
  {
    min: 13,
    max: 17,
    lines: [
      "eleventh grade, and furious about the security detail",
      "captain of a team you have seen play twice",
      "applying to colleges and refusing all help from you",
      "in a band that rehearses in a room with a Secret Service agent in it",
    ],
  },
  {
    min: 18,
    max: 23,
    lines: [
      "second year at a university that will not stop calling you",
      "on a gap year, somewhere with poor phone reception",
      "studying marine biology and living with three strangers",
      "working a bar job under their mother's surname",
    ],
  },
  {
    min: 24,
    max: 32,
    lines: [
      "a junior architect who has never once asked you for anything",
      "a nurse working nights, which is when you are free",
      "teaching in a district your budget just cut",
      "starting a company you have politely not offered to help with",
    ],
  },
];

/** The difficulties a family carries while you are working. */
interface StrainDef {
  id: string;
  kind: "spouse" | "child";
  label: string;
  detail: string;
  /** Only appears within this age band. */
  ages?: [number, number];
  /** Relative likelihood once a strain is due. */
  weight: number;
}

const STRAINS: StrainDef[] = [
  {
    id: "spouse-erasure",
    kind: "spouse",
    label: "losing themselves in the role",
    detail: "Every introduction this month began with your name and ended with theirs.",
    weight: 1.2,
  },
  {
    id: "spouse-work",
    kind: "spouse",
    label: "the career on hold",
    detail: "They turned down something they wanted, again, and did not tell you until after.",
    weight: 1.1,
  },
  {
    id: "spouse-alone",
    kind: "spouse",
    label: "eating alone",
    detail: "Four dinners in the residence this month. You made one of them.",
    weight: 1.3,
  },
  {
    id: "spouse-press",
    kind: "spouse",
    label: "under the lens",
    detail: "A profile ran that was really about their weight, and everyone pretended otherwise.",
    weight: 0.8,
  },
  {
    id: "child-school",
    kind: "child",
    label: "coming apart at school",
    detail: "Two teachers have called the residence. Neither call reached you.",
    ages: [7, 18],
    weight: 1.2,
  },
  {
    id: "child-bullied",
    kind: "child",
    label: "a target because of you",
    detail: "Your last speech is being quoted back at them in a corridor every day.",
    ages: [7, 18],
    weight: 1.1,
  },
  {
    id: "child-detail",
    kind: "child",
    label: "at war with the detail",
    detail: "They gave their agents the slip on Friday. Nobody has said so officially.",
    ages: [14, 24],
    weight: 1.2,
  },
  {
    id: "child-drinking",
    kind: "child",
    label: "drinking more than they say",
    detail: "The residence staff have stopped restocking one particular shelf.",
    ages: [17, 30],
    weight: 1,
  },
  {
    id: "child-distance",
    kind: "child",
    label: "not picking up",
    detail: "Three calls, three voicemails, and a text saying they are fine.",
    ages: [16, 32],
    weight: 1.4,
  },
  {
    id: "child-money",
    kind: "child",
    label: "trading on the name",
    detail: "Someone is paying them well for work that is mostly their surname.",
    ages: [21, 32],
    weight: 0.9,
  },
  {
    id: "child-health",
    kind: "child",
    label: "not well",
    detail: "There is a specialist appointment on the calendar you have not asked about.",
    ages: [7, 32],
    weight: 0.8,
  },
];

function lifeFor(age: number, rng: Rng): string {
  const band = CHILD_LIVES.find((b) => age >= b.min && age <= b.max) ?? CHILD_LIVES[2];
  return rng.pick(band.lines);
}

/** The family you had before any of this, generated with the run's seed. */
export function createFamily(rng: Rng, presidentAge: number): FamilyMember[] {
  const taken = new Set<string>();
  const draw = (pool: readonly string[]): string => {
    let name = rng.pick(pool);
    for (let i = 0; taken.has(name) && i < 30; i++) name = rng.pick(pool);
    taken.add(name);
    return name;
  };

  const spouse: FamilyMember = {
    id: "spouse",
    kind: "spouse",
    name: draw(SPOUSE_FIRST),
    age: presidentAge + rng.int(-6, 4),
    doing: rng.pick(SPOUSE_LIVES),
    bond: rng.int(68, 80),
    since: 0,
  };

  // Two children at deliberately different stages, so the residence is never
  // asking you for the same thing twice.
  const elder = rng.int(20, 29);
  const younger = rng.int(9, Math.max(11, elder - 5));
  const children: FamilyMember[] = [elder, younger].map((age, i) => ({
    id: `child${i + 1}`,
    kind: "child" as const,
    name: draw(CHILD_FIRST),
    age,
    doing: lifeFor(age, rng),
    bond: rng.int(62, 78),
    since: 0,
  }));

  return [spouse, ...children];
}

export function spouseOf(s: GameState): FamilyMember | undefined {
  return s.family?.find((m) => m.kind === "spouse");
}

export function childrenOf(s: GameState): FamilyMember[] {
  return s.family?.filter((m) => m.kind === "child") ?? [];
}

export function memberById(s: GameState, id: string): FamilyMember | undefined {
  return s.family?.find((m) => m.id === id);
}

/** How much of your family is currently carrying something. */
export function familyStrain(s: GameState): number {
  const strains = (s.family ?? []).map((m) => m.strain?.severity ?? 0);
  return strains.reduce((sum, v) => sum + v, 0);
}

/** The person who most needs an hour of your time. */
export function mostNeglected(s: GameState): FamilyMember | undefined {
  return [...(s.family ?? [])].sort(
    (a, b) => b.since + (b.strain?.severity ?? 0) / 12 - (a.since + (a.strain?.severity ?? 0) / 12),
  )[0];
}

/**
 * Giving someone real time. Resets the clock since you last did, lifts the
 * bond, and takes the edge off whatever they are carrying.
 */
export function attend(member: FamilyMember, weight: number): void {
  member.since = 0;
  member.bond = Math.min(100, member.bond + weight);
  if (member.strain) {
    member.strain.severity -= weight * 2.2;
    if (member.strain.severity <= 0) member.strain = undefined;
  }
}

function newStrain(rng: Rng, member: FamilyMember): Strain | undefined {
  const pool = STRAINS.filter(
    (d) =>
      d.kind === member.kind &&
      (!d.ages || (member.age >= d.ages[0] && member.age <= d.ages[1])),
  );
  const def = rng.weighted(pool, (d) => d.weight);
  if (!def) return undefined;
  return { id: def.id, label: def.label, detail: def.detail, severity: rng.range(18, 30), months: 0 };
}

/**
 * The family's month. Bonds erode with absence and your own state, strains
 * appear in the gaps you leave and fester while you are elsewhere, and the two
 * scalars the rest of the game reads are recomputed from the people.
 */
export function driftFamily(s: GameState, rng: Rng, notes: string[]): void {
  if (!s.family?.length) return;

  for (const member of s.family) {
    member.since += 1;

    // A difficulty is far more likely in someone you have not seen in months.
    if (!member.strain) {
      const exposure =
        0.012 +
        Math.max(0, member.since - 2) * 0.016 +
        Math.max(0, s.personal.stress - 60) * 0.0016 +
        Math.max(0, 60 - member.bond) * 0.0018;
      if (rng.chance(Math.min(0.3, exposure))) {
        member.strain = newStrain(rng, member);
        if (member.strain) {
          notes.push(`${member.name} is ${member.strain.label}.`);
        }
      }
    } else {
      member.strain.months += 1;
      // Untended, it grows; a recent visit already took the edge off above.
      member.strain.severity = Math.min(
        100,
        member.strain.severity + (member.since > 1 ? 3.2 : -1.5),
      );
      if (member.strain.severity <= 0) {
        notes.push(`Things have settled down for ${member.name}.`);
        member.strain = undefined;
      }
    }

    // The bond a month of absence, pressure and their own trouble adds up to.
    // Absence saturates: someone you have not seen in a year is distant, not
    // erased, and the door is still open when you finally walk through it.
    const target =
      80 -
      Math.min(member.since, 9) * 3 -
      (member.strain?.severity ?? 0) * 0.22 -
      Math.max(0, s.personal.stress - 55) * 0.28 -
      (member.kind === "spouse" ? Math.max(0, s.politics.scandal - 20) * 0.2 : 0);
    member.bond = Math.max(0, Math.min(100, member.bond + (target - member.bond) * 0.22));
  }

  // The scalars the rest of the game reads are now a readout of the people.
  const spouse = spouseOf(s);
  if (spouse) s.personal.marriage = spouse.bond;
  const kids = childrenOf(s);
  if (kids.length) {
    s.personal.family = kids.reduce((sum, k) => sum + k.bond, 0) / kids.length;
  }
}

/** A one-line summary of where a person is, for the residence and the report. */
export function stateOf(member: FamilyMember): string {
  if (member.strain && member.strain.severity > 45) return `${member.strain.label} — badly`;
  if (member.strain) return member.strain.label;
  if (member.since >= 5) return "you have not spoken properly in months";
  if (member.since >= 3) return `${member.since} months since you gave them an evening`;
  if (member.bond >= 75) return "close, and glad of it";
  return "fine, as far as you know";
}
