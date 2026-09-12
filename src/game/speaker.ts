import type { Rng } from "../core/rng.ts";
import type { GameState, Secretary } from "./types.ts";

/**
 * Who is talking.
 *
 * A beat used to carry a bare string — "The Chief of Staff" — which the panel
 * printed above the prompt. That reads as a caption, not a person. A speaker
 * carries the name, the office, the seed their face is built from, and how
 * they are holding themselves, so a meeting can show you who you are actually
 * talking to.
 *
 * `role` is what the speaker is *for*: it decides which of the cabinet, the
 * family or the press they resolve to at the moment the beat is shown, so a
 * conversation written once works whoever is in the job.
 */
export type SpeakerRole =
  | "chief"
  | "treasury"
  | "state"
  | "defense"
  | "justice"
  | "health"
  | "spouse"
  | "child"
  | "press"
  | "ally"
  | "room"
  | "narrator";

export interface Speaker {
  /** Resolves to a real person at render time. */
  role: SpeakerRole;
  /** Shown when the role cannot be resolved, and used as the portrait seed. */
  name: string;
  /** The office or relationship, shown under the name. */
  title?: string;
  /** Overrides the mood the beat would otherwise use. */
  mood?: Mood;
}

/** Mirrors the moods the portrait renderer understands. */
export type Mood =
  | "neutral"
  | "warm"
  | "concerned"
  | "hostile"
  | "tired"
  | "amused"
  | "guarded";

/** A speaker resolved against the actual state: a real person, with a face. */
export interface ResolvedSpeaker {
  name: string;
  title: string;
  /** What the portrait is built from. */
  seed: string;
  age?: number;
  dress: "suit" | "smart" | "casual";
  mood: Mood;
  /** False for the room itself, which has no face. */
  isPerson: boolean;
}

const OFFICE_ROLES: Partial<Record<SpeakerRole, string>> = {
  chief: "chief",
  treasury: "treasury",
  state: "state",
  defense: "defense",
  justice: "justice",
  health: "health",
};

function secretaryFor(s: GameState, role: SpeakerRole): Secretary | undefined {
  const office = OFFICE_ROLES[role];
  if (!office) return undefined;
  return s.cabinet?.find((c) => c.office === office);
}

/**
 * Turns a speaker into the person they actually are right now. A cabinet
 * speaker follows whoever holds the office, so a reshuffle changes who is
 * sitting across the table without rewriting the conversation.
 */
export function resolveSpeaker(speaker: Speaker, s: GameState): ResolvedSpeaker {
  const mood = speaker.mood ?? "neutral";

  const secretary = secretaryFor(s, speaker.role);
  if (secretary) {
    return {
      name: secretary.name,
      title: secretary.title,
      seed: secretary.name,
      dress: "suit",
      mood,
      isPerson: true,
    };
  }

  if (speaker.role === "spouse" || speaker.role === "child") {
    const member =
      speaker.role === "spouse"
        ? s.family?.find((m) => m.kind === "spouse")
        : s.family?.find((m) => m.kind === "child");
    if (member) {
      return {
        name: member.name,
        title: speaker.role === "spouse" ? "your spouse" : "your child",
        seed: member.name,
        age: member.age,
        dress: speaker.role === "spouse" ? "smart" : "casual",
        mood,
        isPerson: true,
      };
    }
  }

  // The press, an ally, the room itself: a named figure with a face, but not
  // somebody the simulation tracks.
  return {
    name: speaker.name,
    title: speaker.title ?? "",
    seed: speaker.name,
    dress: speaker.role === "press" ? "smart" : "suit",
    mood,
    isPerson: speaker.role !== "room" && speaker.role !== "narrator",
  };
}

/** The mood a beat's text implies, when the writer has not set one. */
export function inferMood(text: string): Mood {
  const t = text.toLowerCase();
  if (/\b(hostile|demand|accus|attack|refus|angry|furious)\b/.test(t)) return "hostile";
  if (/\b(worried|concern|afraid|fear|anxious|grim)\b/.test(t)) return "concerned";
  if (/\b(joke|laugh|smil|amused|dryly|wry)\b/.test(t)) return "amused";
  if (/\b(tired|exhaust|late|long night|drained)\b/.test(t)) return "tired";
  if (/\b(warm|glad|grateful|kind|gentle)\b/.test(t)) return "warm";
  if (/\b(careful|guarded|measured|noncommittal|hedge)\b/.test(t)) return "guarded";
  return "neutral";
}

/** A speaker for a cabinet office, for use in conversation definitions. */
export function cabinetSpeaker(role: SpeakerRole, name: string, title: string): Speaker {
  return { role, name, title };
}

/** Picks the family member a residence beat is actually about. */
export function familySpeaker(s: GameState, rng: Rng): Speaker {
  const members = s.family ?? [];
  if (!members.length) return { role: "spouse", name: "Your family" };
  // Whoever is carrying the most, or failing that whoever has waited longest.
  const ranked = [...members].sort(
    (a, b) => (b.strain?.severity ?? 0) - (a.strain?.severity ?? 0) || b.since - a.since,
  );
  const pick = ranked[0] ?? rng.pick(members);
  return {
    role: pick.kind === "spouse" ? "spouse" : "child",
    name: pick.name,
    title: pick.kind === "spouse" ? "your spouse" : "your child",
  };
}
