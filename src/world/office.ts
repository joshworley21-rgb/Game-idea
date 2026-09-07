import * as THREE from "three";
import { PALETTE, carpetMat, metal, place, plasterMat, standard, weaveMat, woodMat } from "./materials.ts";
import { mug } from "./roomkit.ts";
import type { Door, RoomBuild, RoomId, StationAnchor } from "./roomkit.ts";
import type { StationId } from "../game/types.ts";

/** Interior half-axes of the oval room, in metres. */
export const ROOM = { rx: 5.45, rz: 4.4, height: 4.3, wallThickness: 0.35 };

/** The point on the inside face of the wall directly behind a given x. */
function wallPointNorth(x: number): number {
  const t = Math.min(0.999, Math.abs(x) / ROOM.rx);
  return -ROOM.rz * Math.sqrt(1 - t * t);
}

function ellipseShape(rx: number, rz: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return shape;
}

function buildShell(root: THREE.Group): void {
  // Floor: parquet-toned ellipse.
  const floorGeo = new THREE.ShapeGeometry(ellipseShape(ROOM.rx, ROOM.rz), 96);
  const floor = new THREE.Mesh(floorGeo, woodMat(PALETTE.floor, { repeat: 4, planks: 7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // Walls: an extruded ring, so the room is genuinely oval rather than faked.
  const outer = ellipseShape(ROOM.rx + ROOM.wallThickness, ROOM.rz + ROOM.wallThickness);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, ROOM.rx, ROOM.rz, 0, Math.PI * 2, true, 0);
  outer.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(outer, {
    depth: ROOM.height,
    bevelEnabled: false,
    curveSegments: 96,
  });
  const walls = new THREE.Mesh(wallGeo, plasterMat(PALETTE.wall, 3));
  walls.rotation.x = -Math.PI / 2;
  walls.receiveShadow = true;
  root.add(walls);

  // Ceiling with a shallow cove.
  const ceilGeo = new THREE.ShapeGeometry(ellipseShape(ROOM.rx + 0.02, ROOM.rz + 0.02), 96);
  const ceiling = new THREE.Mesh(ceilGeo, plasterMat(PALETTE.ceiling, 3));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.height;
  root.add(ceiling);

  // Ceiling medallion.
  const medallion = place(
    root,
    new THREE.CylinderGeometry(1.15, 1.15, 0.06, 48),
    standard(PALETTE.trim, 0.9),
    0,
    ROOM.height - 0.03,
    0,
  );
  medallion.castShadow = false;

  // Skirting and cornice: thin rings hugging the wall.
  for (const [y, h, r] of [
    [0.075, 0.15, 0.02],
    [ROOM.height - 0.12, 0.24, 0.03],
  ] as const) {
    const ring = ellipseShape(ROOM.rx, ROOM.rz);
    const inner = new THREE.Path();
    inner.absellipse(0, 0, ROOM.rx - 0.06 - r, ROOM.rz - 0.06 - r, 0, Math.PI * 2, true, 0);
    ring.holes.push(inner);
    const geo = new THREE.ExtrudeGeometry(ring, { depth: h, bevelEnabled: false, curveSegments: 96 });
    const mesh = new THREE.Mesh(geo, standard(PALETTE.trim, 0.8));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y - h / 2;
    root.add(mesh);
  }
}

function buildRug(root: THREE.Group): void {
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.05, 72), carpetMat(PALETTE.rug, 7));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.35);
  rug.scale.set(1.28, 1, 1);
  rug.receiveShadow = true;
  root.add(rug);

  // Gold border and the ring of the presidential seal.
  for (const [radius, width] of [[2.92, 0.1], [1.42, 0.07], [1.2, 0.05]] as const) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - width, radius, 72),
      new THREE.MeshStandardMaterial({ color: PALETTE.rugTrim, roughness: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.014, 0.35);
    ring.scale.set(1.28, 1, 1);
    root.add(ring);
  }

  // A suggestion of the eagle at the centre.
  const seal = new THREE.Mesh(
    new THREE.CircleGeometry(1.12, 48),
    standard(0x223761, 0.95),
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(0, 0.013, 0.35);
  seal.scale.set(1.28, 1, 1);
  root.add(seal);

  const star = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 5),
    standard(PALETTE.rugTrim, 0.6),
  );
  star.rotation.x = -Math.PI / 2;
  star.position.set(0, 0.015, 0.35);
  star.scale.set(1.28, 1, 1);
  root.add(star);
}

function buildWindows(root: THREE.Group, sunGroup: THREE.Group): void {
  const wood = standard(PALETTE.trim, 0.75);
  for (const x of [-1.85, 0, 1.85]) {
    const z = wallPointNorth(x);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // Face the window into the room.
    g.lookAt(new THREE.Vector3(x * 0.2, 0, 0));

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 2.6),
      new THREE.MeshBasicMaterial({ color: 0xdce9f7 }),
    );
    glass.position.set(0, 1.75, 0.06);
    g.add(glass);

    // Sash bars.
    for (const bx of [-0.45, 0, 0.45]) {
      place(g, new THREE.BoxGeometry(0.05, 2.6, 0.06), wood, bx, 1.75, 0.09);
    }
    for (const by of [0.9, 1.75, 2.6]) {
      place(g, new THREE.BoxGeometry(1.35, 0.05, 0.06), wood, 0, by, 0.09);
    }
    // Frame and pediment.
    place(g, new THREE.BoxGeometry(1.7, 0.14, 0.16), wood, 0, 3.14, 0.1);
    place(g, new THREE.BoxGeometry(1.7, 0.12, 0.22), wood, 0, 0.4, 0.1);
    for (const sx of [-0.79, 0.79]) {
      place(g, new THREE.BoxGeometry(0.13, 2.9, 0.16), wood, sx, 1.8, 0.1);
    }
    // Drapes: gathered at the reveals rather than columns across the glass.
    const drape = weaveMat(PALETTE.drape, 2.5);
    drape.side = THREE.DoubleSide;
    for (const dx of [-0.9, 0.9]) {
      const curtain = place(g, new THREE.CylinderGeometry(0.055, 0.11, 2.9, 10, 1, true), drape, dx, 1.75, 0.13);
      curtain.castShadow = true;
    }
    place(g, new THREE.BoxGeometry(2.0, 0.16, 0.14), drape, 0, 3.3, 0.12);

    // Light spilling in through this window.
    const spill = new THREE.PointLight(0xf3f0e2, 4.5, 9, 2);
    spill.position.set(x * 0.9, 2.2, z + 0.9);
    sunGroup.add(spill);
    root.add(g);
  }
}

function buildDoors(root: THREE.Group): void {
  const wood = standard(PALETTE.walnut, 0.7);
  const trim = standard(PALETTE.trim, 0.8);
  const spots: [number, number, number][] = [
    [-ROOM.rx + 0.1, 1.9, Math.PI / 2],
    [ROOM.rx - 0.1, 1.9, -Math.PI / 2],
    [-ROOM.rx + 0.55, -2.4, Math.PI / 2.3],
  ];
  for (const [x, z, ry] of spots) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    place(g, new THREE.BoxGeometry(1.15, 2.5, 0.1), wood, 0, 1.25, 0);
    place(g, new THREE.BoxGeometry(1.45, 0.14, 0.16), trim, 0, 2.58, 0);
    for (const sx of [-0.66, 0.66]) {
      place(g, new THREE.BoxGeometry(0.16, 2.6, 0.16), trim, sx, 1.3, 0);
    }
    place(g, new THREE.SphereGeometry(0.06, 12, 12), metal(PALETTE.brass), 0.42, 1.1, 0.08);
    root.add(g);
  }
}

function buildDesk(root: THREE.Group): THREE.Vector3 {
  const g = new THREE.Group();
  g.position.set(0, 0, -2.75);
  // The desk is the thing you stand closest to, so it gets the finest grain.
  const wood = woodMat(PALETTE.mahogany, { repeat: 3, planks: 4, roughness: 0.34 });
  const dark = woodMat(PALETTE.walnut, { repeat: 2, planks: 3, roughness: 0.4 });

  // Top and the carved front panel of the Resolute desk.
  place(g, new THREE.BoxGeometry(2.35, 0.09, 1.15), wood, 0, 0.76, 0);
  place(g, new THREE.BoxGeometry(2.4, 0.05, 1.2), dark, 0, 0.71, 0);
  for (const px of [-0.86, 0.86]) {
    place(g, new THREE.BoxGeometry(0.62, 0.7, 1.05), wood, px, 0.35, 0);
    for (const dy of [0.18, 0.42, 0.63]) {
      place(g, new THREE.BoxGeometry(0.5, 0.16, 0.04), dark, px, dy, 0.53);
      place(g, new THREE.SphereGeometry(0.028, 8, 8), metal(PALETTE.brass), px, dy, 0.56);
    }
  }
  place(g, new THREE.BoxGeometry(1.14, 0.52, 0.12), wood, 0, 0.42, 0.5);
  place(g, new THREE.BoxGeometry(0.72, 0.34, 0.04), dark, 0, 0.44, 0.57);

  // Desk furniture.
  place(g, new THREE.BoxGeometry(0.46, 0.02, 0.32), standard(PALETTE.paper, 0.9), -0.55, 0.815, 0.08);
  place(g, new THREE.BoxGeometry(0.4, 0.05, 0.28), standard(PALETTE.leather, 0.6), 0.6, 0.83, 0.1);
  // A cup that has gone cold, the way one always does on this desk. `mug`
  // takes the surface height, not the cup's centre — the desktop sits at
  // 0.805 (0.76 top box, half its 0.09 height above that).
  mug(g, -0.15, 0.805, -0.22, 0xf2efe6);
  const lampBase = place(g, new THREE.CylinderGeometry(0.09, 0.12, 0.06, 16), metal(PALETTE.brass), 0.85, 0.83, -0.3);
  lampBase.castShadow = false;
  place(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), metal(PALETTE.brass), 0.85, 0.98, -0.3);
  const shade = place(
    g,
    new THREE.CylinderGeometry(0.16, 0.2, 0.18, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1f4630, roughness: 0.8, side: THREE.DoubleSide }),
    0.85,
    1.17,
    -0.3,
  );
  shade.castShadow = false;
  const deskLight = new THREE.PointLight(0xffd9a0, 3.5, 3.2, 2);
  deskLight.position.set(0.85, 1.05, -0.3);
  g.add(deskLight);

  // Chair.
  place(g, new THREE.BoxGeometry(0.62, 0.1, 0.58), standard(PALETTE.leather, 0.6), 0, 0.48, -0.85);
  place(g, new THREE.BoxGeometry(0.62, 0.85, 0.1), standard(PALETTE.leather, 0.6), 0, 0.92, -1.1);
  place(g, new THREE.CylinderGeometry(0.06, 0.06, 0.45, 10), metal(0x3a3a3a), 0, 0.24, -0.85);
  place(g, new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16), metal(0x3a3a3a), 0, 0.03, -0.85);

  root.add(g);
  return new THREE.Vector3(0, 0, -2.75);
}

function buildFlags(root: THREE.Group): void {
  for (const [x, color] of [[-1.35, 0x0a2351], [1.35, 0xb22234]] as const) {
    const z = wallPointNorth(x) + 0.55;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    place(g, new THREE.CylinderGeometry(0.035, 0.045, 3.0, 10), metal(PALETTE.brass, 0.5), 0, 1.5, 0);
    place(g, new THREE.SphereGeometry(0.09, 12, 12), metal(PALETTE.brass, 0.3), 0, 3.06, 0);
    const cloth = place(
      g,
      new THREE.CylinderGeometry(0.1, 0.26, 1.5, 10, 1, true, 0, Math.PI * 1.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
      0.1,
      2.1,
      0.06,
    );
    cloth.rotation.y = Math.PI * 0.25;
    root.add(g);
  }
}

function buildFireplace(root: THREE.Group): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(0.2, 0, ROOM.rz - 0.28);
  const marble = standard(PALETTE.marble, 0.5);
  place(g, new THREE.BoxGeometry(2.0, 0.14, 0.42), marble, 0, 1.24, 0);
  for (const sx of [-0.85, 0.85]) place(g, new THREE.BoxGeometry(0.3, 1.2, 0.34), marble, sx, 0.6, 0);
  place(g, new THREE.BoxGeometry(2.0, 0.22, 0.34), marble, 0, 1.09, 0);
  place(g, new THREE.BoxGeometry(1.4, 1.0, 0.16), standard(0x22201d, 0.95), 0, 0.5, -0.05);
  const embers = new THREE.PointLight(0xff7a2a, 2.2, 3.2, 2);
  embers.position.set(0, 0.35, -0.1);
  g.add(embers);

  // The portrait above the mantel is a model; see props.ts.
  root.add(g);
  return g;
}

/** Small furniture pieces that carry the interactive stations. */
/**
 * The Oval keeps only the two things that actually happen in it: the desk you
 * sign at, and the phone you pick up. Everything else has moved to the room it
 * belongs in, and the wall now has doors to those rooms instead.
 */
function buildStationFurniture(root: THREE.Group): StationAnchor[] {
  const wood = woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.42 });
  const dark = woodMat(PALETTE.walnut, { repeat: 1, planks: 2 });

  // The credenza with the secure telephone, on the east side.
  const cred = new THREE.Group();
  cred.position.set(4.15, 0, -1.55);
  cred.rotation.y = -Math.PI / 2.4;
  place(cred, new THREE.BoxGeometry(1.5, 0.85, 0.45), wood, 0, 0.42, 0).castShadow = true;
  place(cred, new THREE.BoxGeometry(0.26, 0.1, 0.2), standard(0xa81c1c, 0.5), -0.1, 0.95, 0);
  place(cred, new THREE.BoxGeometry(0.24, 0.06, 0.08), standard(0xa81c1c, 0.5), -0.1, 1.03, 0.02);
  place(cred, new THREE.BoxGeometry(0.3, 0.2, 0.22), standard(0x2b2b2b, 0.7), 0.4, 1.0, 0);
  root.add(cred);

  // A globe on the west side, where the cabinet table used to be.
  const globe = new THREE.Group();
  globe.position.set(-4.1, 0, -1.6);
  place(globe, new THREE.CylinderGeometry(0.22, 0.3, 0.06, 12), dark, 0, 0.03, 0);
  place(globe, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), dark, 0, 0.4, 0);
  place(globe, new THREE.SphereGeometry(0.3, 24, 18), standard(0x2f6d8c, 0.75), 0, 1.05, 0);
  root.add(globe);

  const anchor = (id: StationId, x: number, z: number, fx: number, fz: number): StationAnchor => ({
    id,
    position: new THREE.Vector3(x, 0, z),
    focus: new THREE.Vector3(fx, 1.1, fz),
  });

  return [
    anchor("desk", 0, -1.85, 0, -2.75),
    anchor("phone", 2.95, -1.35, 4.15, -1.55),
  ];
}

/** The four doors out of the Oval, on the ellipse, with the room each leads to. */
const OVAL_DOORS: { to: RoomId; label: string; t: number }[] = [
  { to: "cabinet", label: "The Cabinet Room", t: -0.15 * Math.PI },
  { to: "study", label: "The Private Study", t: Math.PI + 0.15 * Math.PI },
  { to: "residence", label: "Upstairs to the Residence", t: 0.26 * Math.PI },
  { to: "capitol", label: "The motorcade to the Capitol", t: 0.74 * Math.PI },
];

function buildRoomDoors(root: THREE.Group): Door[] {
  const doors: Door[] = [];
  for (const spec of OVAL_DOORS) {
    const x = ROOM.rx * Math.cos(spec.t);
    const z = ROOM.rz * Math.sin(spec.t);
    // Face the door along the inward normal of the ellipse.
    const nx = Math.cos(spec.t) / ROOM.rx;
    const nz = Math.sin(spec.t) / ROOM.rz;
    const len = Math.hypot(nx, nz);
    const inward = new THREE.Vector3(-nx / len, 0, -nz / len);

    const leaf = new THREE.Group();
    leaf.position.set(x, 0, z);
    leaf.lookAt(x + inward.x, 0, z + inward.z);
    root.add(leaf);
    place(leaf, new THREE.BoxGeometry(1.24, 2.5, 0.1), standard(PALETTE.trim, 0.75), 0, 1.25, 0.02);
    place(leaf, new THREE.BoxGeometry(1.04, 2.35, 0.06), standard(PALETTE.mahogany, 0.6), 0, 1.175, 0.08);
    for (const dy of [0.72, 1.62]) {
      place(leaf, new THREE.BoxGeometry(0.78, 0.66, 0.02), standard(0x4a2f1c, 0.7), 0, dy, 0.12);
    }
    place(
      leaf,
      new THREE.SphereGeometry(0.045, 12, 10),
      new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.3, metalness: 0.85 }),
      0.38,
      1.02,
      0.13,
    );

    doors.push({
      to: spec.to,
      label: spec.label,
      position: new THREE.Vector3(x + inward.x * 1.05, 0, z + inward.z * 1.05),
      facing: new THREE.Vector3(x, 1.5, z),
    });
  }
  return doors;
}

export function buildOffice(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);

  buildShell(group);
  buildRug(group);
  buildWindows(group, windowLights);
  buildDoors(group);
  buildDesk(group);
  buildFlags(group);
  const fireplace = buildFireplace(group);
  const anchors = buildStationFurniture(group);
  const doors = buildRoomDoors(group);

  const daylight = new THREE.DirectionalLight(0xfff4e0, 1.5);
  daylight.position.set(-2.5, 7.5, -9);
  daylight.target.position.set(0, 0.5, 0.5);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 30;
  daylight.shadow.camera.left = -9;
  daylight.shadow.camera.right = 9;
  daylight.shadow.camera.top = 9;
  daylight.shadow.camera.bottom = -9;
  daylight.shadow.bias = -0.0012;
  group.add(daylight);
  group.add(daylight.target);

  const fill = new THREE.PointLight(0xfff0d8, 5, 14, 2);
  fill.position.set(0, 3.4, 0.2);
  group.add(fill);

  // The south half of the room gets no window, so it needs its own fill.
  const southFill = new THREE.PointLight(0xffeccf, 3.2, 11, 2);
  southFill.position.set(0, 3.2, 2.9);
  group.add(southFill);

  // The grandfather clock is a loaded model, so the tick hangs off a marker at
  // the same coordinates rather than the model itself.
  const clockSpot = new THREE.Object3D();
  clockSpot.position.set(-3.95, 1.1, -2.8);
  group.add(clockSpot);

  return {
    id: "oval",
    group,
    anchors,
    doors,
    spawn: new THREE.Vector3(0, 0, 1.6),
    spawnLook: new THREE.Vector3(0, 1.0, -2.75),
    colliders: [{ minX: -1.25, maxX: 1.25, minZ: -3.5, maxZ: -2.1 }],
    cast: [],
    clamp: (p) => clampToRoom(p),
    daylight,
    windowLights,
    fireplace,
    clockSpot,
  };
}

/** How much space the player takes up, for pushing out of furniture. */
export const PLAYER_RADIUS = 0.34;

/**
 * Pushes a position out of any footprint it has entered, along whichever axis
 * needs the smallest correction, so walking into a sofa slides along it rather
 * than stopping dead.
 */
export function resolveCollisions(
  position: THREE.Vector3,
  footprints: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[],
): void {
  for (const f of footprints) {
    const minX = f.minX - PLAYER_RADIUS;
    const maxX = f.maxX + PLAYER_RADIUS;
    const minZ = f.minZ - PLAYER_RADIUS;
    const maxZ = f.maxZ + PLAYER_RADIUS;
    if (position.x <= minX || position.x >= maxX) continue;
    if (position.z <= minZ || position.z >= maxZ) continue;

    const left = position.x - minX;
    const right = maxX - position.x;
    const back = position.z - minZ;
    const front = maxZ - position.z;
    const smallest = Math.min(left, right, back, front);
    if (smallest === left) position.x = minX;
    else if (smallest === right) position.x = maxX;
    else if (smallest === back) position.z = minZ;
    else position.z = maxZ;
  }
}

/** Keeps the player inside the oval, with a little clearance from the wall. */
export function clampToRoom(position: THREE.Vector3, margin = 0.55): void {
  const rx = ROOM.rx - margin;
  const rz = ROOM.rz - margin;
  const d = (position.x * position.x) / (rx * rx) + (position.z * position.z) / (rz * rz);
  if (d > 1) {
    const scale = 1 / Math.sqrt(d);
    position.x *= scale;
    position.z *= scale;
  }
}
