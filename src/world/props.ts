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
    // A reference shelf against the east wall, clear of the door and the
    // portrait opposite it — the room some department always leaves binders in.
    { model: "Shelf_01", position: [5.15, 0, -3.0], rotation: -Math.PI / 2, scale: 0.85 },
    // Portrait over the console, clear of the door on each side wall.
    { model: "fancy_picture_frame_01", position: [0, 2.3, 3.75], rotation: Math.PI, scale: 1.6, noShadow: true },
    { model: "fancy_picture_frame_01", position: [5.3, 2.1, -1.0], rotation: -Math.PI / 2, scale: 1.3, noShadow: true },
    { model: "fancy_picture_frame_01", position: [-5.3, 2.1, 0.6], rotation: Math.PI / 2, scale: 1.3, noShadow: true },
  ],
  press: [
    { model: "potted_plant_01", position: [-3.65, 0, -5.35], rotation: 0.4, scale: 0.92 },
    { model: "potted_plant_01", position: [3.65, 0, -5.35], rotation: -0.4, scale: 0.92 },
    // The seal backdrop and camera riser own the north and south walls, so the
    // side walls carry the room's decoration instead, clear of the door.
    { model: "fancy_picture_frame_01", position: [-4.3, 2.1, -4.8], rotation: Math.PI / 2, scale: 1.1, noShadow: true },
    { model: "fancy_picture_frame_01", position: [-4.3, 2.1, 0.5], rotation: Math.PI / 2, scale: 1.1, noShadow: true },
    { model: "fancy_picture_frame_01", position: [4.3, 2.1, -4.8], rotation: -Math.PI / 2, scale: 1.1, noShadow: true },
    { model: "fancy_picture_frame_01", position: [4.3, 2.1, 0.5], rotation: -Math.PI / 2, scale: 1.1, noShadow: true },
  ],
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
    // A display shelf against the west wall, clear of the sofa and the
    // dining table, for the mementoes that do not fit on the mantel.
    { model: "Shelf_01", position: [-4.7, 0, 1.0], rotation: Math.PI / 2, scale: 0.85 },
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
