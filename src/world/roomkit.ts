import * as THREE from "three";
import { PALETTE, place, standard } from "./materials.ts";
import type { StationId } from "../game/types.ts";
import type { Pose } from "./character.ts";

/** Every room the president moves through. */
export type RoomId = "oval" | "cabinet" | "capitol" | "press" | "residence" | "study";

export interface StationAnchor {
  id: StationId;
  position: THREE.Vector3;
  focus: THREE.Vector3;
}

export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A way out of a room, and into the next one. */
export interface Door {
  to: RoomId;
  label: string;
  /** Where the player stands to use it. */
  position: THREE.Vector3;
  /** Which way they are facing when they do. */
  facing: THREE.Vector3;
}

/** Somebody who belongs in this room, and how they are sitting or standing. */
export interface CastSlot {
  /** Which list the person comes from, and their index in it. */
  role: "cabinet" | "family" | "press" | "member" | "aide";
  index: number;
  position: THREE.Vector3;
  rotationY: number;
  pose: Pose;
  /** Faction seat colour in the chamber, where the person is anonymous. */
  tint?: number;
}

export interface RoomBuild {
  id: RoomId;
  group: THREE.Group;
  anchors: StationAnchor[];
  doors: Door[];
  /** Where you appear, and what you are looking at, when you walk in. */
  spawn: THREE.Vector3;
  spawnLook: THREE.Vector3;
  colliders: Footprint[];
  cast: CastSlot[];
  /** Pushes a position back inside the room. */
  clamp: (p: THREE.Vector3) => void;
  daylight?: THREE.DirectionalLight;
  windowLights?: THREE.Group;
  /** Anchors for positional sound, when the room has any. */
  fireplace?: THREE.Object3D;
  clockSpot?: THREE.Object3D;
}

export const ROOM_INFO: Record<RoomId, { name: string; blurb: string }> = {
  oval: { name: "The Oval Office", blurb: "The desk, the phone, and the room everyone recognises." },
  cabinet: { name: "The Cabinet Room", blurb: "Your secretaries, the budget, and the West Wing's business." },
  capitol: { name: "The Capitol", blurb: "The floor of the House, and the votes you do not have yet." },
  press: { name: "The Briefing Room", blurb: "Forty-nine seats and a podium with your seal on it." },
  residence: { name: "The Residence", blurb: "Upstairs. The people who knew you before any of this." },
  study: { name: "The Private Study", blurb: "A door off the Oval, and the only hour that is yours." },
};

// ------------------------------------------------------------ shared pieces

export function rectShell(
  root: THREE.Group,
  w: number,
  d: number,
  h: number,
  opts: { floor?: number; wall?: number; ceiling?: number; carpet?: number } = {},
): void {
  const floorMat = standard(opts.floor ?? PALETTE.floor, 0.66);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  if (opts.carpet !== undefined) {
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 1.2, d - 1.2),
      standard(opts.carpet, 0.95),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.012;
    rug.receiveShadow = true;
    root.add(rug);
  }

  const wallMat = new THREE.MeshStandardMaterial({
    color: opts.wall ?? PALETTE.wall,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const walls: [number, number, number, number][] = [
    [0, -d / 2, w, 0],
    [0, d / 2, w, Math.PI],
    [-w / 2, 0, d, Math.PI / 2],
    [w / 2, 0, d, -Math.PI / 2],
  ];
  for (const [x, z, len, ry] of walls) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
    wall.position.set(x, h / 2, z);
    wall.rotation.y = ry;
    wall.receiveShadow = true;
    root.add(wall);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), standard(opts.ceiling ?? PALETTE.ceiling, 1));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = h;
  root.add(ceiling);

  // Skirting and cornice, so the walls meet the floor properly.
  for (const [y, hh] of [
    [0.08, 0.16],
    [h - 0.11, 0.22],
  ] as const) {
    for (const [x, z, len, ry] of walls) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.05), standard(PALETTE.trim, 0.8));
      trim.position.set(x, y, z);
      trim.rotation.y = ry;
      trim.translateZ(0.03);
      root.add(trim);
    }
  }
}

/** A tall sash window with daylight coming through it. */
export function window_(
  root: THREE.Group,
  lights: THREE.Group,
  x: number,
  z: number,
  ry: number,
  w = 1.1,
  h = 2.3,
): void {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.18, 0.1), standard(PALETTE.trim, 0.7));
  frame.position.set(x, h / 2 + 0.7, z);
  frame.rotation.y = ry;
  root.add(frame);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0xdfe9f4 }),
  );
  glass.position.set(x, h / 2 + 0.7, z);
  glass.rotation.y = ry;
  glass.translateZ(0.055);
  root.add(glass);

  const light = new THREE.PointLight(0xfff2d2, 3.4, 9, 2);
  light.position.set(x, h / 2 + 0.8, z);
  light.translateZ(0.5);
  lights.add(light);

  // Glazing bars, so a window is not a lit rectangle.
  const barMat = standard(PALETTE.trim, 0.7);
  for (let i = 1; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.03), barMat);
    bar.position.set(x, h / 2 + 0.7, z);
    bar.rotation.y = ry;
    bar.translateX(-w / 2 + (i * w) / 3);
    bar.translateZ(0.06);
    root.add(bar);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.03), barMat);
  rail.position.set(x, h * 0.55 + 0.7, z);
  rail.rotation.y = ry;
  rail.translateZ(0.06);
  root.add(rail);

  // Narrow drapes at the reveals, hung from a pole above the frame.
  for (const side of [-1, 1]) {
    const drape = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, h + 0.14, 0.07),
      standard(PALETTE.drape, 0.92),
    );
    drape.position.set(x, h / 2 + 0.74, z);
    drape.rotation.y = ry;
    drape.translateX(side * (w / 2 + 0.11));
    drape.translateZ(0.07);
    drape.castShadow = true;
    root.add(drape);
  }
}

/** A panelled door in a wall, which is what a room exit looks like. */
export function doorway(root: THREE.Group, x: number, z: number, ry: number, w = 1.05, h = 2.35): void {
  const casing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.12, 0.12), standard(PALETTE.trim, 0.75));
  casing.position.set(x, (h + 0.12) / 2, z);
  casing.rotation.y = ry;
  root.add(casing);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), standard(PALETTE.mahogany, 0.6));
  leaf.position.set(x, h / 2, z);
  leaf.rotation.y = ry;
  leaf.translateZ(0.05);
  leaf.castShadow = true;
  root.add(leaf);

  for (const dy of [-0.45, 0.45]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.26, h / 2 - 0.3, 0.02),
      standard(0x4a2f1c, 0.7),
    );
    panel.position.set(x, h / 2 + dy * h * 0.42, z);
    panel.rotation.y = ry;
    panel.translateZ(0.09);
    root.add(panel);
  }
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.3, metalness: 0.85 }),
  );
  knob.position.set(x, 1.02, z);
  knob.rotation.y = ry;
  knob.translateX(w / 2 - 0.14);
  knob.translateZ(0.1);
  root.add(knob);
}

/** A plain upright chair, used by the dozen. */
export function chair(
  root: THREE.Group,
  x: number,
  z: number,
  ry: number,
  colour: number = PALETTE.leather,
  height = 0.46,
): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  root.add(g);

  const seat = place(g, new THREE.BoxGeometry(0.46, 0.07, 0.44), standard(colour, 0.65), 0, height, 0);
  seat.castShadow = true;
  const back = place(
    g,
    new THREE.BoxGeometry(0.46, 0.62, 0.06),
    standard(colour, 0.65),
    0,
    height + 0.34,
    -0.2,
  );
  back.castShadow = true;
  const legMat = standard(PALETTE.walnut, 0.6);
  for (const [lx, lz] of [
    [-0.19, -0.18],
    [0.19, -0.18],
    [-0.19, 0.18],
    [0.19, 0.18],
  ]) {
    place(g, new THREE.CylinderGeometry(0.022, 0.02, height, 8), legMat, lx, height / 2, lz);
  }
}

/** A long table with a rounded end, of the kind governments buy. */
export function boardTable(
  root: THREE.Group,
  w: number,
  d: number,
  y: number = 0.75,
): Footprint {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.015, curveSegments: 48 });
  const top = new THREE.Mesh(geo, standard(PALETTE.mahogany, 0.35, 0.05));
  top.rotation.x = -Math.PI / 2;
  top.position.y = y;
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  const baseMat = standard(PALETTE.walnut, 0.6);
  for (const bx of [-w / 4, w / 4]) {
    place(root, new THREE.BoxGeometry(0.3, y - 0.06, 0.5), baseMat, bx, (y - 0.06) / 2, 0);
  }
  place(root, new THREE.BoxGeometry(w * 0.55, 0.1, 0.3), baseMat, 0, 0.06, 0);

  return { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 };
}

/** Sconces down a wall, so a windowless room is not a cave. */
export function sconces(root: THREE.Group, points: [number, number][], y = 2.1): void {
  for (const [x, z] of points) {
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.07, 0.2, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.9, side: THREE.DoubleSide }),
    );
    shade.position.set(x, y, z);
    root.add(shade);
    const bulb = new THREE.PointLight(0xffe6b8, 3.2, 7, 2);
    bulb.position.set(x, y, z);
    root.add(bulb);
  }
}

/** Keeps a position inside a rectangular room, with clearance from the walls. */
export function rectClamp(w: number, d: number, margin = 0.5) {
  return (p: THREE.Vector3): void => {
    p.x = Math.max(-w / 2 + margin, Math.min(w / 2 - margin, p.x));
    p.z = Math.max(-d / 2 + margin, Math.min(d / 2 - margin, p.z));
  };
}

/** The standard lighting rig for a room that has windows on one side. */
export function daylightFor(
  root: THREE.Group,
  lowPower: boolean,
  from: THREE.Vector3,
  at: THREE.Vector3,
): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(0xfff4e0, 1.5);
  light.position.copy(from);
  light.target.position.copy(at);
  light.castShadow = true;
  light.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 34;
  light.shadow.camera.left = -11;
  light.shadow.camera.right = 11;
  light.shadow.camera.top = 11;
  light.shadow.camera.bottom = -11;
  light.shadow.bias = -0.0012;
  root.add(light);
  root.add(light.target);
  return light;
}
