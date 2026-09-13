import { ROOM } from "./office.ts";
import type { RoomId } from "./roomkit.ts";

/**
 * Where each downloaded model sits in the room.
 *
 * Placement is deliberately forgiving: `groundAt` drops a prop so its lowest
 * point rests on the floor and `ceilingAt` hangs one from the ceiling, both
 * measured from the model's own bounding box. That means you can add a prop
 * without knowing where its author put the origin — give it an x and z and it
 * lands correctly.
 */
export interface PropPlacement {
  /** File base name in public/models, without the .glb. */
  model: string;
  position: [x: number, y: number, z: number];
  /** Rotation about the vertical axis, in radians. */
  rotation?: number;
  scale?: number;
  /** Rest the prop's lowest point at this height. Defaults to the floor. */
  groundAt?: number;
  /** Hang the prop's highest point at this height instead. */
  ceilingAt?: number;
  /** Skipped by the shadow pass; useful for small clutter. */
  noShadow?: boolean;
  /** Set false to honour the model's own origin instead of centring it. */
  centre?: boolean;
}

/**
 * The briefing room, built from the White House Briefing Room kit.
 *
 * The kit is sixteen parts modelled in 3ds Max, each centred on its own origin,
 * so the room is an arrangement rather than a model: five bays of backdrop, a
 * soffit over them, cameras on the riser, and the fittings on the walls. The
 * room itself is 9 x 12m under a 3.4m ceiling, and the backdrop pieces are
 * 2.81m tall, which is what sets every height below.
 *
 * The bay is one column plus one panel: 0.32 + 1.37 = 1.69m. The panels are
 * centred rather than the columns, so the emblem lands on a panel and not on a
 * column — which is how the real room is laid out, and the only reason the
 * spacing is written as an offset half a bay over.
 */
const BAY = 1.69;
/** The backdrop wall, just off the -z wall of a 12m-deep room. */
const BACKDROP_Z = -5.72;
/** The camera riser's top, which the cameras stand on. */
const RISER_Y = 0.45;

const BRIEFING_PROPS: PropPlacement[] = [
  // --- The backdrop: four columns, five panels, emblem on the middle panel ---
  ...[-0.845, 0.845, -2.535, 2.535].map((x): PropPlacement => ({
    model: "BR_Column",
    position: [x, 0, BACKDROP_Z],
  })),
  ...[0, -BAY, BAY, -2 * BAY, 2 * BAY].map((x): PropPlacement => ({
    model: "BR_Glass_1",
    position: [x, 0, BACKDROP_Z - 0.04],
  })),
  // The narrow panel is the run's end stop: five wide bays leave 0.44m of bare
  // wall either side of a 9m room, which is almost exactly its width.
  ...[-4.24, 4.24].map((x): PropPlacement => ({
    model: "BR_Glass_2",
    position: [x, 0, BACKDROP_Z - 0.04],
  })),
  { model: "BR_Emblem", position: [0, 1.95, BACKDROP_Z + 0.12], groundAt: 1.95, noShadow: true },

  // --- The soffit over the backdrop, with two studio lights under it ---
  { model: "BR_Ceiling_column", position: [0, 0, BACKDROP_Z + 0.55], ceilingAt: 3.4, noShadow: true },
  { model: "BR_Focus_1", position: [-1.35, 0, BACKDROP_Z + 0.9], ceilingAt: 2.46, noShadow: true },
  { model: "BR_Focus_1", position: [1.35, 0, BACKDROP_Z + 0.9], ceilingAt: 2.46, noShadow: true },

  // --- The press pit: three cameras up on the riser, a laptop beside them ---
  { model: "BR_Camera", position: [-2.4, 0, 4.7], rotation: Math.PI, groundAt: RISER_Y },
  { model: "BR_Camera", position: [0, 0, 4.7], rotation: Math.PI, groundAt: RISER_Y },
  { model: "BR_Camera", position: [2.4, 0, 4.7], rotation: Math.PI, groundAt: RISER_Y },
  { model: "BR_Laptop", position: [-3.5, 0, 4.55], rotation: Math.PI - 0.3, groundAt: RISER_Y, noShadow: true },

  // --- The lectern's microphone, and monitors the room can actually read ---
  { model: "BR_Microphone", position: [0, 0, -4.05], groundAt: 1.2, noShadow: true },
  { model: "BR_Monitor", position: [-4.34, 0, -1.6], rotation: Math.PI / 2, groundAt: 1.35, noShadow: true },
  { model: "BR_Monitor", position: [4.34, 0, -1.6], rotation: -Math.PI / 2, groundAt: 1.35, noShadow: true },

  // --- The way out, and the fittings every real room has and no game room does
  { model: "BR_Door_2", position: [4.36, 0, 4.4], rotation: -Math.PI / 2 },
  { model: "BR_Exit_picture", position: [4.4, 0, 2.2], rotation: -Math.PI / 2, groundAt: 2.1, noShadow: true },
  { model: "BR_Fire_alarm", position: [-4.44, 0, 3.6], rotation: Math.PI / 2, groundAt: 1.45, noShadow: true },

  // Greenery either side of the backdrop, kept from the procedural dressing.
  { model: "potted_plant_01", position: [-4.0, 0, -5.1], rotation: 0.4, scale: 0.92 },
  { model: "potted_plant_01", position: [4.0, 0, -5.1], rotation: -0.4, scale: 0.92 },
];

const WALL_Z = ROOM.rz - 0.3;

const OVAL_PROPS: PropPlacement[] = [
  // --- The seating group on the rug ---
  { model: "Sofa_01", position: [0, 0, -1.15], rotation: 0, scale: 1.25 },
  { model: "Sofa_01", position: [0, 0, 1.5], rotation: Math.PI, scale: 1.25 },
  { model: "CoffeeTable_01", position: [0, 0, 0.2], rotation: 0, scale: 1.05 },
  { model: "ArmChair_01", position: [-1.95, 0, 0.2], rotation: Math.PI / 2, scale: 1.05 },
  { model: "ArmChair_01", position: [1.95, 0, 0.2], rotation: -Math.PI / 2, scale: 1.05 },

  // The budget console, the West Wing chairs, the residence table and the
  // study shelf all used to live here too, back when one room did everything.
  // They now have real rooms of their own — see PROPS_BY_ROOM below — so this
  // one keeps only what actually happens in it: the sitting area, the secure
  // line's own credenza (built in code in office.ts, not duplicated here),
  // and the greenery.

  // --- Greenery, clear of the doors that now open off every wall ---
  { model: "potted_plant_01", position: [3.7, 0, 1.9], rotation: 0.4, scale: 1.15 },
  { model: "potted_plant_01", position: [-4.55, 0, -0.45], rotation: -1.1, scale: 1 },

  // --- The portrait above the mantel, and the chandelier overhead ---
  { model: "fancy_picture_frame_01", position: [0.2, 2.45, WALL_Z], rotation: Math.PI, scale: 2.3, noShadow: true },
  { model: "Chandelier_01", position: [0, 0, 0.3], ceilingAt: ROOM.height - 0.05, scale: 1.2, noShadow: true },
];

/**
 * Signature furniture for each playable room. Models are shared and loaded
 * once, so giving secondary rooms a stronger identity does not multiply the
 * download cost.
 */
export const PROPS_BY_ROOM: Partial<Record<RoomId, PropPlacement[]>> = {
  oval: OVAL_PROPS,
  cabinet: [
    { model: "ClassicConsole_01", position: [0, 0, 3.48], rotation: Math.PI, scale: 0.9 },
    { model: "vintage_grandfather_clock_01", position: [-4.62, 0, 3.3], rotation: Math.PI, scale: 0.88 },
    { model: "potted_plant_01", position: [4.55, 0, 3.25], rotation: -0.45, scale: 1.05 },
    { model: "Chandelier_01", position: [0, 0, 0], ceilingAt: 3.72, scale: 0.92, noShadow: true },
    // Portrait over the console, clear of the door on each side wall.
    { model: "fancy_picture_frame_01", position: [0, 2.3, 3.75], rotation: Math.PI, scale: 1.6, noShadow: true },
    { model: "fancy_picture_frame_01", position: [5.3, 2.1, -1.0], rotation: -Math.PI / 2, scale: 1.3, noShadow: true },
    { model: "fancy_picture_frame_01", position: [-5.3, 2.1, 0.6], rotation: Math.PI / 2, scale: 1.3, noShadow: true },
  ],
  press: BRIEFING_PROPS,
  capitol: [
    // Flanking the Speaker's flag, big enough to read from the well.
    { model: "fancy_picture_frame_01", position: [-8, 4.5, -8.6], rotation: 0, scale: 2.8, noShadow: true },
    { model: "fancy_picture_frame_01", position: [8, 4.5, -8.6], rotation: 0, scale: 2.8, noShadow: true },
  ],
  residence: [
    { model: "WoodenTable_02", position: [3.5, 0, -2.75], rotation: -Math.PI / 2, scale: 1.15 },
    { model: "potted_plant_01", position: [4.15, 0, -3.35], rotation: -0.65, scale: 1.08 },
    { model: "fancy_picture_frame_01", position: [4.66, 2.15, 1.6], rotation: -Math.PI / 2, scale: 1.35, noShadow: true },
    { model: "Chandelier_01", position: [0.2, 0, 0.2], ceilingAt: 3.42, scale: 0.82, noShadow: true },
  ],
  study: [
    { model: "vintage_grandfather_clock_01", position: [1.95, 0, -2.18], rotation: Math.PI, scale: 0.78 },
    { model: "potted_plant_01", position: [2.03, 0, -1.45], rotation: -0.3, scale: 0.76 },
    { model: "book_encyclopedia_set_01", position: [-2.31, 1.42, 0.38], rotation: Math.PI / 2, scale: 0.72, groundAt: 1.42, noShadow: true },
    // A small painting over the hearth, and one by the door, clear of the shelves.
    { model: "fancy_picture_frame_01", position: [0, 2.0, 2.65], rotation: Math.PI, scale: 0.85, noShadow: true },
    { model: "fancy_picture_frame_01", position: [2.45, 1.85, -1.0], rotation: -Math.PI / 2, scale: 0.75, noShadow: true },
  ],
};
