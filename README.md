# Oval

A single-player 3D president simulator. You have four years, forty-eight months,
and two or three meaningful decisions a month. The nation needs a budget it
cannot afford, a Congress that owes you nothing, and an answer to whatever broke
overnight. Upstairs, your family would like to see you occasionally.

The whole game is the tension between those two facts.

![The Oval Office](docs/office.png)

## Playing

Oval ships as a standalone Android app, not a website. Grab the APK from
[`releases/oval-president-debug.apk`](releases/oval-president-debug.apk),
allow installs from unknown sources when Android asks, and open it — no
network connection needed once it's installed. See [Android](#android) below
for the details, including how to build it yourself.

You walk six rooms in first person, and each one does what that room really
does. Doors on the floor take you between them; the station chips along the
bottom take you straight to a station, wherever it lives.

| Room | Station | What happens there |
| --- | --- | --- |
| **The Oval Office** | The Resolute Desk | Executive orders, clemency, vetoes: what you can do alone |
| | The Secure Line | Allies, summits, trade deals, the intelligence brief |
| **The Cabinet Room** | The Cabinet Table | The annual budget: nine agencies and the tax rate |
| | The West Wing | Your cabinet by name, plus meetings, fundraisers, reshuffles |
| **The Capitol** | The House Floor | Bringing a bill to a vote, and whipping it, in front of the chamber |
| **The Briefing Room** | The Press Pool | Addresses, hostile interviews, rallies, campaign swings |
| **The Residence** | Upstairs | Your family by name: their evenings, and what they are carrying |
| **The Private Study** | Yourself | Sleep debt, fitness, the physician, and an hour that is yours |

The rooms are not empty. Your six named secretaries are round the Cabinet
table, your family is upstairs, a press corps fills the briefing room, and the
House chamber holds a hundred members seated in their five faction blocks. They
breathe, blink, shift their weight, and turn to look at you when you walk in.

**Controls** — a thumb stick to walk, drag anywhere else to look around, and a
tap opens whatever you're standing at or walks you through the door under your
feet. The station chips, the dashboard and ending the month are all buttons in
the HUD. Everything is reachable from a thumb alone.

The dock carries two rows: every station on the first, the month's controls on
the second. They shared one row once, which wanted about 1350px and meant that
on a laptop you saw three stations and the other five — the Capitol, the
briefing room, the residence and the study — sat behind a horizontal scroll
with no scrollbar, no fade and no arrow. Four of the six rooms, invisible. On a
phone the rail still scrolls, because eight chips would wrap to four rows, but
it gets the full width of the dock and a fade on whichever end has more behind
it.

Progress saves to the device after every action.

## Before the oath

Every run opens with a short campaign — three real decisions (the primary,
debate night, an October surprise) played out beat by beat, ending on
election night. It exists so the numbers the presidency opens with have a
reason behind them: the same seed, played two different ways in the
campaign, hands you a different coalition and a different bank of capital on
day one, on top of the randomness the seed already gives the country itself.
What you say in the primary can open or close what you're offered at the
debate — the campaign is the same small engine as the meetings below, just
running before there is a `GameState` for it to touch, so its choices land
as one bag of deltas applied on top of the freshly-sworn-in country rather
than modifying a nation that doesn't exist yet.

The choices themselves are kept, not just their arithmetic. Every option you
took is recorded as a flag, so the campaign can come back as a *person* rather
than as a number you cannot trace: the financial filing you sat on in October
is obtained by a committee in the spring, and the base you won the primary by
courting sends a letter in year two saying the patience was a loan. Whether
you released the filing yourself, lawyered up, or leaked something in return
changes which version of that arrives.

**Meetings are not menus.** The four events that are actually a
conversation with someone — the cabinet meeting, a hostile interview, a call
with an ally, family dinner — are played beat by beat instead of resolved in
one click. What you say at the first beat can open or close what you're
offered at the second: push back on a hostile interviewer and her follow-up
question is different from the one she'd have asked if you hadn't, and only
one of the two answers on offer next is actually available to you now.
Effects apply as you go, but the meeting is judged as one outcome at the
end, the same way a crisis resolves as one thing rather than a running
commentary. Everything else — signing an order, holding a rally, working the
Hill — stays a single considered action, because those genuinely are one
motion, not a back-and-forth.

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

**Approval is a coalition, not a number.** Eight constituencies each hold their
own opinion of you — labour, business, seniors, younger voters, rural,
suburban, the activist left and the traditionalist right — weighted by their
share of the electorate. Each one drifts toward a target computed from the
things that bloc actually cares about: labour reads unemployment, wages and
welfare; business reads growth, the tax rate and the debt; seniors read
healthcare and prices; the suburbs read schools, crime and the absence of
scandal. Approval is what the arithmetic adds up to, compressed toward the
middle because the country is polarised, and shaded by your character and the
press.

Every bloc also carries a standing lean for or against your party, so part of
the country is never coming home however well you govern. Your own party's mood
follows its base rather than the country at large, and elections are decided
bloc by bloc with turnout that rises with enthusiasm — a constituency that has
given up on you stays home, which cuts both ways.

This makes policy genuinely two-sided. Nearly every bill and most crisis choices
move specific constituencies in opposite directions: the wealth surtax buys the
left and labour and costs you business badly; energy independence buys rural and
business and loses the young; imposing a rail settlement gets the trains running
and turns labour against you for the rest of the term. The dashboard shows the
whole coalition, sorted, with a live re-election forecast.

**Congress is five factions, not a support percentage.** The hundred seats are
split between the Progressive Caucus, the Liberal Bloc, the Moderates, the
Conservative Bloc and the Hardliners. Each sits somewhere on a left-to-right
axis, holds a mood toward you, and follows its own constituency: the
Progressives take their cue from the activist left, the Conservatives from
business, the Hardliners from traditionalists, and the Moderates — a genuine
swing bloc with no party loyalty at all — from the suburbs and from the
country's verdict on you.

A bill is scored faction by faction. Ideological distance does most of the
work and rises steeply, so a faction one step away can be bought and one on the
far flank is not voting for this at any price. On top of that sit the faction's
mood, whether the bill is on its home turf, what the bill costs (deficit hawks
punish spending nearly four times harder, and harder still above 110% debt), how
divisive it is, and the capital you commit to whipping. Every faction's odds are
shown on the bill card as a whip board, with the expected vote count out of a
hundred; fifty carries it, and the floor adds twelve points of noise either way,
so a close count is a real gamble.

The practical shape of it: your own signature agenda is the hard one. A
progressive bill under a blue president locks up the left and gets nothing from
the Moderates until their mood has risen and you spend most of your capital
whipping. Centrist bills pass. Bills written for the other party are close to
impossible, which is what having a party means. Midterm losses move actual seats
between the flanks, so a bad November changes every count that follows.

**The cabinet has names.** Six secretaries — chief of staff, treasury, state,
defense, justice, health — each with a competence, a loyalty, and a faction they
came from. Competence is what turns money into delivery: a strong cabinet lifts
every agency's output, a good treasury secretary adds to growth, and the
department that owns a crisis takes the edge off its risk of going wrong.
Appointments are patronage, so the factions your people came from warm to you.

**And they have reasons for being there.** A name carrying two numbers is a
spreadsheet with a face on it, so each of the five appointed secretaries also
holds a *temperament*: a true believer, an operator, an institutionalist, a
rival, an old friend, or a technocrat. There are six of them and five seats, so
every run seats five different ones and leaves one out — who is missing is part
of the cast too.

It is not a label. The temperament decides **what erodes them**: an operator
reads your approval rating, an institutionalist does not care about polls at
all and reads the scandal column, a technocrat looks out of the window at the
country. It decides **what they bring to a crisis** in their own department —
thirty years in the building is worth a few points, and working out how it
plays is worth losing a few. It decides **whether they have a floor**: somebody
who is here for the work does not stop turning up because a poll moved, and
somebody who is here for themselves has no floor at all. And it decides **how
they go**: a friend never talks to a reporter, an operator almost always does,
an institutionalist resigns on principle in a letter the whole country reads,
and a rival resigns without warning and books the Sunday shows.

The temperaments are expressed as multipliers on the cabinet's base erosion
coefficients rather than as rates of their own, and each set averages about
one, so a cabinet turns over at the rate it always did. Measured over four
years against the old model: a steady presidency loses 0.75 of its five
(it was 0.48), a struggling one 4.3 (4.9), a failing one 5.0 (5.0). What
changed is not how many go but which — after four steady years the old friend
is sitting on 55 and the rival on 14.

So loyalty still only ever erodes, and the roster in the West Wing says why in
their own register rather than by showing you a falling bar. A steady
presidency keeps its cabinet for four years. A failing one loses most of it,
and which of them goes first is a fact about who you appointed.

**Crises** are weighted by pressure derived from state, so they are consequences
rather than dice. Underfund the environment and the fire seasons get worse;
underfund healthcare and the overdose surge arrives; let unrest and scandal build
and the leaks and challengers follow. Some options carry an explicit risk of
backfiring.

**Crises also cause each other**, through three connected mechanisms.

*Situations* are crises that outlive the meeting they started in. Commit troops
to a treaty ally and you open a war that runs for the rest of the term, bleeding
debt and approval every month, ageing you, and generating its own crises —
casualty convoys, protests in the square, a coalition that wants an exit ramp.
Each has an intensity that drifts up if ignored and down if handled, and its
effects scale with it, so a war winding down hurts less than one at its height.
Impose a rail settlement and labour organises against you. Downplay an outbreak
badly and you get an epidemic *and* the inquiry into how you handled it.

*Consequence crises* exist only as results. Nine of the twenty-eight can never
fire on their own: they are unlocked by a specific decision. Stonewall a leak and
lose the gamble, and the investigation you opened can end in drafted articles of
impeachment. Fix a grid intrusion quietly, and what you knew and when becomes a
story of its own.

*Domain heat* clusters trouble. Every crisis is tagged by domain, and a crisis
raises the temperature of its own domains, as does any running situation. Hot
domains produce more crises and cool off over a few months when nothing feeds
them — so the country has bad years in particular areas rather than uniformly
random trouble.

Running situations show on a board in the HUD and in the dashboard, and a crisis
produced by one says which, so trouble can be traced back to the decision that
caused it.

**Arcs are the slow half of that.** A crisis is something that happens to you.
An arc is something you did, arriving months later as a person who wants an
answer. They are checked once a month, fire at most one at a time, and each
one is one-shot — so an arc is a scene rather than a recurring event.

What makes them stories rather than timed events is what they are keyed to.
Five of the twelve are about a **specific temperament in your cabinet**, so a
term that drew a rival gets the arc where one of your secretaries turns out to
be running for something, and a term that did not will never see it. Two are
keyed to **what you said to win**, replayed out of the campaign's recorded
flags. The rest are keyed to the state you have produced: a Treasury Secretary
who has stopped returning calls, a leak the counsel's office has finally put a
name to, a child who has stopped coming home, a party measuring the drapes,
protests that have acquired organisers and a bank account.

A term sees two or three of them. Which two or three is a fact about who you
appointed and how you got here, which is the point.

**Your family are people, not two numbers.** A spouse and two children,
generated with the run's seed: names, ages, and a life each of them is living
whether you are in it or not — a surgery practice down to one clinic a month, a
nineteen-year-old on a gap year somewhere with bad reception, a teenager
furious about the security detail. Each carries a bond with you, and marriage
and family are readouts of those people the same way approval is a readout of
the constituencies.

The residence generates its evenings from the family you actually have, so it
offers "Take Elena out" and "Show up for Maya", each with its own cooldown:
seeing one of them is not seeing the others. An hour lands on the person you
gave it to.

Bonds erode with absence, and absence is counted per person — the months since
you last gave *them* an evening. In the gaps you leave, they pick up strains of
their own: a child coming apart at school, a spouse losing themselves in the
role, someone trading on the surname, someone not picking up. A strain festers
while you are elsewhere and eases when you are there, and what your family is
carrying you are carrying too — it feeds straight back into your stress. Left
long enough it arrives at the residence as a decision with their name on it.
Absence saturates rather than running to zero: a person you have not seen in a
year is distant, not erased, and the door is still open when you finally walk
through it.

The country notices. A first family that is visibly close is worth something
with the suburbs and traditionalists; one that is never in the same room costs
you with both, and eventually becomes a story.

**Your body is a body.** Health is no longer one bar. Sleep debt accumulates
with crises and stress and recovers a little on its own, so it settles at a
level rather than running to a hundred — and that level is the point. Fitness
falls toward what a schedule like this leaves you with unless you spend a
morning a week on it. Both feed health, and past a threshold sleep debt costs
you an action point outright.

A full physical is the only thing that finds a condition before it finds you:
atrial fibrillation, a coronary narrowing they want watched. Once diagnosed
there is a plan, and the plan costs you schedule. Ignore all of it and the body
collects on its own terms — a week at Walter Reed, the Vice President signing
three things, and a country told it was precautionary.

Measured over full terms: a president who goes upstairs ends with an average
family bond of 80, three residence crises across four years, and almost never
sees the inside of a hospital. One who never does ends at 25, takes fourteen
residence crises, and has about two health episodes — with roughly a one in
three chance of resigning on medical advice before the term is out.

**Endings.** The term can end early through medical resignation, impeachment, or
a collapse of the ability to govern. Otherwise you reach the election, having
decided in year three whether to run at all, and get a legacy score across the
economy, society, the world, politics and your own life.

## Sound

Every sound in the game is synthesised at runtime with the Web Audio API.
Nothing is sampled, so the whole soundscape costs no download, no licence and
no asset pipeline — which matters when the whole thing has to fit in a small
APK.

**Positional ambience.** The fire is a filtered noise bed with crackles
scheduled on top; the grandfather clock is silent between ticks, alternating
tick and tock so it reads as a pendulum. Both are `PositionalAudio` sources
anchored to their furniture, so they fall away as you cross the room. Under all
of it sits a barely-there room tone: lowpassed noise at the edge of hearing.

**The rest is feedback.** Footsteps trigger on distance walked rather than a
timer, so they land with the walking. A warm major arpeggio for a bill signed,
a descending minor one for a bill dead on the floor, two urgent pulses when a
crisis breaks, and a soft bell to close the month.

Ambient timing runs off the audio clock, not accumulated frame deltas — the
render loop clamps its delta to stop the player teleporting after a tab switch,
and a clock driven by that would tick in slow motion on a slow device.

Sound starts on the tap that takes the oath, because Chromium (the engine
behind the Android WebView this ships in) will not open an audio context any
other way, and the mute preference persists.

## The people

There is no CC0 source of good human models with faces, so the cast is
generated in code. Each person is built from a seed taken from their name, so a
given secretary looks the same every time you walk into the Cabinet Room.

The head is a sphere pushed into a skull — brow ridge, cheekbones, eye sockets,
a nose, a jaw that tapers to a chin — and the face is painted onto its UVs.
Both are driven from **one set of anatomical landmarks** expressed as directions
on that sphere, so the painted brows sit on the brow ridge and the eyeballs sit
in the sockets the sculpt actually made; neither can drift away from the other.
The hair is a shell built from the same deform function, cut at a hairline that
is higher across the forehead than at the sides, so long hair never ends up
hanging over the eyes.

The body is a real joint hierarchy — hips → spine → chest → neck → head, and
chest → shoulder → upper arm → forearm → hand — laid out on human proportions
(hip 0.92m, shoulder 1.44, chin 1.52, eyes 1.63, crown 1.75 for a 1.75m
person). Posing and animating are rotations rather than rebuilt geometry, which
is what makes seated, leaning and standing the same code. They breathe, blink
on their own schedule, shift their weight, and turn their heads toward you
within a polite range when you walk in.

Everything varies with the seed: height, build, skin, eye colour, hair colour
and style, facial hair, glasses, brow weight, nose length, jaw width. Hair greys
with age rather than being randomly grey, and past fifty the face picks up crow's
feet and nasolabial folds.

**The face gets most of the texture.** A sphere's UVs spend the bulk of their
area on the back of the head, which nobody looks at, and squeeze the face into
about a tenth of the width. Both UV axes are warped toward the face, which
leaves the seam at the back of the skull under the hair and gives roughly four
times the texel density where the features are. That is what buys the lash
line, the individual brow hairs, the vermillion border on the lips and the
stubble — none of which survive at the density a plain sphere gives you.

**The eye is geometry, not paint.** A painted eye drifts away from a
protruding eyeball the moment the head turns, so the ball, the limbal ring, the
glossy cornea, both lids and the lash line are all meshes. The lash rides the
upper lid's leading edge, so it cannot come apart from the eye it belongs to,
and blinking rotates the lid down rather than scaling anything.

**Crowds are instanced.** A hundred members of Congress as full characters would
cost hundreds of draw calls, so anonymous people are drawn as three instanced
meshes per group — body, head, hair — with a matrix and a colour each. The
chamber's 114 members cost 15 draw calls and 8ms to build; one full character
costs 7ms. Nobody in a crowd is a clone: build, skin and hair vary per instance.

## Surfaces and light

Every material used to be a flat colour, which is what made the rooms read as
cardboard however good the lighting was. `src/world/textures.ts` generates them
instead: oak with growth rings distorted by low-frequency noise and a seam
between the boards, carpet with tufts, cloth with an over-under weave, plaster
with a float, marble with veins, wool suiting with a twill. Each one produces a
colour map **and a normal map derived from the same height field**, which is the
part that actually makes a surface catch light — a colour map alone is a
photograph glued to a plane. Nothing is downloaded; it is a few hundred lines of
canvas work, cached by key.

One trap worth naming: three multiplies `roughnessMap` into `roughness`. A map
centred on 0.4 with a material roughness of 0.4 gives you 0.16, and every
wooden surface in the building turns into a mirror. The maps here sit near 1
and only vary.

**Ambient occlusion** does more for the picture than another thousand polygons
would — the darkening where a chair leg meets the floor is what stops furniture
hovering. It runs as a half-resolution GTAO pass, with a light bloom on the
windows and firelight and SMAA over the top, and it is low-frequency enough
that the missing pixels cost nothing. There is no per-device quality tier —
the app targets one class of hardware (a Galaxy S22+ or better) and asks for
the full picture everywhere.

The renderer still watches itself: it times its own frames, and one frame
over 120ms, or a 24-frame average over 22ms, drops the extra passes for good.
A beautiful eight frames a second is worse than a plain thirty — this is what
actually catches a device that turns out not to keep up, rather than a guess
made from screen size or touch support.

## The 3D assets

### The Oval Office

The room itself is one model, built from an FBX by
[`process-model.yml`](.github/workflows/process-model.yml) and published as a
GitHub Release asset rather than committed, because it is twelve megabytes and
it is not source.

The source FBX is not a room. It is **the whole White House estate** — the
building, the South Lawn, the perimeter fence, the outbuildings and a few
thousand instanced trees, 312 x 33 x 300 metres of it. The game is six rooms
in first person, never leaves the Oval, and the Oval's window glass is opaque,
so none of the rest is ever on screen. All of it was being converted,
optimised, shipped inside the APK and handed to the GPU anyway.

It also put the room 69 metres from the model's origin and eight metres below
it, which is the actual reason the camera pose for the Oval used to be
`(69.03, -7.09, 28.42)` — three numbers someone measured by hand, in a frame
where they meant nothing, with an 86-line module that monkey-patched
`THREE.Scene.prototype.add`, `OrbitControls.prototype.update` and
`WebGLRenderer.prototype.render` to try to find the room on the first frame.

```bash
node scripts/strip-exterior.mjs in.glb out.glb    # what CI runs
```

`strip-exterior.mjs` cuts the room out. It finds the Oval by its `Interior01`
shell rather than assuming anything about the layout, keeps what is inside plus
a margin, and **clips rather than keeps-or-drops** whatever straddles the
boundary — `DoorL` is a single mesh holding every door in the building and
`Molding` every piece of trim, both centred somewhere out on the lawn, so
dropping them whole leaves the Oval with holes where its doors were and keeping
them whole keeps the building. A straddling mesh is cut to the triangles that
lie inside and re-indexed down to the vertices those triangles still use.

Two details worth naming. Every vertex of a triangle has to be inside, not just
its centroid: the estate's ground plane is a handful of triangles 226 metres
across, and keeping one because its middle lands in the room drags a hundred
metres of geometry back with it. And the repacking works on raw typed arrays —
the model is quantised, so `getElement` hands back a denormalised float like
`0.461` and writing that back into the `Int16Array` it came from truncates
every coordinate to zero.

Then it re-origins on the floor's centre, which is what makes the numbers
readable: eye height is 1.31m, not -7.09. The camera pose is no longer written
down at all — `findDeskPose` locates the Resolute desk in the loaded model and
sits the camera behind it, so it is derived from the model and works whatever
origin the next export happens to use.

| | before | after |
| --- | --- | --- |
| bounds | 312 x 33 x 300 m | 23 x 7 x 25 m |
| triangles | 132,805 | 69,877 |
| file | 17.6 MB | 12.4 MB |

The view from the desk is unchanged — that is the point. CI fails the build if
the model comes back wider than 60 metres, because a model that was stripped by
nothing is a silent failure that only shows up in game as a camera standing in
a field.

### The furniture

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

Models load after the title screen, so the room appears immediately and fills in
as they arrive. A model that fails to load is skipped with a warning rather than
taking the room down.

## Android

Oval is an Android app, full stop — there is no web deployment. It is a
three.js scene running in a Capacitor WebView, but that is an implementation
detail: the assets are bundled into the APK so it works offline, and nothing
about the shipped product asks the player to open a browser or a URL. The
`npm run dev` web server exists for development only — iterating in a
desktop browser is faster than rebuilding the APK for every change — and is
covered under [Development](#development) below.

```bash
npm run android:apk    # build + sync + assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

It needs a JDK (17 or newer), Gradle, and an Android SDK with platform 36 and
build-tools 36. Point `ANDROID_HOME` at the SDK before building.

**Touch play.** The phone build is not the desktop build in a frame. Input runs
on pointer events, so a thumb drag looks around exactly as a mouse drag does; a
stick in the bottom-left corner walks; and tapping an object in the room, or a
door under your feet, opens or uses it. The HUD reflows below 900px: the four
corner cards collapse into a top bar and a stat strip, the station rail scrolls
instead of wrapping, and panels take the full screen.
The camera's vertical field of view is derived from a fixed horizontal one,
because three.js measures FOV vertically and a portrait phone would otherwise
show the room through a slot, and the Android back button closes a panel
rather than quitting.

One CSS trap worth naming: a `<canvas>` is a replaced element, so
`position: fixed; inset: 0` alone is not enough to make it fill the screen —
without an explicit `width`/`height: 100%`, its layout box follows its own
drawing-buffer size (the CSS size times the device pixel ratio) instead of the
viewport. On a 1:1-pixel-ratio desktop browser that is invisible; on every
phone it renders the scene oversized and puts every tap in the wrong place.

**Signing.** `android:apk` produces a debug-signed APK, which installs fine for
sideloading but is not for distribution. For a release build, generate your own
keystore and add a `signingConfig` — no keystore or password belongs in this
repository.

**Getting a build.** The current APK is committed at
[`releases/oval-president-debug.apk`](releases/oval-president-debug.apk) —
download it from GitHub, allow installs when Android asks, and open it. It is
debug-signed, so it is for sideloading rather than the Play Store.

## Project layout

```
src/game/     simulation: state, sim tick, bills, crises, arcs, cabinet, endings
src/world/    three.js: office geometry, props, controls, stations, asset loading
src/ui/       HUD, panels, touch stick, styling
src/audio/    procedural sound synthesis
src/tools/    headless balance harness
android/      Capacitor Android project
public/models/ optimised .glb props (built by `npm run assets`)
scripts/      asset pipeline (fetch + optimise props, strip the estate)
```

The simulation has no dependency on the renderer or the DOM, which is what makes
the balance harness possible.

## Development

```bash
npm run dev        # dev server, http://localhost:5173 — iterate here, then build the APK
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
npm run balance    # play the term headlessly under four strategies
npm run assets     # rebuild the 3D props from Poly Haven
```

`npm run dev` is where you make changes — a Chrome mobile-device emulation
(touch + a matching device pixel ratio) is a close enough stand-in for the
phone that most iteration never needs a real APK build. It is not, itself,
a way to play the game; see [Android](#android) for that.

`npm run balance` plays six seeds under each of four crude strategies — each
one expressed as the rooms that president actually walks to — and prints
where the numbers land. It is the fastest way to see whether a change to the
model has broken the difficulty curve:

```
idle          legacy 43.5  approval 46.1  debt 102.8  health 39.5  marriage 29.2  bills 0    arcs 3.0  earlyEnd 1/6
workaholic    legacy 49.5  approval 48.5  debt 101.8  health 32.5  marriage 27.0  bills 6.0  arcs 2.7  earlyEnd 0/6
balanced      legacy 59.3  approval 52.5  debt 101.5  health 87.8  marriage 81.2  bills 7.3  arcs 2.2  earlyEnd 0/6
family-first  legacy 54.5  approval 46.8  debt 100.3  health 94.7  marriage 90.5  bills 0    arcs 2.0  earlyEnd 0/6
```

The harness answers arcs as well as crises, which it has to: an arc blocks the
end of a month exactly as a crisis does, and before it did, `npm run balance`
hung silently the first time one fired — around month eight, with no output at
all.

Governing well beats governing hard, and neither beats doing both — which is the
shape the game is meant to have.
