# Oval

A single-player 3D president simulator. You have four years, forty-eight months,
and two or three meaningful decisions a month. The nation needs a budget it
cannot afford, a Congress that owes you nothing, and an answer to whatever broke
overnight. Upstairs, your family would like to see you occasionally.

The whole game is the tension between those two facts.

![The Oval Office](docs/office.png)

## Playing

```bash
npm install
npm run dev      # http://localhost:5173
```

You walk the Oval Office in first person. Each object is a system:

| Station | What it does |
| --- | --- |
| **The Resolute Desk** | Legislation, executive orders, clemency, vetoes |
| **The Cabinet Table** | The annual budget: nine agencies and the tax rate |
| **The West Wing** | Cabinet meetings, whipping votes, fundraisers, reshuffles |
| **The Secure Line** | Allies, summits, trade deals, the intelligence brief |
| **The Press Pool** | Addresses, hostile interviews, rallies, campaign swings |
| **The Residence** | Dinner, date night, calling your kids, Camp David |
| **The Private Study** | Sleep, the physician, therapy, an hour that is yours |

**Controls** — `W A S D` and the mouse to move and look, `E` to use what you are
standing at, `1`–`7` to jump straight to a station, `Tab` for the dashboard,
`Enter` to end the month, `Esc` to close a panel. Click an object in the room to
open it, or click empty space to capture the mouse. Everything is reachable from
the keyboard alone, and on a touch screen from a thumb alone.

Progress saves to `localStorage` after every action.

## How the simulation works

Each month ticks a connected model rather than a table of random events.

**The economy.** Potential growth comes out of infrastructure, education and
research quality, minus the tax burden, the debt overhang and civil unrest. A
business cycle and a random shock ride on top, and a central bank leans against
inflation with rate rises that cost you growth. Unemployment follows growth,
prices follow demand and the deficit, and nominal GDP compounds.

**The budget.** Every agency drifts toward the quality its funding supports, and
the cost of standing still rises about 0.3% a month. Freezing a budget is a slow
cut. Revenue is the tax rate against GDP; the gap becomes debt, and the debt
charges interest that rises with inflation and leverage. The opening books run a
deficit of roughly 6% of GDP, so the debt grows unless you do something about it.

**Approval** settles toward a weighted read of the economy, public services,
security, unrest and your own character, then gets compressed toward the middle
because the country is polarised. It moves about 30% of the way there each month,
so nothing you do lands instantly.

**Legislation.** A bill's floor score is your chamber support plus the capital
you commit, adjusted for approval and party standing, minus how divisive the bill
is and what it costs. A simple majority carries it. Bills aligned with your own
party face stiffer opposition resistance; centrist bills are easier; crossing the
aisle picks up votes and costs you at home. Failed bills can come back after six
months.

**Crises** are weighted by pressure derived from state, so they are consequences
rather than dice. Underfund the environment and the fire seasons get worse;
underfund healthcare and the overdose surge arrives; let unrest and scandal build
and the leaks and challengers follow. Some options carry an explicit risk of
backfiring.

**You.** Health decays with the job and faster under stress. Marriage and family
decay every single month and only recover if you spend actions on them, with
diminishing returns near the top — restoring a marriage from 30 is much easier
than holding one at 90. Your action points come from your health and stress, so
neglecting yourself directly shrinks how much governing you can do.

**Endings.** The term can end early through medical resignation, impeachment, or
a collapse of the ability to govern. Otherwise you reach the election, having
decided in year three whether to run at all, and get a legacy score across the
economy, society, the world, politics and your own life.

## The 3D assets

The furniture is real geometry, not boxes: eleven models from
[Poly Haven](https://polyhaven.com), all CC0.

```bash
npm run assets     # download, optimise, and write public/models/*.glb
```

The pipeline downloads each model at 1k into `assets-src/` (a cache, gitignored)
and runs it through `gltf-transform`: textures resized and re-encoded to WebP,
geometry welded and simplified, mesh data quantised, all packed into one `.glb`.
That takes the set from **18.1 MB to 2.4 MB** with no visible difference — the
potted plant alone goes from 6.33 MB to 216 KB. Quantisation is read natively by
three.js, so no decoder ships with the game.

**Adding a prop is two lines.** Put its Poly Haven id in `MODELS` in
`scripts/fetch-assets.mjs`, then add a placement to `PROPS` in
`src/world/props.ts`:

```ts
{ model: "Shelf_01", position: [-3.5, 0, 3.15], rotation: Math.PI / 1.5 }
```

You do not need to know where the model's author put its origin. The loader
centres each prop horizontally and rests it on the floor using its own bounding
box, so `position` means where the thing goes. `ceilingAt` hangs it instead,
`groundAt` puts it on a shelf. Every floor-standing prop also becomes solid: its
footprint is collected at load time and the player is pushed out of it.

Two dev pages help when placing things — `/preview.html` renders every model on a
turntable with its real dimensions, and `/overview.html` renders the room in plan
view. Both are dev-server only and are not part of the production build.

Models load after the title screen, so the room appears immediately and fills in
as they arrive. A model that fails to load is skipped with a warning rather than
taking the room down.

## Android

The game also ships as an Android app: the same web build running in a WebView
through Capacitor, with the assets bundled into the APK so it works offline.

```bash
npm run android:apk    # build + sync + assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

It needs a JDK (17 or newer), Gradle, and an Android SDK with platform 36 and
build-tools 36. Point `ANDROID_HOME` at the SDK before building.

**Touch play.** The phone build is not the desktop build in a frame. Input runs
on pointer events, so a thumb drag looks around exactly as a mouse drag does; a
stick in the bottom-left corner walks; and tapping an object in the room opens
it. The HUD reflows below 900px: the four corner cards collapse into a top bar
and a stat strip, the stations become a scrolling row of chips along the bottom
edge, and panels take the full screen. The camera's vertical field of view is
derived from a fixed horizontal one, because three.js measures FOV vertically
and a portrait phone would otherwise show the room through a slot. Shadow
resolution, pixel ratio and antialiasing all step down on touch hardware, and
the Android back button closes a panel rather than quitting.

**Signing.** `android:apk` produces a debug-signed APK, which installs fine for
sideloading but is not for distribution. For a release build, generate your own
keystore and add a `signingConfig` — no keystore or password belongs in this
repository.

## Project layout

```
src/game/     simulation: state, sim tick, bills, crises, actions, endings
src/world/    three.js: office geometry, props, controls, stations, asset loading
src/ui/       HUD, panels, touch stick, styling
src/tools/    headless balance harness
android/      Capacitor Android project
public/models/ optimised .glb props (built by `npm run assets`)
scripts/      asset pipeline
```

The simulation has no dependency on the renderer or the DOM, which is what makes
the balance harness possible.

## Development

```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
npm run balance    # play the term headlessly under four strategies
npm run assets     # rebuild the 3D props from Poly Haven
```

`npm run balance` plays six seeds under each of four crude strategies and prints
where the numbers land. It is the fastest way to see whether a change to the
model has broken the difficulty curve:

```
idle          legacy 44.8  approval 47.7  debt 102.8  health 56  marriage 35.5  bills 0
workaholic    legacy 51.0  approval 53.3  debt 107.5  health 46  marriage 38.8  bills 9.7
balanced      legacy 62.3  approval 55.5  debt 106.0  health 94  marriage 88.2  bills 11
family-first  legacy 53.0  approval 44.1  debt 103.0  health 96  marriage 92.7  bills 0
```

Governing well beats governing hard, and neither beats doing both — which is the
shape the game is meant to have.
