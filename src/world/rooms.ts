import * as THREE from "three";
import { PALETTE, marbleMat, metal, place, standard, weaveMat, woodMat } from "./materials.ts";
import {
  boardTable,
  bookStack,
  chair,
  daylightFor,
  doorway,
  fire,
  fruitBowl,
  mug,
  newspaper,
  openBook,
  rectClamp,
  rectShell,
  sconces,
  tumbler,
  window_,
} from "./roomkit.ts";
import type { CastSlot, Door, Footprint, RoomBuild, StationAnchor } from "./roomkit.ts";

/**
 * The rooms other than the Oval Office.
 *
 * Each one owns its own shell, furniture, station anchors, doors out, and the
 * slots where people stand or sit. The world manager swaps between them.
 */

function anchor(id: StationAnchor["id"], x: number, z: number, fx: number, fz: number, focusY = 1.05): StationAnchor {
  return {
    id,
    position: new THREE.Vector3(x, 0, z),
    focus: new THREE.Vector3(fx, focusY, fz),
  };
}

function door(to: Door["to"], label: string, x: number, z: number, fx: number, fz: number): Door {
  return {
    to,
    label,
    position: new THREE.Vector3(x, 0, z),
    facing: new THREE.Vector3(fx, 1.5, fz),
  };
}

// ------------------------------------------------------------ Cabinet Room

export function buildCabinetRoom(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);
  const W = 11;
  const D = 8;
  const H = 3.8;

  rectShell(group, W, D, H, { floor: 0x6f4b2e, wall: 0xe7dcc8, carpet: 0x2b4a3a });

  // Windows along the north wall, the way the real room faces the Rose Garden.
  for (const x of [-3.2, 0, 3.2]) window_(group, windowLights, x, -D / 2 + 0.06, 0, 1.25, 2.4);
  doorway(group, W / 2 - 0.07, 1.4, -Math.PI / 2);
  doorway(group, -W / 2 + 0.07, -1.2, Math.PI / 2);

  // The table, and twenty chairs around it.
  const colliders: Footprint[] = [];
  const table = new THREE.Group();
  group.add(table);
  colliders.push(boardTable(table, 6.4, 2.5, 0.76));

  const cast: CastSlot[] = [];
  const seats: { x: number; z: number; ry: number }[] = [];
  // Down both long sides, plus one at each end.
  for (let i = 0; i < 7; i++) {
    const x = -2.55 + i * 0.85;
    seats.push({ x, z: -1.72, ry: 0 });
    seats.push({ x, z: 1.72, ry: Math.PI });
  }
  seats.push({ x: -3.65, z: 0, ry: Math.PI / 2 });
  seats.push({ x: 3.65, z: 0, ry: -Math.PI / 2 });
  for (const s of seats) chair(group, s.x, s.z, s.ry, 0x3a2a1e, 0.47);

  // The president's chair is the taller one, in the middle of the north side.
  const head = new THREE.Group();
  head.position.set(0, 0, -1.72);
  group.add(head);
  place(head, new THREE.BoxGeometry(0.52, 0.9, 0.08), standard(0x3a2a1e, 0.6), 0, 1.02, -0.22);

  // Six secretaries, standing behind their chairs as real cardboard-cutout
  // standees — their actual portrait on a board, not a sculpted body —
  // spread down the table rather than bunched at one end.
  const order = [3, 9, 1, 11, 5, 13];
  order.forEach((seatIndex, i) => {
    const s = seats[seatIndex];
    cast.push({
      role: "cabinet",
      index: i,
      position: new THREE.Vector3(s.x, 0, s.z + (s.ry === 0 ? -0.28 : 0.28)),
      rotationY: s.ry,
      pose: "stand",
      standee: true,
    });
  });

  // Papers and water on the table, so it looks used.
  for (let i = 0; i < 12; i++) {
    const x = -2.6 + (i % 6) * 1.05;
    const z = i < 6 ? -0.7 : 0.7;
    place(group, new THREE.BoxGeometry(0.24, 0.012, 0.32), standard(PALETTE.paper, 0.9), x, 0.83, z);
    if (i % 2 === 0) {
      place(
        group,
        new THREE.CylinderGeometry(0.032, 0.028, 0.11, 12),
        new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: 0.15, metalness: 0.05 }),
        x + 0.3,
        0.885,
        z,
      );
    }
  }

  // The far wall's sideboard is a loaded model (see props.ts), so nothing is
  // hand-built here any more — a placeholder box under it was doubling the
  // furniture up.

  const flicker = sconces(group, [
    [-W / 2 + 0.2, -2.4],
    [-W / 2 + 0.2, 2.4],
    [W / 2 - 0.2, -2.4],
    [W / 2 - 0.2, 2.4],
  ]);
  const daylight = daylightFor(group, new THREE.Vector3(-1, 7, -11), new THREE.Vector3(0, 0.8, 0));
  group.add(new THREE.PointLight(0xfff0d8, 4, 16, 2).translateY(3.2));

  return {
    id: "cabinet",
    group,
    // "budget" looks up toward face height now that the secretaries across
    // the table are standing cutouts rather than seated.
    anchors: [anchor("budget", 0, -2.55, 0, -1.4, 1.6), anchor("staff", 3.0, 2.4, 3.4, 1.2)],
    doors: [
      door("oval", "The Oval Office", W / 2 - 0.9, 1.4, W / 2, 1.4),
      door("press", "The Briefing Room", -W / 2 + 0.9, -1.2, -W / 2, -1.2),
    ],
    // The meeting is already seated when you arrive — the head of the table,
    // not the doorway. Aimed up toward face height now that the secretaries
    // are standing cutouts rather than seated across the table.
    spawn: new THREE.Vector3(0, 0, -1.45),
    spawnLook: new THREE.Vector3(0, 1.75, 1.72),
    spawnEyeHeight: 1.5,
    colliders,
    cast,
    clamp: rectClamp(W, D),
    daylight,
    windowLights,
    animate: flicker,
  };
}

// ------------------------------------------------------------- The Capitol

export function buildCapitol(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);
  const W = 22;
  const D = 18;
  const H = 9;
  // Everything in the chamber is measured from the rostrum, which sits against
  // the north wall. The benches curve around it and the well is the floor
  // between the two, which is where the president stands.
  const HUB = -7.6;
  const WELL = 5.0;

  rectShell(group, W, D, H, { floor: 0x5d4130, wall: 0xdfd4bd, ceiling: 0xf0e9d8, carpet: 0x2a3f6b });

  // The rostrum: three shallow tiers, the Speaker's desk, and the flag behind.
  const rostrum = new THREE.Group();
  rostrum.position.set(0, 0, HUB - 0.6);
  group.add(rostrum);
  for (let tier = 0; tier < 3; tier++) {
    const step = place(
      rostrum,
      new THREE.BoxGeometry(5.2 - tier * 1.1, 0.34, 1.2 - tier * 0.24),
      woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.42 }),
      0,
      0.17 + tier * 0.34,
      -tier * 0.62,
    );
    step.castShadow = true;
    step.receiveShadow = true;
  }
  const dais = place(rostrum, new THREE.BoxGeometry(1.9, 0.95, 0.45), woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.4 }), 0, 1.5, 0.28);
  dais.castShadow = true;
  place(rostrum, new THREE.BoxGeometry(2.1, 0.07, 0.55), woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.3 }), 0, 1.99, 0.28);
  // The clerks' desk below, and the flag and seal above.
  place(rostrum, new THREE.BoxGeometry(3.4, 0.75, 0.5), woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.45 }), 0, 1.05, 1.15);
  place(rostrum, new THREE.BoxGeometry(4.6, 3.0, 0.1), standard(0x1d2f52, 0.9), 0, 4.4, -1.5);
  const seal = place(rostrum, new THREE.CylinderGeometry(0.62, 0.62, 0.07, 40), metal(PALETTE.brass, 0.3), 0, 4.5, -1.4);
  seal.rotation.x = Math.PI / 2;

  // Tiered benches in an arc facing the rostrum, in five faction blocks.
  const cast: CastSlot[] = [];
  const colliders: Footprint[] = [];
  // The benches are swept cylinders and rings, whose UVs stretch badly around
  // the arc, so they take a plain material rather than a tiled grain.
  const benchMat = standard(0x4a3527, 0.62);
  const riserMat = standard(0x6b4a33, 0.78);
  const rows = 6;
  const span = Math.PI * 0.86;

  for (let row = 0; row < rows; row++) {
    const radius = WELL + 0.4 + row * 1.25;
    const y = row * 0.38;

    // One curved riser and one curved desk per row, not forty boxes each.
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.66, radius + 0.66, y + 0.02, 72, 1, true, -span / 2, span),
      riserMat,
    );
    riser.position.set(0, (y + 0.02) / 2, HUB);
    riser.receiveShadow = true;
    group.add(riser);
    const cap = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.68, radius + 0.66, 72, 1, -span / 2 - Math.PI / 2, span),
      riserMat,
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(0, y + 0.02, HUB);
    cap.receiveShadow = true;
    group.add(cap);

    const desk = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - 0.68, radius - 0.68, 0.74, 72, 1, true, -span / 2, span),
      benchMat,
    );
    desk.position.set(0, y + 0.37, HUB);
    desk.castShadow = true;
    desk.receiveShadow = true;
    group.add(desk);
    const ledge = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.78, radius - 0.6, 72, 1, -span / 2 - Math.PI / 2, span),
      woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.45 }),
    );
    ledge.rotation.x = -Math.PI / 2;
    ledge.position.set(0, y + 0.74, HUB);
    group.add(ledge);

    // Members seated behind the desks, five blocks left to right.
    const perRow = 14 + row * 2;
    for (let i = 0; i < perRow; i++) {
      const a = -span / 2 + ((i + 0.5) / perRow) * span;
      const seatR = radius - 0.16;
      cast.push({
        role: "member",
        index: Math.min(4, Math.floor((i / perRow) * 5)),
        position: new THREE.Vector3(Math.sin(a) * seatR, y, HUB + Math.cos(a) * seatR),
        rotationY: a + Math.PI,
        pose: "sit",
      });
    }
  }

  // Galleries above the back benches.
  for (const side of [-1, 1]) {
    const gallery = place(
      group,
      new THREE.BoxGeometry(0.5, 0.95, D - 5),
      standard(PALETTE.trim, 0.85),
      side * (W / 2 - 1.4),
      5.0,
      0.5,
    );
    gallery.castShadow = true;
  }
  const flicker = sconces(group, [
    [-W / 2 + 0.5, -5],
    [-W / 2 + 0.5, 2],
    [W / 2 - 0.5, -5],
    [W / 2 - 0.5, 2],
  ], 3.6);
  const chandelier = new THREE.PointLight(0xfff0d0, 16, 30, 2);
  chandelier.position.set(0, 6.8, -2);
  group.add(chandelier);
  const wellLight = new THREE.PointLight(0xffeccf, 7, 14, 2);
  wellLight.position.set(0, 4.2, HUB + 2.6);
  group.add(wellLight);

  // The way in is a door in the north wall, inside the well.
  doorway(group, -4.2, -D / 2 + 0.07, 0, 1.2, 2.5);
  const daylight = daylightFor(group, new THREE.Vector3(0, 17, 7), new THREE.Vector3(0, 1, -4));

  return {
    id: "capitol",
    group,
    // You stand in the well with your back to the rostrum, the way a president
    // addressing the House does: the chamber is what you are looking at.
    anchors: [anchor("floor", 0, HUB + 2.4, 0, HUB + 7.5)],
    doors: [door("oval", "Back to the White House", -4.2, -D / 2 + 1.1, -4.2, -D / 2)],
    // The well, facing the House — the same vantage the "floor" station
    // focuses on, so a president who arrives finds Congress already seated.
    spawn: new THREE.Vector3(0, 0, HUB + 2.4),
    spawnLook: new THREE.Vector3(0, 1.7, HUB + 7.5),
    colliders,
    cast,
    clamp: (p) => {
      // The well: inside the front bench, and out of the rostrum.
      const dx = p.x;
      const dz = p.z - HUB;
      const r = Math.hypot(dx, dz);
      if (r > WELL - 0.55) {
        const k = (WELL - 0.55) / r;
        p.x = dx * k;
        p.z = HUB + dz * k;
      }
      // Do not walk up onto the Speaker's chair.
      if (p.z < HUB + 1.2 && Math.abs(p.x) < 2.8) p.z = HUB + 1.2;
      p.z = Math.max(-D / 2 + 0.6, p.z);
    },
    daylight,
    windowLights,
    animate: flicker,
  };
}

// ------------------------------------------------------- The Briefing Room

export function buildPressRoom(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);
  const W = 9;
  const D = 12;
  const H = 3.4;

  rectShell(group, W, D, H, { floor: 0x4a4238, wall: 0xd9cfc0, carpet: 0x27364f });

  // The backdrop and the podium.
  const backdrop = place(
    group,
    new THREE.BoxGeometry(6.4, 2.9, 0.12),
    standard(0x1b3358, 0.85),
    0,
    1.6,
    -D / 2 + 0.3,
  );
  backdrop.receiveShadow = true;
  for (let i = 0; i < 4; i++) {
    place(
      group,
      new THREE.BoxGeometry(0.06, 2.9, 0.02),
      standard(0x2b4a76, 0.8),
      -2.4 + i * 1.6,
      1.6,
      -D / 2 + 0.38,
    );
  }
  const seal = place(
    group,
    new THREE.CylinderGeometry(0.5, 0.5, 0.05, 40),
    metal(PALETTE.brass, 0.35),
    0,
    2.1,
    -D / 2 + 0.4,
  );
  seal.rotation.x = Math.PI / 2;
  const ring = place(
    group,
    new THREE.TorusGeometry(0.56, 0.035, 10, 40),
    metal(0xd8c489, 0.3),
    0,
    2.1,
    -D / 2 + 0.42,
  );
  ring.rotation.x = 0;

  const podium = new THREE.Group();
  podium.position.set(0, 0, -4.1);
  group.add(podium);
  const body = place(podium, new THREE.BoxGeometry(0.72, 1.15, 0.5), woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.38 }), 0, 0.575, 0);
  body.castShadow = true;
  const top = place(podium, new THREE.BoxGeometry(0.82, 0.06, 0.56), standard(PALETTE.walnut, 0.35), 0, 1.18, 0);
  top.rotation.x = -0.14;
  const crest = place(podium, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 32), metal(PALETTE.brass, 0.3), 0, 0.72, 0.26);
  crest.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const mic = place(podium, new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8), metal(0x2a2a2a, 0.5), side * 0.1, 1.36, 0.05);
    mic.rotation.set(-0.5, 0, side * 0.22);
  }
  const colliders: Footprint[] = [{ minX: -0.45, maxX: 0.45, minZ: -4.4, maxZ: -3.8 }];

  // Seven rows of seven seats, and a press corps in most of them.
  const cast: CastSlot[] = [];
  let index = 0;
  for (let row = 0; row < 7; row++) {
    const z = -2.6 + row * 1.05;
    for (let col = 0; col < 7; col++) {
      const x = -2.7 + col * 0.9;
      chair(group, x, z, 0, 0x2b3242, 0.44);
      // Leave a few empty, the way a briefing room always is.
      if ((row * 7 + col) % 4 !== 3) {
        cast.push({
          role: "press",
          index: index++,
          position: new THREE.Vector3(x, 0, z - 0.06),
          rotationY: 0,
          pose: (row + col) % 4 === 0 ? "sit-forward" : "sit",
        });
      }
    }
  }

  // Camera risers at the back.
  const riser = place(group, new THREE.BoxGeometry(W - 1.4, 0.45, 1.6), standard(0x33302b, 0.85), 0, 0.225, D / 2 - 1.3);
  riser.receiveShadow = true;
  colliders.push({ minX: -(W - 1.4) / 2, maxX: (W - 1.4) / 2, minZ: D / 2 - 2.1, maxZ: D / 2 - 0.5 });
  for (const x of [-2.4, 0, 2.4]) {
    const cam = place(group, new THREE.BoxGeometry(0.3, 0.24, 0.5), standard(0x1b1b1b, 0.5), x, 1.62, D / 2 - 1.3);
    cam.castShadow = true;
    place(group, new THREE.CylinderGeometry(0.03, 0.05, 1.0, 8), metal(0x222222, 0.5), x, 0.95, D / 2 - 1.3);
  }

  const flicker = sconces(group, [
    [-W / 2 + 0.3, -3],
    [-W / 2 + 0.3, 2],
    [W / 2 - 0.3, -3],
    [W / 2 - 0.3, 2],
  ], 2.8);
  // The lights on the podium, which is what a briefing room actually is.
  const key = new THREE.SpotLight(0xfff4e2, 22, 12, 0.65, 0.5, 1.6);
  key.position.set(0, 3.1, -1.6);
  key.target.position.set(0, 1.3, -4.1);
  key.castShadow = true;
  group.add(key, key.target);
  group.add(new THREE.PointLight(0xffeccf, 4, 16, 2).translateY(2.9).translateZ(2));

  doorway(group, W / 2 - 0.07, D / 2 - 1.6, -Math.PI / 2);
  const daylight = daylightFor(group, new THREE.Vector3(6, 8, 4), new THREE.Vector3(0, 1, -2));
  daylight.intensity = 0.5;

  return {
    id: "press",
    group,
    anchors: [anchor("press", 0, -3.3, 0, -4.3)],
    doors: [door("cabinet", "The Cabinet Room", W / 2 - 0.95, D / 2 - 1.6, W / 2, D / 2 - 1.6)],
    // At the podium, facing the press pool rather than the empty chairs a
    // more literal doorway arrival would start you looking at.
    spawn: new THREE.Vector3(0, 0, -3.6),
    spawnLook: new THREE.Vector3(0, 1.4, 1.2),
    colliders,
    cast,
    clamp: rectClamp(W, D),
    daylight,
    windowLights,
    animate: flicker,
  };
}

// -------------------------------------------------------------- The Residence

export function buildResidence(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);
  const W = 10;
  const D = 8.5;
  const H = 3.5;

  rectShell(group, W, D, H, { floor: 0x8a6038, wall: 0xf0e4d0, carpet: 0x7a3b3b });

  for (const x of [-2.6, 0.6]) window_(group, windowLights, x, -D / 2 + 0.06, 0, 1.3, 2.3);
  doorway(group, W / 2 - 0.07, -1.8, -Math.PI / 2);

  const colliders: Footprint[] = [];
  const warm = weaveMat(0xa8865c, 3);

  // A sofa and two armchairs round a low table, facing the fire.
  const sofa = new THREE.Group();
  sofa.position.set(-1.4, 0, 1.5);
  sofa.rotation.y = 0.25;
  group.add(sofa);
  place(sofa, new THREE.BoxGeometry(2.3, 0.42, 0.95), warm, 0, 0.35, 0).castShadow = true;
  place(sofa, new THREE.BoxGeometry(2.3, 0.68, 0.22), warm, 0, 0.78, -0.38).castShadow = true;
  for (const side of [-1, 1]) {
    place(sofa, new THREE.BoxGeometry(0.22, 0.55, 0.95), warm, side * 1.04, 0.62, 0).castShadow = true;
  }
  colliders.push({ minX: -2.7, maxX: -0.1, minZ: 0.9, maxZ: 2.1 });

  for (const [ax, az, ry] of [
    [1.6, 0.5, -1.0],
    [1.5, 3.0, -2.1],
  ] as const) {
    const ac = new THREE.Group();
    ac.position.set(ax, 0, az);
    ac.rotation.y = ry;
    group.add(ac);
    place(ac, new THREE.BoxGeometry(0.9, 0.4, 0.85), weaveMat(0x8c6a4a, 2.5), 0, 0.34, 0).castShadow = true;
    place(ac, new THREE.BoxGeometry(0.9, 0.66, 0.2), weaveMat(0x8c6a4a, 2.5), 0, 0.76, -0.33).castShadow = true;
    colliders.push({ minX: ax - 0.5, maxX: ax + 0.5, minZ: az - 0.5, maxZ: az + 0.5 });
  }

  const low = place(group, new THREE.BoxGeometry(1.2, 0.06, 0.7), woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.38 }), 0.1, 0.42, 1.5);
  low.castShadow = true;
  for (const [lx, lz] of [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]]) {
    place(group, new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.5 }), 0.1 + lx, 0.21, 1.5 + lz);
  }
  // A table somebody actually uses: a mug going cold, a book left open, the
  // evening paper folded over the arm.
  mug(group, -0.28, 0.45, 1.32, 0xd8c9a8);
  bookStack(group, 0.42, 0.45, 1.62, 0.3);
  newspaper(group, 0, 0.45, 1.35, 0.15);

  // The dinner table, which is the one that matters upstairs.
  const dining = new THREE.Group();
  dining.position.set(-2.6, 0, -1.9);
  group.add(dining);
  const dtop = place(dining, new THREE.BoxGeometry(2.0, 0.07, 1.1), woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.34 }), 0, 0.76, 0);
  dtop.castShadow = true;
  for (const [lx, lz] of [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]]) {
    place(dining, new THREE.CylinderGeometry(0.045, 0.04, 0.76, 8), woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.5 }), lx, 0.38, lz);
  }
  // A centrepiece, so the family table is set rather than bare.
  fruitBowl(dining, 0, 0.795, 0);
  colliders.push({ minX: -3.7, maxX: -1.5, minZ: -2.55, maxZ: -1.25 });
  const seats: [number, number, number][] = [
    [-3.35, -1.9, Math.PI / 2],
    [-1.85, -1.9, -Math.PI / 2],
    [-2.6, -2.75, 0],
    [-2.6, -1.05, Math.PI],
  ];
  for (const [sx, sz, ry] of seats) chair(group, sx, sz, ry, 0x6b4a33, 0.46);

  // The fire, which is where the room points.
  const hearth = new THREE.Group();
  hearth.position.set(W / 2 - 0.4, 0, 1.6);
  hearth.rotation.y = -Math.PI / 2;
  group.add(hearth);
  place(hearth, new THREE.BoxGeometry(2.0, 1.3, 0.35), marbleMat(PALETTE.marble, 1.4), 0, 0.65, 0);
  place(hearth, new THREE.BoxGeometry(1.2, 0.85, 0.2), standard(0x1a1512, 0.95), 0, 0.45, 0.12);
  const lit = fire(hearth, 0, 0.14, 0.05, 1.3);

  // Family photographs on the mantel, which is the whole point of the room.
  for (let i = 0; i < 4; i++) {
    const frame = place(
      hearth,
      new THREE.BoxGeometry(0.2, 0.26, 0.03),
      standard(PALETTE.brass, 0.4, 0.6),
      -0.7 + i * 0.46,
      1.44,
      0,
    );
    frame.rotation.y = (i - 1.5) * 0.12;
  }

  // Family slots: two on the sofa, one at the dining table.
  // The sofa cushion sits at 0.56, the dining chairs at 0.50, so the people on
  // them are lifted to match rather than hovering.
  const cast: CastSlot[] = [
    { role: "family", index: 0, position: new THREE.Vector3(-1.91, 0.07, 1.71), rotationY: 0.25, pose: "sit" },
    { role: "family", index: 1, position: new THREE.Vector3(-0.85, 0.07, 1.44), rotationY: 0.25, pose: "sit" },
    { role: "family", index: 2, position: new THREE.Vector3(-1.9, 0, -1.9), rotationY: -Math.PI / 2, pose: "sit-forward" },
  ];

  const flicker = sconces(group, [
    [-W / 2 + 0.3, 1],
    [W / 2 - 0.3, -2],
  ], 2.2);
  const lamp = new THREE.PointLight(0xffe0b0, 4.5, 8, 2);
  lamp.position.set(2.2, 1.4, 2.6);
  group.add(lamp);
  group.add(new THREE.PointLight(0xffeccf, 3.2, 14, 2).translateY(2.9));
  const daylight = daylightFor(group, new THREE.Vector3(-2, 7, -10), new THREE.Vector3(0, 0.9, 0));

  return {
    id: "residence",
    group,
    anchors: [anchor("family", 0.7, 2.3, -1.3, 1.7)],
    doors: [door("oval", "Down to the West Wing", W / 2 - 0.95, -1.8, W / 2, -1.8)],
    spawn: new THREE.Vector3(W / 2 - 1.6, 0, 1.4),
    spawnLook: new THREE.Vector3(-1.5, 1.3, 1.5),
    colliders,
    cast,
    clamp: rectClamp(W, D),
    daylight,
    windowLights,
    fireplace: lit.object,
    animate: (dt, t) => {
      lit.update(dt, t);
      flicker(dt, t);
    },
  };
}

// ----------------------------------------------------------- The Private Study

export function buildStudy(): RoomBuild {
  const group = new THREE.Group();
  const windowLights = new THREE.Group();
  group.add(windowLights);
  const W = 5.2;
  const D = 5.6;
  const H = 3.1;

  rectShell(group, W, D, H, { floor: 0x6b4a2e, wall: 0x3f4a44, carpet: 0x33403a });
  window_(group, windowLights, 0, -D / 2 + 0.06, 0, 1.0, 1.9);
  doorway(group, W / 2 - 0.07, 1.4, -Math.PI / 2, 0.95, 2.2);

  const colliders: Footprint[] = [];

  // A small desk in the window, and a reading chair by the lamp.
  const desk = place(group, new THREE.BoxGeometry(1.5, 0.07, 0.75), woodMat(PALETTE.mahogany, { repeat: 2, planks: 3, roughness: 0.34 }), -1.1, 0.75, -1.6);
  desk.castShadow = true;
  for (const [lx, lz] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]]) {
    place(group, new THREE.BoxGeometry(0.07, 0.75, 0.07), woodMat(PALETTE.walnut, { repeat: 1, planks: 2, roughness: 0.5 }), -1.1 + lx, 0.375, -1.6 + lz);
  }
  colliders.push({ minX: -1.9, maxX: -0.3, minZ: -2.05, maxZ: -1.15 });
  chair(group, -1.1, -0.85, Math.PI, 0x3a2a1e, 0.45);

  const armchair = new THREE.Group();
  armchair.position.set(1.3, 0, 1.2);
  armchair.rotation.y = -2.3;
  group.add(armchair);
  place(armchair, new THREE.BoxGeometry(0.95, 0.42, 0.9), weaveMat(0x5c4331, 2.5), 0, 0.35, 0).castShadow = true;
  place(armchair, new THREE.BoxGeometry(0.95, 0.75, 0.22), weaveMat(0x5c4331, 2.5), 0, 0.8, -0.35).castShadow = true;
  for (const side of [-1, 1]) {
    place(armchair, new THREE.BoxGeometry(0.2, 0.5, 0.9), weaveMat(0x5c4331, 2.5), side * 0.38, 0.6, 0).castShadow = true;
  }
  colliders.push({ minX: 0.75, maxX: 1.85, minZ: 0.65, maxZ: 1.75 });

  // Bookshelves the length of one wall.
  for (let shelf = 0; shelf < 5; shelf++) {
    const y = 0.4 + shelf * 0.44;
    place(group, new THREE.BoxGeometry(0.34, 0.04, 3.2), standard(PALETTE.walnut, 0.6), -W / 2 + 0.22, y, 0.4);
    for (let b = 0; b < 22; b++) {
      const h = 0.24 + ((b * 37) % 11) / 90;
      const book = place(
        group,
        new THREE.BoxGeometry(0.22, h, 0.035 + ((b * 13) % 5) / 160),
        standard([0x6b2f2f, 0x2f4a6b, 0x3f5c3a, 0x6b5a2f, 0x40354a][b % 5], 0.85),
        -W / 2 + 0.24,
        y + h / 2 + 0.02,
        -1.1 + b * 0.135,
      );
      book.rotation.z = b % 9 === 0 ? 0.09 : 0;
    }
  }
  colliders.push({ minX: -W / 2, maxX: -W / 2 + 0.45, minZ: -1.3, maxZ: 2.1 });

  // A reading lamp, the fire, and very little else.
  const lamp = new THREE.PointLight(0xffd9a0, 5, 6, 2);
  lamp.position.set(1.9, 1.5, 1.9);
  group.add(lamp);
  place(group, new THREE.CylinderGeometry(0.16, 0.2, 0.28, 14), standard(0xf0e2c4, 0.9), 1.9, 1.5, 1.9);
  place(group, new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), metal(PALETTE.brass, 0.35), 1.9, 0.75, 1.9);

  // A small table at the lamp's elbow, with the evening's reading on it.
  const side = new THREE.Group();
  side.position.set(2.1, 0, 1.55);
  group.add(side);
  place(side, new THREE.CylinderGeometry(0.19, 0.19, 0.03, 20), woodMat(PALETTE.walnut, { repeat: 1, planks: 1, roughness: 0.42 }), 0, 0.44, 0).castShadow = true;
  place(side, new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8), woodMat(PALETTE.walnut, { repeat: 1, planks: 1 }), 0, 0.22, 0);
  // Centred, so its corners stay inside the table's round edge; the tumbler
  // sits off to the side rather than on top of it.
  openBook(side, 0, 0.455, 0, 0.4);
  tumbler(side, -0.1, 0.455, -0.08);
  colliders.push({ minX: 1.91, maxX: 2.29, minZ: 1.36, maxZ: 1.74 });

  const hearth = new THREE.Group();
  hearth.position.set(0, 0, D / 2 - 0.3);
  hearth.rotation.y = Math.PI;
  group.add(hearth);
  place(hearth, new THREE.BoxGeometry(1.5, 1.1, 0.3), marbleMat(PALETTE.marble, 1.4), 0, 0.55, 0);
  place(hearth, new THREE.BoxGeometry(0.9, 0.7, 0.18), standard(0x1a1512, 0.95), 0, 0.38, 0.1);
  const lit = fire(hearth, 0, 0.13, 0.04, 1.05);

  group.add(new THREE.PointLight(0xffe8c8, 2.2, 9, 2).translateY(2.6));
  const daylight = daylightFor(group, new THREE.Vector3(0, 6, -8), new THREE.Vector3(0, 0.9, 0));
  daylight.intensity = 0.9;

  return {
    id: "study",
    group,
    anchors: [anchor("rest", 0.9, 0.5, 1.4, 1.3)],
    doors: [door("oval", "The Oval Office", W / 2 - 0.9, 1.4, W / 2, 1.4)],
    spawn: new THREE.Vector3(W / 2 - 1.5, 0, 1.4),
    spawnLook: new THREE.Vector3(-1.1, 1.0, -1.6),
    colliders,
    cast: [],
    clamp: rectClamp(W, D, 0.45),
    daylight,
    windowLights,
    fireplace: lit.object,
    animate: lit.update,
  };
}
