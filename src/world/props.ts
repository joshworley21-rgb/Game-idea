import { ROOM } from "./office.ts";

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

export const PROPS: PropPlacement[] = [
  // --- The seating group on the rug ---
  { model: "Sofa_01", position: [0, 0, -1.15], rotation: 0, scale: 1.25 },
  { model: "Sofa_01", position: [0, 0, 1.5], rotation: Math.PI, scale: 1.25 },
  { model: "CoffeeTable_01", position: [0, 0, 0.2], rotation: 0, scale: 1.05 },
  { model: "ArmChair_01", position: [-1.95, 0, 0.2], rotation: Math.PI / 2, scale: 1.05 },
  { model: "ArmChair_01", position: [1.95, 0, 0.2], rotation: -Math.PI / 2, scale: 1.05 },

  // --- The cabinet table, north-west (the budget station) ---
  { model: "ClassicConsole_01", position: [-4.05, 0, -1.55], rotation: Math.PI / 2.4, scale: 1.1 },

  // --- The credenza by the secure line, north-east ---
  { model: "ClassicConsole_01", position: [4.15, 0, -1.55], rotation: -Math.PI / 2.4, scale: 0.95 },

  // --- The West Wing, due west: two chairs, with the clock further north ---
  { model: "ArmChair_01", position: [-4.3, 0, 0.35], rotation: Math.PI / 2.1, scale: 0.95 },
  { model: "ArmChair_01", position: [-4.15, 0, 1.45], rotation: Math.PI / 2.3, scale: 0.95 },
  { model: "vintage_grandfather_clock_01", position: [-3.95, 0, -2.8], rotation: Math.PI / 2.6, scale: 1 },

  // --- The residence side table, where the family photographs live ---
  { model: "WoodenTable_02", position: [3.2, 0, 3.15], rotation: -Math.PI / 4, scale: 1.7 },

  // --- The private study, south-west corner ---
  { model: "ArmChair_01", position: [-3.0, 0, 3.35], rotation: Math.PI / 1.3, scale: 1.05 },
  { model: "Shelf_01", position: [-4.25, 0, 2.45], rotation: Math.PI / 1.75, scale: 1 },
  { model: "book_encyclopedia_set_01", position: [-4.16, 1.02, 2.42], rotation: Math.PI / 1.75, scale: 1, groundAt: 1.02, noShadow: true },

  // --- Greenery in the corners ---
  { model: "potted_plant_01", position: [4.15, 0, 2.65], rotation: 0.4, scale: 1.15 },
  { model: "potted_plant_01", position: [-4.55, 0, -0.45], rotation: -1.1, scale: 1 },

  // --- The portrait above the mantel, and the chandelier overhead ---
  { model: "fancy_picture_frame_01", position: [0.2, 2.45, WALL_Z], rotation: Math.PI, scale: 2.3, noShadow: true },
  { model: "Chandelier_01", position: [0, 0, 0.3], ceilingAt: ROOM.height - 0.05, scale: 1.2, noShadow: true },
];
