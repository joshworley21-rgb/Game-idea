# Conversation portraits

The conversation panel shows a small portrait (52×57, cropped with
`object-fit: cover`) next to whoever is speaking. It looks for a real
image here first — `<role>.png`, then `.jpg`, then `.webp` — and only
falls back to a generated placeholder shape if none of those exist. See
`src/ui/portrait.ts` for the lookup.

Portraits are keyed by **role**, not by the specific person currently
holding it — cabinet secretaries get a new random name every playthrough,
so there's no such thing as "the portrait for this one Treasury
Secretary." Eight roles cover every speaker the conversation system
currently names:

| filename stem  | who                                   |
|-----------------|----------------------------------------|
| `chief`          | The Chief of Staff                     |
| `treasury`       | The Treasury Secretary                 |
| `state`          | The Secretary of State                 |
| `defense`        | The Defense Secretary                  |
| `justice`        | The Attorney General                   |
| `health`         | The Health Secretary                   |
| `correspondent`  | The hostile press interview            |
| `prime-minister` | The allied head of government on calls |

## Brief

Head-and-shoulders, roughly 4:5 portrait (works well cropped at 1024×1280
or similar). Digital-painting portrait style — the same kind of thing a
premium mobile game uses for a dialogue portrait, not a photo. Three-quarter
turn, direct gaze, plain softly-lit background so the crop reads clearly at
avatar size. Consistent lighting and rendering style across all eight, so
the cast reads as one cast.

Common suffix for every prompt: *"digital painting, professional portrait
illustration, head and shoulders, three-quarter view, direct gaze, soft
studio lighting, plain dark blue-grey background, painterly realistic
style, formal attire, composed expression — no text, no watermark, no
signature, no border."*

## One line per role

- **chief** — Chief of Staff, 40s-50s, sharp and composed, tailored dark suit, the person who actually runs the room.
- **treasury** — Treasury Secretary, salt-and-pepper hair, reading glasses optional, dark suit, analytical bearing.
- **state** — Secretary of State, 50s, diplomatic and unflappable, dark suit.
- **defense** — Defense Secretary, close-cropped hair, disciplined bearing, dark suit or subdued uniform touches.
- **justice** — Attorney General, serious and exacting, dark formal attire.
- **health** — Health Secretary, warm but authoritative, dark suit or a white coat over one.
- **correspondent** — veteran White House correspondent, sharp blazer, press-ready, faintly skeptical expression.
- **prime-minister** — allied head of government, international-statesman bearing, dark suit, understated.

Drop the files in this folder with the exact filename stems above and they
show up automatically — nothing else needs to change.
