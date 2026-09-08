import { pickLook } from "../world/character.ts";
import type { GameState } from "../game/types.ts";

/**
 * A flat illustrated portrait for the person currently speaking in a
 * conversation, in the spirit of how narrative-heavy mobile games handle
 * this: a static picture of who you're talking to, alongside the dialogue,
 * rather than asking a real-time 3D face to carry a close-up.
 *
 * This draws a simple geometric bust rather than a photorealistic painting —
 * there is no image-generation tool in this environment to produce the kind
 * of AI-illustrated portrait a reference app might use. The shape is honest
 * about that rather than pretending otherwise. It reuses the exact skin,
 * hair and suit colours `pickLook` already derives for this person's 3D
 * model, so the portrait and the walking-around character agree with each
 * other. Swap in real art later by replacing what `speakerPortraitUri`
 * returns for a given seed — everything downstream just wants a `<img src>`.
 */

/** Which cabinet office, if any, a fixed speaker label refers to. */
const OFFICE_BY_SPEAKER: Record<string, string> = {
  "The Chief of Staff": "chief",
  "The Treasury Secretary": "treasury",
  "The Secretary of State": "state",
  "The Defense Secretary": "defense",
  "The Attorney General": "justice",
  "The Health Secretary": "health",
};

/** Recurring but unnamed roles: the same face every time, by label alone. */
const FIXED_SPEAKERS = new Set(["The correspondent", "The Prime Minister"]);

/** Who a beat's speaker label actually is, if it resolves to one person. */
export function speakerSeed(state: GameState, speaker: string): string | null {
  const office = OFFICE_BY_SPEAKER[speaker];
  if (office) {
    const person = state.cabinet?.find((c) => c.office === office);
    if (person) return person.name;
  }
  if (FIXED_SPEAKERS.has(speaker)) return speaker;
  return null;
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
