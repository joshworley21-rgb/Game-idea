import { pickLook } from "../world/character.ts";
import type { Look } from "../world/character.ts";
import type { GameState } from "../game/types.ts";

/**
 * A portrait for the person currently speaking in a conversation, in the
 * spirit of how narrative-heavy mobile games handle this: a static picture
 * beside the dialogue, rather than asking a real-time 3D face to carry a
 * close-up.
 *
 * Three tiers, most specific first. Real painted art always wins if it
 * exists: `public/portraits/cast/<name-slug>.{png,jpg,webp}` for one of the
 * 100 people in the cabinet pool (`src/game/cabinet.ts`) by name, or
 * `public/portraits/<role>.{png,jpg,webp}` for a handful of fixed unnamed
 * roles (the hostile correspondent, the allied prime minister). Below that,
 * every one of the 100 pool names already has a *generated* portrait — see
 * `scripts/render-cast-portraits.mjs`, which calls `buildPortraitSvg` below
 * once per pool name and rasterises it to `public/portraits/cast/`. That
 * generated art is a shape built from this person's actual traits (face
 * width, eyebrows, facial hair, glasses, hair colour and style), not a
 * painting — deliberately not pretending otherwise — but it is genuinely
 * theirs rather than a stand-in shared across the whole cast. Anyone
 * outside the pool (a one-off seed) falls back to `portraitUri` computing
 * the same shape live, for exactly the same reason.
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
  /** Drives the generated portrait, and is who they are for `pickLook`. */
  seed: string;
  /** The role's fallback art file: `public/portraits/<role>.png` (or .jpg/.webp). */
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

/** `"Margaret Lindqvist"` -> `"margaret-lindqvist"`, for filenames and URLs. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Where real or pre-generated art for this speaker would live, most
 * specific first: this exact person by name, then the role they hold, in
 * declining format preference. `portraitImg` in panels.ts tries each of
 * these before falling back to `portraitUri`'s live-generated data URI.
 */
export function portraitCandidates(speaker: Speaker): string[] {
  const exts = ["png", "jpg", "webp"];
  return [
    ...exts.map((ext) => `portraits/cast/${slug(speaker.seed)}.${ext}`),
    ...exts.map((ext) => `portraits/${speaker.role}.${ext}`),
  ];
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Scales a colour's channels toward black (t<1) or white (t>1). */
function shade(n: number, t: number): number {
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) * t));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) * t));
  const b = Math.min(255, Math.max(0, (n & 0xff) * t));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Blends two colours by channel — for a lip or blush tone derived from skin. */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * The shape itself: a flat illustrated bust built from this person's actual
 * traits, not just their name. Shared between the live in-browser fallback
 * (`portraitUri`) and `scripts/render-cast-portraits.mjs`, which calls this
 * once per pool name to pre-render real files — same drawing, same inputs,
 * so a person's generated portrait never disagrees with their 3D model.
 */
export function buildPortraitSvg(look: Look): string {
  const skin = hex(look.skin);
  const skinLight = hex(shade(look.skin, 1.16));
  const skinShadow = hex(shade(look.skin, 0.74));
  const hair = hex(look.hair);
  const hairLight = hex(shade(look.hair, 1.3));
  const hairDark = hex(shade(look.hair, 0.55));
  const suit = hex(look.suit);
  const suitDark = hex(shade(look.suit, 0.68));
  const accent = hex(look.accent);
  const browColour = hex(shade(look.hair, 0.65));
  const deep = hex(shade(look.skin, 0.55));
  const eye = hex(look.eye);
  const lip = hex(mix(look.skin, 0xa8514c, 0.55));
  const lipDark = hex(mix(look.skin, 0x7a352f, 0.6));
  const blush = hex(mix(look.skin, 0xc85a4a, 0.3));

  const long = look.hairStyle === "long" || look.hairStyle === "bob" || look.hairStyle === "tied";
  const bald = look.hairStyle === "bald";
  const thin = look.hairStyle === "receding";

  // The skull's own width, not a fixed circle — the single biggest lever
  // for two people not reading as the same shape wearing different colours.
  const rxNum = 42 + look.jawWidth * 12;
  const rx = rxNum.toFixed(1);
  const ry = 56;
  const cheekOffset = (rxNum * 0.52).toFixed(1);

  const hairPath = bald
    ? ""
    : long
      ? `<path d="M42 88 Q40 30 100 26 Q160 30 158 88 Q158 130 148 150 L148 96 Q148 60 100 56 Q52 60 52 96 L52 150 Q42 130 42 88 Z" fill="url(#hairGrad)" stroke="${hairDark}" stroke-width="1" stroke-opacity="0.4"/>`
      : thin
        ? `<path d="M56 70 Q60 32 100 30 Q140 32 144 70 Q120 52 100 52 Q80 52 56 70 Z" fill="url(#hairGrad)" stroke="${hairDark}" stroke-width="1" stroke-opacity="0.4"/>`
        : `<path d="M45 82 Q42 28 100 24 Q158 28 155 82 Q140 50 100 48 Q60 50 45 82 Z" fill="url(#hairGrad)" stroke="${hairDark}" stroke-width="1" stroke-opacity="0.4"/>`;

  const browW = (2 + look.browWeight * 2.4).toFixed(1);
  const eyebrows = `
    <path d="M72 86 Q82 80 92 85" stroke="${browColour}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>
    <path d="M108 85 Q118 80 128 86" stroke="${browColour}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`;

  const noseLen = 14 + look.noseLength * 10;
  const nose = `<path d="M100 92 L${(96).toFixed(1)} ${(92 + noseLen).toFixed(1)} Q100 ${(97 + noseLen).toFixed(1)} ${(104).toFixed(1)} ${(92 + noseLen).toFixed(1)}" stroke="${deep}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>`;

  const eyes = `
    <ellipse cx="82" cy="98" rx="6.2" ry="4.3" fill="#f4f1ea"/>
    <ellipse cx="118" cy="98" rx="6.2" ry="4.3" fill="#f4f1ea"/>
    <circle cx="82" cy="98" r="3.3" fill="${eye}"/>
    <circle cx="118" cy="98" r="3.3" fill="${eye}"/>
    <circle cx="82" cy="98" r="1.6" fill="#181410"/>
    <circle cx="118" cy="98" r="1.6" fill="#181410"/>
    <circle cx="83.1" cy="96.6" r="0.8" fill="#fff" opacity="0.9"/>
    <circle cx="119.1" cy="96.6" r="0.8" fill="#fff" opacity="0.9"/>`;

  const lips = `
    <path d="M82 121 Q100 128 118 121 Q100 136 82 121 Z" fill="${lip}"/>
    <path d="M85 122 Q100 126.5 115 122" stroke="${lipDark}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.55"/>`;

  const blushMarks = `
    <ellipse cx="${100 - Number(cheekOffset)}" cy="112" rx="14" ry="9" fill="url(#blush)"/>
    <ellipse cx="${100 + Number(cheekOffset)}" cy="112" rx="14" ry="9" fill="url(#blush)"/>`;

  const facial =
    look.facialHair === "beard"
      ? `<path d="M60 110 Q58 148 100 156 Q142 148 140 110 Q140 138 100 144 Q60 138 60 110 Z" fill="${hair}" opacity="0.92"/>`
      : look.facialHair === "moustache"
        ? `<path d="M86 122 Q100 128 114 122 Q100 132 86 122 Z" fill="${hair}"/>`
        : look.facialHair === "stubble"
          ? `<path d="M62 108 Q60 140 100 150 Q140 140 138 108 Q140 132 100 140 Q60 132 62 108 Z" fill="${hair}" opacity="0.3"/>`
          : "";

  const glasses = look.glasses
    ? `<g stroke="#2a2622" stroke-width="3" fill="none" opacity="0.85">
        <rect x="66" y="88" width="30" height="24" rx="6"/>
        <rect x="104" y="88" width="30" height="24" rx="6"/>
        <path d="M96 98 L104 98"/>
        <path d="M66 96 L54 92"/>
        <path d="M134 96 L146 92"/>
      </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
    <defs>
      <radialGradient id="g" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="#2b3040"/>
        <stop offset="100%" stop-color="#171a22"/>
      </radialGradient>
      <radialGradient id="face" cx="40%" cy="32%" r="75%">
        <stop offset="0%" stop-color="${skinLight}"/>
        <stop offset="58%" stop-color="${skin}"/>
        <stop offset="100%" stop-color="${skinShadow}"/>
      </radialGradient>
      <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${hairLight}"/>
        <stop offset="100%" stop-color="${hairDark}"/>
      </linearGradient>
      <linearGradient id="suitGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${suit}"/>
        <stop offset="100%" stop-color="${suitDark}"/>
      </linearGradient>
      <radialGradient id="blush" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${blush}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${blush}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="jaw" cx="50%" cy="0%" r="70%">
        <stop offset="0%" stop-color="${deep}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${deep}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="220" rx="14" fill="url(#g)"/>
    <rect x="1.5" y="1.5" width="197" height="217" rx="13" fill="none" stroke="#dcb96e" stroke-opacity="0.35" stroke-width="2"/>
    <rect x="52" y="150" width="96" height="20" fill="${skinShadow}"/>
    <path d="M28 220 Q28 158 100 152 Q172 158 172 220 Z" fill="url(#suitGrad)"/>
    <path d="M92 168 L100 182 L108 168 L100 200 Z" fill="${accent}"/>
    <ellipse cx="100" cy="100" rx="${rx}" ry="${ry}" fill="url(#face)"/>
    <ellipse cx="100" cy="138" rx="${(rxNum * 0.78).toFixed(1)}" ry="20" fill="url(#jaw)"/>
    ${blushMarks}
    ${nose}
    ${eyes}
    ${eyebrows}
    ${lips}
    ${facial}
    ${hairPath}
    ${glasses}
  </svg>`;
}

/** Cache by seed: the drawing is deterministic, no reason to rebuild it. */
const cache = new Map<string, string>();

/** A data URI for the seed's portrait, stable for as long as the page lives. */
export function portraitUri(seed: string): string {
  const hit = cache.get(seed);
  if (hit) return hit;
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(buildPortraitSvg(pickLook({ seed })))}`;
  cache.set(seed, uri);
  return uri;
}
