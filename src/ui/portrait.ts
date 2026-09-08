import { pickLook } from "../world/character.ts";
import type { GameState } from "../game/types.ts";

/**
 * A portrait for the person currently speaking in a conversation, in the
 * spirit of how narrative-heavy mobile games handle this: a static picture
 * beside the dialogue, rather than asking a real-time 3D face to carry a
 * close-up.
 *
 * Real illustrated art goes in `public/portraits/<role>.{png,jpg,webp}` —
 * see the README there for the exact brief and one prompt per role. `role`
 * is a job, not a person: cabinet secretaries are re-rolled with a new name
 * every playthrough, so bespoke art per generated individual isn't practical
 * (nobody is commissioning infinite portraits), but there are only ever six
 * cabinet offices plus a couple of recurring unnamed roles — a small, fixed
 * set worth actually drawing. Until art exists for a role, or for anyone
 * outside these fixed roles, `portraitUri` draws a flat geometric bust
 * instead — a shape, not a painting, and deliberately not pretending
 * otherwise — using the exact skin, hair and suit colours `pickLook`
 * already derives for that person's 3D model, so it's never a blank space.
 */

/** Which cabinet office, if any, a fixed speaker label refers to — also the art's filename stem. */
const OFFICE_BY_SPEAKER: Record<string, string> = {
  "The Chief of Staff": "chief",
  "The Treasury Secretary": "treasury",
  "The Secretary of State": "state",
  "The Defense Secretary": "defense",
  "The Attorney General": "justice",
  "The Health Secretary": "health",
};

/** Recurring but unnamed roles: the same face every time, by label alone. */
const ROLE_BY_FIXED_SPEAKER: Record<string, string> = {
  "The correspondent": "correspondent",
  "The Prime Minister": "prime-minister",
};

export interface Speaker {
  /** Drives the placeholder's colours, and is who they are for `pickLook`. */
  seed: string;
  /** The art file to look for: `public/portraits/<role>.png` (or .jpg/.webp). */
  role: string;
}

/** Who a beat's speaker label actually is, if it resolves to one person. */
export function speakerInfo(state: GameState, speaker: string): Speaker | null {
  const office = OFFICE_BY_SPEAKER[speaker];
  if (office) {
    const person = state.cabinet?.find((c) => c.office === office);
    if (person) return { seed: person.name, role: office };
  }
  const role = ROLE_BY_FIXED_SPEAKER[speaker];
  if (role) return { seed: speaker, role };
  return null;
}

/** Where real art for a role would live, in declining format preference. */
export function portraitCandidates(role: string): string[] {
  return [`portraits/${role}.png`, `portraits/${role}.jpg`, `portraits/${role}.webp`];
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Cache by seed: the drawing is deterministic, no reason to rebuild it. */
const cache = new Map<string, string>();

/** A data URI for the seed's portrait, stable for as long as the page lives. */
export function portraitUri(seed: string): string {
  const hit = cache.get(seed);
  if (hit) return hit;

  const look = pickLook({ seed });
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const suit = hex(look.suit);
  const accent = hex(look.accent);

  const long = look.hairStyle === "long" || look.hairStyle === "bob" || look.hairStyle === "tied";
  const bald = look.hairStyle === "bald";
  const thin = look.hairStyle === "receding";

  const hairPath = bald
    ? ""
    : long
      ? `<path d="M42 88 Q40 30 100 26 Q160 30 158 88 Q158 130 148 150 L148 96 Q148 60 100 56 Q52 60 52 96 L52 150 Q42 130 42 88 Z" fill="${hair}"/>`
      : thin
        ? `<path d="M56 70 Q60 32 100 30 Q140 32 144 70 Q120 52 100 52 Q80 52 56 70 Z" fill="${hair}"/>`
        : `<path d="M45 82 Q42 28 100 24 Q158 28 155 82 Q140 50 100 48 Q60 50 45 82 Z" fill="${hair}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
    <defs>
      <radialGradient id="g" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="#2b3040"/>
        <stop offset="100%" stop-color="#171a22"/>
      </radialGradient>
    </defs>
    <rect width="200" height="220" rx="14" fill="url(#g)"/>
    <rect x="1.5" y="1.5" width="197" height="217" rx="13" fill="none" stroke="#dcb96e" stroke-opacity="0.35" stroke-width="2"/>
    <rect x="52" y="150" width="96" height="20" fill="${skin}"/>
    <path d="M28 220 Q28 158 100 152 Q172 158 172 220 Z" fill="${suit}"/>
    <path d="M92 168 L100 182 L108 168 L100 200 Z" fill="${accent}"/>
    <circle cx="100" cy="98" r="52" fill="${skin}"/>
    <circle cx="82" cy="98" r="4.5" fill="#241a12"/>
    <circle cx="118" cy="98" r="4.5" fill="#241a12"/>
    <path d="M84 122 Q100 132 116 122" stroke="#6b3a34" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${hairPath}
  </svg>`;

  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  cache.set(seed, uri);
  return uri;
}
