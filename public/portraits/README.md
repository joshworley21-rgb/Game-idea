# Conversation portraits

The conversation panel shows a small portrait (52×57, cropped with
`object-fit: cover`) next to whoever is speaking. Two tiers, most specific
first — see `src/ui/portrait.ts` for the actual lookup order.

## Tier 1 — `cast/<name-slug>.{png,jpg,webp}`

One file per person in the 100-name cabinet pool (`NAME_POOL` in
`src/game/cabinet.ts`), keyed by their exact name, lowercased and
hyphenated — `"Margaret Lindqvist"` → `cast/margaret-lindqvist.png`.
Cabinet secretaries are drawn from this same fixed pool every game, so
unlike an infinite random cast, giving each of these 100 people their own
face is a finite, describable job.

**Every name in the pool already has a file here** — `npm run
render:portraits` generated them from that person's actual traits (skin,
hair, face shape, glasses, facial hair — whatever `pickLook` derives for
their 3D model), rasterised from `buildPortraitSvg` in
`src/ui/portrait.ts`. That's a flat illustrated shape, not a painting —
there's no image-generation tool available to produce real art with — but
it's genuinely *that person's* shape, not a shared placeholder.

To replace one with real art (commissioned, or run through whatever AI
image tool you have access to), drop a file at that same path — png beats
jpg beats webp, and any real file beats the generated one outright, since
`portraitImg` in `panels.ts` tries the checked-in file first. Only re-run
`npm run render:portraits` if you want to regenerate the *generated* set
(e.g. after changing `buildPortraitSvg` or the pool itself) — it won't
touch files for names that don't map back into the current pool, but it
will overwrite generated files you haven't replaced, so do it before,
not after, commissioning real art for the ones you keep.

## Tier 2 — `<role>.{png,jpg,webp}`

Falls back to a role rather than a person for anyone outside the pool: two
recurring but never-named characters the conversation system talks to
without a name attached.

| filename stem    | who                                     |
|-------------------|------------------------------------------|
| `correspondent`   | The hostile press interview             |
| `prime-minister`  | The allied head of government on calls  |

(`chief`, `treasury`, `state`, `defense`, `justice`, `health` are also
valid stems here and worked as a fallback in an earlier version of this
system, but every cabinet secretary now resolves through Tier 1 first —
these six only matter if you delete someone's Tier 1 file without
replacing it.)

## Brief, if drawing real art

Head-and-shoulders, roughly 4:5 portrait (crops well at 1024×1280 or
similar). Digital-painting portrait style — the kind of thing a premium
mobile game uses for a dialogue portrait, not a photo. Three-quarter turn,
direct gaze, plain softly-lit background so the crop reads clearly at
avatar size. Keep lighting and rendering style consistent across however
many you draw, so the cast reads as one cast rather than a scrapbook.

Common suffix for every prompt: *"digital painting, professional portrait
illustration, head and shoulders, three-quarter view, direct gaze, soft
studio lighting, plain dark blue-grey background, painterly realistic
style, formal attire, composed expression — no text, no watermark, no
signature, no border."*
