import * as THREE from "three";
import { suitingMat, weaveMat } from "./materials.ts";

/**
 * People, built in code.
 *
 * There is no CC0 source of good human models with faces, so the cast is
 * generated: a sculpted head with a painted face, a jointed body under a suit,
 * and per-person variation derived from the name, so a given secretary looks
 * the same every time you walk into the Cabinet Room.
 *
 * The body is a real hierarchy — hips → spine → chest → neck → head, and
 * chest → shoulder → upper arm → forearm → hand — so posing and animating are
 * just rotations rather than rebuilt geometry.
 */

export type Pose = "stand" | "sit" | "sit-forward" | "lean";

/** How far the upper lid is rotated back when the eye is open. */
const UPPER_LID_OPEN = -0.22;

export interface CharacterSpec {
  /** Drives every random choice, so the same name is always the same face. */
  seed: string;
  /** Rough age, which changes the face, the hair and the posture. */
  age?: number;
  /** What they are wearing. */
  dress?: "suit" | "smart" | "casual" | "robe";
  /** Overrides the colour the seed would have picked. */
  suitColor?: number;
  pose?: Pose;
}

// ---------------------------------------------------------------- variation

/** A small deterministic PRNG so a name always produces the same person. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Skin tones across a real range, in linear-ish sRGB hex. */
const SKIN = [
  0xf2d3bc, 0xe8bfa0, 0xdba97f, 0xc68e63, 0xa9714a, 0x8a5a3b, 0x6b4530, 0x4d3122,
];
const HAIR = [0x1b1512, 0x2e2019, 0x4a3223, 0x6b4a2c, 0x8a6a3f, 0xa9884f, 0x9a9a96, 0xd8d4cb];
const EYES = [0x4a3b2a, 0x3d2b1c, 0x5b4b2f, 0x3a5a4a, 0x37506b, 0x6b7a8a];
const SUITS = [0x1e2430, 0x232a38, 0x2c2c33, 0x1a2a3a, 0x33302c, 0x3a2f2c, 0x27333a];
const ACCENTS = [0x8c2f39, 0x2b4f7a, 0x7a6a2b, 0x3f6b52, 0x6b3f6b, 0x9a5a2b, 0x2f4f4f];

interface Look {
  skin: number;
  hair: number;
  eye: number;
  suit: number;
  accent: number;
  height: number;
  build: number;
  hairStyle: "short" | "crop" | "bob" | "long" | "tied" | "bald" | "receding";
  facialHair: "none" | "stubble" | "beard" | "moustache";
  glasses: boolean;
  browWeight: number;
  noseLength: number;
  jawWidth: number;
  age: number;
}

function pickLook(spec: CharacterSpec): Look {
  const rnd = seeded(spec.seed);
  const age = spec.age ?? 30 + Math.floor(rnd() * 35);
  const grey = Math.max(0, Math.min(1, (age - 44) / 30));
  const hairBase = HAIR[Math.floor(rnd() * 6)];
  const styles: Look["hairStyle"][] = ["short", "crop", "bob", "long", "tied", "receding"];
  let hairStyle = styles[Math.floor(rnd() * styles.length)];
  if (age > 55 && rnd() < 0.3) hairStyle = rnd() < 0.5 ? "bald" : "receding";

  return {
    skin: SKIN[Math.floor(rnd() * SKIN.length)],
    // Hair greys with age rather than being randomly grey.
    hair: new THREE.Color(hairBase).lerp(new THREE.Color(0xb9b5ad), grey * (0.35 + rnd() * 0.5)).getHex(),
    eye: EYES[Math.floor(rnd() * EYES.length)],
    suit: spec.suitColor ?? SUITS[Math.floor(rnd() * SUITS.length)],
    accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)],
    height: 1.62 + rnd() * 0.24,
    build: 0.86 + rnd() * 0.34,
    hairStyle,
    facialHair:
      rnd() < 0.24 ? (["stubble", "beard", "moustache"] as const)[Math.floor(rnd() * 3)] : "none",
    glasses: rnd() < 0.3,
    browWeight: 0.7 + rnd() * 0.7,
    noseLength: 0.85 + rnd() * 0.4,
    jawWidth: 0.86 + rnd() * 0.3,
    age,
  };
}

// ------------------------------------------------------- head: one geometry
//
// The painted face and the eyes, ears and hair all have to land on the same
// features, so both are driven from one set of anatomical landmarks expressed
// as directions on the head sphere. `deform` turns a direction into the point
// on the sculpted skull; `uvOf` turns the same direction into the texture
// coordinate three.js will map there. Neither can drift away from the other.

/** Polar angle from the crown, and azimuth where the face is at 90 degrees. */
interface Landmark {
  theta: number;
  phi: number;
}

const FACE = {
  browL: { theta: 72, phi: 71.3 },
  browR: { theta: 72, phi: 108.7 },
  eyeL: { theta: 82, phi: 71.3 },
  eyeR: { theta: 82, phi: 108.7 },
  noseBridge: { theta: 84, phi: 90 },
  noseTip: { theta: 97, phi: 90 },
  mouth: { theta: 109, phi: 90 },
  chin: { theta: 124, phi: 90 },
  earL: { theta: 84, phi: 8 },
  earR: { theta: 84, phi: 172 },
  cheekL: { theta: 94, phi: 55 },
  cheekR: { theta: 94, phi: 125 },
} as const satisfies Record<string, Landmark>;

/** The unit-sphere point a landmark sits on, matching three.js sphere winding. */
function dirOf(m: Landmark): THREE.Vector3 {
  const t = (m.theta * Math.PI) / 180;
  const p = (m.phi * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(p) * Math.sin(t), Math.cos(t), Math.sin(p) * Math.sin(t));
}

/**
 * A sphere's UVs spend most of their area on the back of the head, which
 * nobody looks at, and squeeze the face into about a tenth of the width. These
 * two warps push texture area toward the face: the same amount of texture, but
 * roughly four times the texel density where the features are. The seam lands
 * at the back of the skull, under the hair.
 */
const FACE_U_POWER = 0.55;
const FACE_V_POWER = 0.62;
const FACE_V_CENTRE = 0.47;

function warpU(u: number): number {
  let d = u - 0.25;
  if (d >= 0.5) d -= 1;
  if (d < -0.5) d += 1;
  let out = 0.25 + (Math.sign(d) * Math.abs(2 * d) ** FACE_U_POWER) / 2;
  if (out < 0) out += 1;
  if (out >= 1) out -= 1;
  return out;
}

function warpV(v: number): number {
  const e = v - FACE_V_CENTRE;
  const span = e >= 0 ? 1 - FACE_V_CENTRE : FACE_V_CENTRE;
  return FACE_V_CENTRE + Math.sign(e) * (Math.abs(e) / span) ** FACE_V_POWER * span;
}

/** The texture coordinate three.js assigns to that same point, warped to match. */
function uvOf(m: Landmark): { u: number; v: number } {
  return { u: warpU(m.phi / 360), v: warpV(1 - m.theta / 180) };
}

/**
 * The sculpt. Pushes a point on the unit sphere out to where it belongs on a
 * skull: brow, cheekbones, a jaw that tapers to a chin, eye sockets, a nose.
 * Called for every vertex, and again for each landmark so the eyes and ears
 * are attached to the surface rather than hovering near it.
 */
function deform(p: THREE.Vector3, look: Look): THREE.Vector3 {
  const v = p.clone();
  v.x *= 0.87;
  v.y *= 0.98;
  v.z *= 0.9;

  const front = Math.max(0, v.z);

  // Jaw: taper below the cheekbones, but stop short of a point.
  if (v.y < 0.0) {
    const t = Math.min(1, -v.y / 0.95);
    // A jaw, not a cone: the taper eases off before it reaches the chin.
    const ease = t * t * (1.35 - 0.35 * t);
    v.x *= 1 - ease * (0.26 / look.jawWidth);
    v.z *= 1 - ease * 0.1;
  }
  // Chin.
  const chin = Math.exp(-(((v.y + 0.66) / 0.24) ** 2)) * Math.exp(-((v.x / 0.26) ** 2)) * front;
  v.z += chin * 0.1;

  // Brow ridge.
  const brow = Math.exp(-(((v.y - 0.31) / 0.1) ** 2)) * Math.exp(-((v.x / 0.42) ** 2)) * front;
  v.z += brow * 0.06 * look.browWeight;

  // Cheekbones.
  const cheek =
    Math.exp(-(((v.y + 0.03) / 0.17) ** 2)) * Math.exp(-(((Math.abs(v.x) - 0.38) / 0.16) ** 2)) * front;
  v.z += cheek * 0.05;

  // Eye sockets, either side of the bridge.
  for (const side of [-1, 1]) {
    const socket =
      Math.exp(-(((v.x - side * 0.255) / 0.13) ** 2)) * Math.exp(-(((v.y - 0.14) / 0.1) ** 2)) * front;
    v.z -= socket * 0.06;
  }

  // Nose: a bridge into a tip, with wings either side.
  const centre = Math.exp(-((v.x / 0.09) ** 2));
  const bridge = centre * Math.exp(-(((v.y - 0.1) / 0.24) ** 2)) * front;
  const tip = centre * Math.exp(-(((v.y + 0.115) / 0.08) ** 2)) * front;
  v.z += bridge * 0.045 + tip * 0.115 * look.noseLength;
  const wings =
    Math.exp(-(((Math.abs(v.x) - 0.1) / 0.05) ** 2)) * Math.exp(-(((v.y + 0.14) / 0.055) ** 2)) * front;
  v.z += wings * 0.055;

  // Lips roll forward slightly so the painted mouth is not on a flat plane.
  const mouth = Math.exp(-(((v.y + 0.33) / 0.08) ** 2)) * Math.exp(-((v.x / 0.2) ** 2)) * front;
  v.z += mouth * 0.035;

  // A longer skull at the back, flatter temples, and a taper into the neck.
  if (v.z < 0) v.z *= 1.05;
  v.x *= 1 - Math.exp(-(((v.y - 0.6) / 0.32) ** 2)) * 0.06;
  if (v.y < -0.72) v.x *= 1 - (-v.y - 0.72) * 1.4;

  return v;
}

function sculptHead(look: Look): THREE.BufferGeometry {
  // Dense enough that the brow, nose and lips are geometry rather than paint.
  const geo = new THREE.SphereGeometry(1, 84, 60);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = deform(v, look);
    pos.setXYZ(i, d.x, d.y, d.z);
    uv.setXY(i, warpU(uv.getX(i)), warpV(uv.getY(i)));
  }
  geo.computeVertexNormals();
  return geo;
}

// -------------------------------------------------------------- face canvas

/** Value noise, for skin mottling and stubble that is not a flat wash. */
function noiseField(rnd: () => number, size: number): (x: number, y: number) => number {
  const grid = 24;
  const table: number[] = [];
  for (let i = 0; i < (grid + 1) * (grid + 1); i++) table.push(rnd());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = (x / size) * grid;
    const gy = (y / size) * grid;
    const x0 = Math.max(0, Math.min(grid, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(grid, Math.floor(gy)));
    const x1 = Math.min(grid, x0 + 1);
    const y1 = Math.min(grid, y0 + 1);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const a = table[y0 * (grid + 1) + x0];
    const b = table[y0 * (grid + 1) + x1];
    const c = table[y1 * (grid + 1) + x0];
    const d = table[y1 * (grid + 1) + x1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

/**
 * The face, painted onto the warped UVs at the landmark coordinates. Geometry
 * gives you a skull; this is what makes it a person — the lash line, the brow
 * hairs, the vermillion border and the shadow under the jaw do more for
 * recognition than any amount of extra polygons.
 */
function faceTexture(look: Look, seed: string): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rnd = seeded(`${seed}:skin`);
  const skin = new THREE.Color(look.skin);

  const rgba = (c: THREE.Color, a: number) =>
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
  const shade = skin.clone().multiplyScalar(0.66);
  const deep = skin.clone().multiplyScalar(0.46);
  const light = skin.clone().lerp(new THREE.Color(0xffffff), 0.22);
  const hair = new THREE.Color(look.hair);

  ctx.fillStyle = `#${skin.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  /** Landmark to canvas pixels, in the warped UV space. */
  const at = (m: Landmark, dPhi = 0, dTheta = 0): [number, number] => {
    const uv = uvOf({ theta: m.theta + dTheta, phi: m.phi + dPhi });
    return [uv.u * size, (1 - uv.v) * size];
  };
  // The warp stretches azimuth and polar angle by different amounts, so a
  // degree is worth a different number of pixels across than down.
  const sx = Math.abs(at(FACE.noseTip, 5)[0] - at(FACE.noseTip, -5)[0]) / 10;
  const sy = Math.abs(at(FACE.noseTip, 0, 5)[1] - at(FACE.noseTip, 0, -5)[1]) / 10;
  const px = (deg: number) => deg * sx;
  const py = (deg: number) => deg * sy;

  // --- Skin: mottling, so it is not a flat plastic wash.
  const noise = noiseField(rnd, size);
  const detail = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = noise(x, y) - 0.5;
      const i = (y * size + x) * 4;
      detail.data[i] = detail.data[i + 1] = detail.data[i + 2] = 128;
      detail.data[i + 3] = Math.max(0, Math.min(255, Math.abs(n) * 90));
    }
  }
  // Painted as a soft overlay rather than replacing the base.
  const mottle = document.createElement("canvas");
  mottle.width = mottle.height = size;
  mottle.getContext("2d")!.putImageData(detail, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(mottle, 0, 0);
  ctx.restore();

  const softBlob = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    colour: THREE.Color,
    alpha: number,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    g.addColorStop(0, rgba(colour, alpha));
    g.addColorStop(0.6, rgba(colour, alpha * 0.45));
    g.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // --- Modelling. Light, because the geometry and the room's lighting already
  // do most of it: paint is here to add what a sculpt cannot.
  softBlob(...at(FACE.noseBridge, 0, -30), px(20), py(11), light, 0.14);
  for (const m of [FACE.cheekL, FACE.cheekR]) {
    softBlob(...at(m, 0, -2), px(12), py(9), light, 0.1);
    softBlob(...at(m, 0, 8), px(10), py(7), shade, 0.1);
  }
  softBlob(...at(FACE.chin, 0, -3), px(8), py(5), light, 0.1);
  softBlob(...at(FACE.chin, 0, 11), px(15), py(7), shade, 0.16);

  // --- Eye sockets: a shadow the eyeball sits in.
  for (const m of [FACE.eyeL, FACE.eyeR]) {
    softBlob(...at(m, 0, 0), px(10), py(7), shade, 0.3);
    softBlob(...at(m, 0, 5.5), px(7), py(3), shade, 0.16); // under-eye
  }

  // --- Nose: bridge highlight, alar creases, nostril shadow.
  softBlob(...at(FACE.noseBridge, 0, 3), px(3.2), py(12), light, 0.2);
  softBlob(...at(FACE.noseTip, 0, -1), px(4.2), py(3.2), light, 0.22);
  for (const d of [-4.6, 4.6]) {
    softBlob(...at(FACE.noseTip, d * 1.15, 0.4), px(2.4), py(2.2), shade, 0.35);
  }
  for (const d of [-3.1, 3.1]) {
    softBlob(...at(FACE.noseTip, d, 2.6), px(1.6), py(1.1), deep, 0.7);
  }
  softBlob(...at(FACE.noseTip, 0, 4.4), px(6), py(2.2), shade, 0.28); // under the nose

  // --- Lips: two tones, a border, a philtrum and corner shadows.
  const lipBase = skin.clone().lerp(new THREE.Color(0xa8514c), 0.52);
  const lipTop = lipBase.clone().multiplyScalar(0.82);
  const mouthW = 10.5;
  const [lx, ly] = at(FACE.mouth, -mouthW, 0.2);
  const [rx, ry] = at(FACE.mouth, mouthW, 0.2);
  const [cx, cy] = at(FACE.mouth, 0, 0);
  const upperPeak = at(FACE.mouth, 0, -3.4);
  const cupidL = at(FACE.mouth, -2.1, -2.6);
  const cupidR = at(FACE.mouth, 2.1, -2.6);
  const lowerLow = at(FACE.mouth, 0, 5.0);

  ctx.fillStyle = `#${lipTop.getHexString()}`;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(at(FACE.mouth, -6, -2.6)[0], at(FACE.mouth, -6, -2.6)[1], cupidL[0], cupidL[1]);
  ctx.quadraticCurveTo(upperPeak[0], upperPeak[1] + px(1.2), cupidR[0], cupidR[1]);
  ctx.quadraticCurveTo(at(FACE.mouth, 6, -2.6)[0], at(FACE.mouth, 6, -2.6)[1], rx, ry);
  ctx.quadraticCurveTo(cx, cy + px(0.4), lx, ly);
  ctx.fill();

  ctx.fillStyle = `#${lipBase.getHexString()}`;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(cx, cy + px(0.4), rx, ry);
  ctx.quadraticCurveTo(at(FACE.mouth, 5, 4.4)[0], at(FACE.mouth, 5, 4.4)[1], lowerLow[0], lowerLow[1]);
  ctx.quadraticCurveTo(at(FACE.mouth, -5, 4.4)[0], at(FACE.mouth, -5, 4.4)[1], lx, ly);
  ctx.fill();

  // The line where the lips meet, and the corners.
  ctx.strokeStyle = rgba(deep, 0.75);
  ctx.lineWidth = px(0.55);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(cx, cy + px(0.5), rx, ry);
  ctx.stroke();
  for (const [x, y] of [[lx, ly], [rx, ry]]) softBlob(x, y, px(1.6), py(1.4), deep, 0.4);
  // Philtrum, and the shadow below the lower lip.
  softBlob(...at(FACE.mouth, 0, -6.4), px(1.4), py(2.4), shade, 0.2);
  softBlob(...at(FACE.mouth, 0, 7.6), px(5.5), py(2.4), shade, 0.24);

  // --- Eyebrows, as strokes rather than a bar.
  const browColour = hair.clone().multiplyScalar(look.hairStyle === "bald" ? 0.9 : 0.78);
  ctx.strokeStyle = rgba(browColour, 0.85);
  ctx.lineCap = "round";
  for (const m of [FACE.browL, FACE.browR]) {
    const inner = m.phi < 90 ? 1 : -1; // toward the nose
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      // An arch: highest a third of the way out from the nose.
      const along = inner * (8.5 - t * 19);
      const lift = -2.0 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.85) - t * 0.8;
      const [x0, y0] = at(m, along, lift + 3.4 + (rnd() - 0.5) * 0.8);
      const [x1, y1] = at(m, along - inner * 1.1, lift + 1.0 + (rnd() - 0.5) * 0.8);
      ctx.lineWidth = px(0.4) * look.browWeight * (0.6 + rnd() * 0.8);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // --- The lid crease. The lash line itself is geometry on the eyelid, so it
  // cannot drift away from the eyeball the way a painted one does.
  for (const m of [FACE.eyeL, FACE.eyeR]) {
    ctx.strokeStyle = rgba(shade, 0.45);
    ctx.lineWidth = px(0.5);
    ctx.beginPath();
    ctx.moveTo(...at(m, -7, -7.5));
    ctx.quadraticCurveTo(...at(m, 0, -9.5), ...at(m, 7, -7.2));
    ctx.stroke();
  }

  // --- Cheek warmth, and freckles on pale skin.
  const warm = skin.clone().lerp(new THREE.Color(0xb4655a), 0.3);
  for (const m of [FACE.cheekL, FACE.cheekR]) softBlob(...at(m, 0, 1), px(9), py(7), warm, 0.13);
  if (look.skin === SKIN[0] || look.skin === SKIN[1]) {
    ctx.fillStyle = rgba(skin.clone().lerp(new THREE.Color(0x8a5a3b), 0.55), 0.4);
    for (let i = 0; i < 90; i++) {
      const m = rnd() < 0.5 ? FACE.cheekL : FACE.cheekR;
      const [x, y] = at(m, (rnd() - 0.5) * 26, (rnd() - 0.5) * 22);
      ctx.beginPath();
      ctx.arc(x, y, px(0.22) * (0.5 + rnd()), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Facial hair, stippled over the jaw rather than painted as a block.
  if (look.facialHair !== "none") {
    const dark = hair.clone().multiplyScalar(0.72);
    const dense = look.facialHair === "stubble" ? 900 : 2600;
    const spread = look.facialHair === "moustache" ? 0 : 1;
    ctx.strokeStyle = rgba(dark, look.facialHair === "stubble" ? 0.5 : 0.9);
    for (let i = 0; i < dense; i++) {
      const dPhi = (rnd() - 0.5) * (spread ? 34 : 13);
      const dTheta = spread ? -2 + rnd() * 20 : -5.5 + rnd() * 3.4;
      // Keep the lips clear.
      if (spread && Math.abs(dPhi) < 9 && dTheta > -1.5 && dTheta < 5.5) continue;
      const m = { theta: FACE.mouth.theta, phi: FACE.mouth.phi };
      const [x, y] = at(m, dPhi, dTheta);
      ctx.lineWidth = px(0.16);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * px(0.8), y + px(0.6));
      ctx.stroke();
    }
  }

  // --- Age: folds and lines, not a wrinkle map.
  if (look.age > 48) {
    const strength = Math.min(1, (look.age - 48) / 22);
    ctx.strokeStyle = rgba(shade, 0.3 * strength);
    ctx.lineWidth = px(0.4);
    // Crow's feet.
    for (const m of [FACE.eyeL, FACE.eyeR]) {
      const out = m.phi < 90 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(...at(m, out * 7.4, -1.6 + i * 2.2));
        ctx.lineTo(...at(m, out * 11.5, -3.2 + i * 3.0));
        ctx.stroke();
      }
    }
    // Nasolabial folds.
    for (const side of [-1, 1]) {
      ctx.lineWidth = px(0.6);
      ctx.beginPath();
      ctx.moveTo(...at(FACE.noseTip, side * 5.2, 1.6));
      ctx.quadraticCurveTo(...at(FACE.mouth, side * 11, -2), ...at(FACE.mouth, side * 11.5, 4));
      ctx.stroke();
    }
    // Forehead.
    ctx.lineWidth = px(0.45);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(...at(FACE.noseBridge, -14, -28 - i * 4));
      ctx.quadraticCurveTo(...at(FACE.noseBridge, 0, -30.5 - i * 4), ...at(FACE.noseBridge, 14, -28 - i * 4));
      ctx.stroke();
    }
  }

  // --- A shadow where the hair meets the forehead, so the hairline is soft.
  if (look.hairStyle !== "bald") {
    const line = look.hairStyle === "receding" ? -44 : -32;
    softBlob(...at(FACE.noseBridge, 0, line), px(24), py(5), deep, 0.28);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// -------------------------------------------------------------------- hair

/**
 * One shared alpha mask, reused by every head regardless of hair colour:
 * a handful of tapered strands over a transparent background. The taper is
 * geometric (each strand narrows to a point), so an alpha-tested cutout
 * still reads as individual wisps rather than a card with a hard cut edge.
 * Colour comes from each card's own vertex colours, so one texture serves
 * every hairstyle in the cast.
 */
let hairCardTex: THREE.CanvasTexture | null = null;
function hairCardAlpha(): THREE.CanvasTexture {
  if (hairCardTex) return hairCardTex;
  const w = 48;
  const h = 96;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rnd = seeded("hair-card-alpha");
  const strands = 6;
  for (let s = 0; s < strands; s++) {
    let x = w * (0.15 + (s / (strands - 1)) * 0.7) + (rnd() - 0.5) * 6;
    const curve = (rnd() - 0.5) * 14;
    const startWidth = 6 + rnd() * 4;
    const alpha = 0.6 + rnd() * 0.35;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const segments = 12;
    let py = h;
    let pw = startWidth;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const y = h - t * h;
      const nx = x + curve * t * t;
      const nw = startWidth * (1 - t) ** 1.5;
      ctx.beginPath();
      ctx.moveTo(x - pw / 2, py);
      ctx.lineTo(x + pw / 2, py);
      ctx.lineTo(nx + nw / 2, y);
      ctx.lineTo(nx - nw / 2, y);
      ctx.closePath();
      ctx.fill();
      x = nx;
      py = y;
      pw = nw;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  hairCardTex = tex;
  return tex;
}

/**
 * Hair is a shell that hugs the skull down to a hairline, built from the same
 * deform function so it never floats. The hairline is higher at the front than
 * at the sides, and higher again at the temples if they are receding. A layer
 * of alpha-tested strand cards sits on top of the shell: the shell alone reads
 * as a helmet no matter how well its edge is faded, because a silhouette that
 * ends in a mesh edge is still a hard geometric line. The cards give that
 * silhouette individual, wispy strands instead.
 */
function buildHair(look: Look, seed: string): THREE.Object3D | null {
  if (look.hairStyle === "bald") return null;
  const rnd = seeded(`${seed}:hair`);
  const base = new THREE.Color(look.hair);
  const mat = new THREE.MeshStandardMaterial({
    color: base,
    roughness: 0.7,
    metalness: 0.03,
    side: THREE.DoubleSide,
    vertexColors: true,
    // A little sheen along the strands is what stops hair reading as a helmet.
    flatShading: false,
  });
  const group = new THREE.Group();

  const receding = look.hairStyle === "receding";
  const long = look.hairStyle === "long" || look.hairStyle === "bob";

  /**
   * How far down the skull hair reaches, in polar degrees, by azimuth. The
   * forehead limit never moves — length grows at the sides and the back, so
   * long hair never ends up hanging over the eyes.
   */
  const hairline = (phi: number): number => {
    const s = Math.sin((phi * Math.PI) / 180);
    const front = Math.max(0, s);
    const back = Math.max(0, -s);
    const side = 1 - front - back;
    const frontLimit = receding ? 48 : 60;
    const sideLimit = long ? 122 : 90;
    const backLimit = long ? 138 : 102;
    // A slightly ragged edge, so the hairline is not drawn with a compass.
    const ragged = Math.sin(phi * 0.21) * 1.6 + Math.sin(phi * 0.53 + 1.1) * 1.1;
    return frontLimit * front + sideLimit * side + backLimit * back + ragged;
  };

  // A parting: one azimuth where the hair lies flat and the rest sweeps away.
  const parting = long || rnd() < 0.55 ? 90 + (rnd() - 0.5) * 90 : NaN;
  const partDip = (phi: number): number => {
    if (Number.isNaN(parting)) return 0;
    let d = Math.abs(((phi - parting + 540) % 360) - 180);
    d = 180 - d;
    return Math.exp(-((d / 13) ** 2));
  };

  // Layered noise gives the shell lumps and locks instead of a smooth dome.
  const lump = (phi: number, t: number): number =>
    Math.sin(phi * 0.29 + 0.7) * 0.018 * t +
    Math.sin(phi * 0.71 + 2.2) * 0.012 * t +
    Math.sin(phi * 1.63 + 4.1) * 0.007 * t +
    Math.sin(phi * 3.1 + t * 6) * 0.005 * t;

  const rings = 18;
  const cols = 64;
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  const root = base.clone().multiplyScalar(0.62);
  const tipC = base.clone().lerp(new THREE.Color(0xffffff), 0.12);
  const c = new THREE.Color();

  for (let ring = 0; ring <= rings; ring++) {
    for (let col = 0; col <= cols; col++) {
      const phi = (col / cols) * 360;
      const limit = hairline(phi);
      const theta = (ring / rings) * limit;
      v.set(
        -Math.cos((phi * Math.PI) / 180) * Math.sin((theta * Math.PI) / 180),
        Math.cos((theta * Math.PI) / 180),
        Math.sin((phi * Math.PI) / 180) * Math.sin((theta * Math.PI) / 180),
      );
      const d = deform(v, look);
      const t = 1 - ring / rings; // 1 at the crown, 0 at the hairline
      // Thickness over the crown, minus the parting, plus lumps. The base
      // term alone never reached zero, so every hairline had a lip standing
      // proud of the scalp — `edgeFade` forces the last stretch down to a
      // true zero so the shell actually thins to nothing at its edge instead
      // of ending in a visible step.
      // Flatter than the shell used to be: the card layer above now carries
      // most of the volume, so the base no longer needs to be a full dome.
      const edgeFade = Math.min(1, t / 0.12);
      const thick =
        (0.028 + 0.055 * t * t + 0.028 * t + lump(phi, t) - partDip(phi) * 0.055 * t) * edgeFade;
      const lift = 1.022 + Math.max(0, thick);
      const sweep = long ? 0 : Math.max(0, Math.sin((phi * Math.PI) / 180)) * 0.022 * t;
      positions.push(d.x * lift, d.y * lift + 0.018 * t, d.z * lift - sweep);
      // Dark at the roots and along the parting, lighter at the tips.
      c.copy(root).lerp(tipC, Math.min(1, 0.25 + (1 - t) * 0.85));
      colours.push(c.r, c.g, c.b);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let col = 0; col < cols; col++) {
      const a = ring * (cols + 1) + col;
      const b = a + cols + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, mat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // --- Card fringe: individual wisps breaking up the shell's silhouette,
  // thick around the hairline where the shell's edge would otherwise show,
  // and scattered thinly over the crown so the dome is not a smooth cap.
  {
    const cardPositions: number[] = [];
    const cardColours: number[] = [];
    const cardUvs: number[] = [];
    const cardIndices: number[] = [];
    const outward = new THREE.Vector3();
    const side = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);

    const addCard = (phi: number, theta: number, len: number, width: number, droop: number) => {
      v.set(
        -Math.cos((phi * Math.PI) / 180) * Math.sin((theta * Math.PI) / 180),
        Math.cos((theta * Math.PI) / 180),
        Math.sin((phi * Math.PI) / 180) * Math.sin((theta * Math.PI) / 180),
      );
      const rootPoint = deform(v, look);
      outward.copy(rootPoint).normalize();
      side.set(-outward.z, 0, outward.x);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const tipPoint = rootPoint
        .clone()
        .addScaledVector(outward, len)
        .addScaledVector(down, droop * len);
      const base0 = rootPoint.clone().addScaledVector(outward, 0.008);
      const idx = cardPositions.length / 3;
      const verts = [
        base0.clone().addScaledVector(side, width / 2),
        base0.clone().addScaledVector(side, -width / 2),
        tipPoint.clone().addScaledVector(side, width * 0.12),
        tipPoint.clone().addScaledVector(side, -width * 0.12),
      ];
      for (const p of verts) cardPositions.push(p.x, p.y, p.z);
      cardUvs.push(0, 0, 1, 0, 0, 1, 1, 1);
      for (let i = 0; i < 2; i++) cardColours.push(root.r, root.g, root.b);
      for (let i = 0; i < 2; i++) cardColours.push(tipC.r, tipC.g, tipC.b);
      cardIndices.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
      // The back face too, so a card is not invisible from the wrong side.
      cardIndices.push(idx + 2, idx + 1, idx, idx + 2, idx + 3, idx + 1);
    };

    // A ring of wisps right at the hairline, where the shell's edge is.
    const fringeCount = 40;
    for (let i = 0; i < fringeCount; i++) {
      if (rnd() < 0.18) continue; // gaps, so it is not a picket fence
      const phi = (i / fringeCount) * 360 + (rnd() - 0.5) * 6;
      const theta = hairline(phi) * (0.9 + rnd() * 0.14);
      const len = (long ? 0.1 : 0.065) * (0.7 + rnd() * 0.6);
      addCard(phi, theta, len, 0.055 + rnd() * 0.02, 0.35 + rnd() * 0.35);
    }
    // A thin scatter over the crown, so the dome breaks up under a light.
    const crownCount = 18;
    for (let i = 0; i < crownCount; i++) {
      const phi = rnd() * 360;
      const theta = hairline(phi) * (0.2 + rnd() * 0.55);
      const len = (long ? 0.07 : 0.05) * (0.6 + rnd() * 0.7);
      addCard(phi, theta, len, 0.05 + rnd() * 0.02, 0.15 + rnd() * 0.25);
    }

    const cardGeo = new THREE.BufferGeometry();
    cardGeo.setAttribute("position", new THREE.Float32BufferAttribute(cardPositions, 3));
    cardGeo.setAttribute("color", new THREE.Float32BufferAttribute(cardColours, 3));
    cardGeo.setAttribute("uv", new THREE.Float32BufferAttribute(cardUvs, 2));
    cardGeo.setIndex(cardIndices);
    cardGeo.computeVertexNormals();
    const cardMat = new THREE.MeshStandardMaterial({
      map: hairCardAlpha(),
      alphaTest: 0.4,
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });
    const cards = new THREE.Mesh(cardGeo, cardMat);
    cards.castShadow = true;
    group.add(cards);
  }

  const lockMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.72 });

  if (look.hairStyle === "tied") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), lockMat);
    bun.position.set(0, 0.14, -0.95);
    bun.scale.set(1, 0.92, 0.85);
    bun.castShadow = true;
    group.add(bun);
  }
  return group;
}

// ---------------------------------------------------------------- the body

function limb(
  parent: THREE.Object3D,
  length: number,
  topR: number,
  botR: number,
  mat: THREE.Material,
): THREE.Group {
  const joint = new THREE.Group();
  // A shaft with a rounded cap at each end, so an elbow or knee is a joint
  // rather than the seam between two cylinders.
  const shaft = new THREE.CylinderGeometry(topR, botR, length, 18, 1, false);
  shaft.translate(0, -length / 2, 0);
  const top = new THREE.SphereGeometry(topR, 14, 10);
  const bottom = new THREE.SphereGeometry(botR * 1.04, 14, 10);
  bottom.translate(0, -length, 0);
  const mesh = new THREE.Mesh(shaft, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  joint.add(mesh);
  for (const cap of [top, bottom]) {
    const capMesh = new THREE.Mesh(cap, mat);
    capMesh.castShadow = true;
    joint.add(capMesh);
  }
  parent.add(joint);
  return joint;
}

/** A built person, with the handles an animator needs. */
export interface Character {
  group: THREE.Group;
  head: THREE.Group;
  neck: THREE.Group;
  chest: THREE.Group;
  hips: THREE.Group;
  arms: { left: THREE.Group; right: THREE.Group; leftFore: THREE.Group; rightFore: THREE.Group };
  legs: { left: THREE.Group; right: THREE.Group; leftShin: THREE.Group; rightShin: THREE.Group };
  eyelids: THREE.Mesh[];
  look: Look;
  /** Metres from the floor to the top of the head, in the current pose. */
  height: number;
}

export function buildCharacter(spec: CharacterSpec): Character {
  const look = pickLook(spec);
  const rnd = seeded(`${spec.seed}:pose`);
  const group = new THREE.Group();

  const scale = look.height / 1.75;
  const build = look.build;
  // The painted face carries its own shading, so the flat skin on the neck and
  // hands is toned down to sit with it rather than glowing beside it. A thin
  // clearcoat is what stops skin reading as matte plastic: real skin has a
  // faint oily sheen that catches a highlight a pure-diffuse material cannot.
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(look.skin).multiplyScalar(0.9),
    roughness: 0.62,
    metalness: 0.01,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
    // A warm sheen at grazing angles is the cheapest stand-in for real
    // subsurface scattering: it is why an ear or the edge of a cheek glows
    // faintly red-gold against the light instead of just going dark.
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color(0xff6a3c), 0.55),
  });
  const dress = spec.dress ?? "suit";
  // Wool suiting and woven shirt cloth, not flat colour: the same procedural
  // fabric the furniture already uses, cached by colour so a chamber full of
  // the same five suit tones costs one texture, not fifty.
  const suitMat = suitingMat(look.suit, 5);
  suitMat.roughness = dress === "robe" ? 0.92 : 0.78;
  const shirtMat = weaveMat(dress === "casual" ? look.accent : 0xf2efe6, 9);
  shirtMat.roughness = 0.8;
  shirtMat.normalScale.set(0.25, 0.25); // a shirt's weave is finer than a sofa's
  const accentMat = new THREE.MeshStandardMaterial({ color: look.accent, roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.45, metalness: 0.08 });

  // --- The skeleton, in metres for a 1.75m person.
  //   hip joint 0.92 · shoulder 1.44 · chin 1.52 · eyes 1.63 · crown 1.75
  //   knee 0.50 · ankle 0.07
  // Everything below is expressed against those landmarks, so the proportions
  // hold whatever height the seed picked.
  const hips = new THREE.Group();
  group.add(hips);

  const spine = new THREE.Group();
  spine.position.y = 0.14;
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.y = 0.16; // 1.22 standing
  spine.add(chest);

  // One lathed torso from hip to shoulder, so there is no seam at the waist.
  const rows: [number, number][] = [
    [-0.33, 0.163],
    [-0.24, 0.152],
    [-0.14, 0.146],
    [-0.04, 0.152],
    [0.06, 0.163],
    [0.14, 0.169],
    [0.195, 0.163],
    [0.235, 0.13],
    [0.268, 0.068],
  ];
  const torsoGeo = new THREE.LatheGeometry(
    rows.map(([y, r]) => new THREE.Vector2(r * build, y)),
    28,
  );
  torsoGeo.scale(1, 1, 0.72);
  const torso = new THREE.Mesh(torsoGeo, dress === "casual" ? shirtMat : suitMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  chest.add(torso);

  // Hips and seat, so a seated figure has something to sit on.
  const seat = new THREE.Mesh(
    new THREE.SphereGeometry(0.168 * build, 20, 14, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58),
    suitMat,
  );
  seat.scale.set(1, 0.72, 0.78);
  seat.position.y = 0.02;
  seat.castShadow = true;
  hips.add(seat);

  // The shirt and the tie or blouse showing in the jacket's opening.
  if (dress === "suit" || dress === "smart") {
    const vee = new THREE.Mesh(new THREE.ConeGeometry(0.038 * build, 0.13, 3), shirtMat);
    vee.rotation.set(Math.PI, 0, 0);
    vee.position.set(0, 0.175, 0.112 * build);
    vee.scale.set(1, 1, 0.35);
    chest.add(vee);

    if (dress === "suit" && rnd() < 0.72) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.009), accentMat);
      tie.position.set(0, 0.152, 0.122 * build);
      tie.rotation.x = -0.06;
      chest.add(tie);
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.03, 0.014), accentMat);
      knot.position.set(0, 0.212, 0.114 * build);
      chest.add(knot);
    } else {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20, Math.PI * 1.3), accentMat);
      scarf.position.set(0, 0.2, 0.055 * build);
      scarf.rotation.set(Math.PI / 2.2, 0, Math.PI * 0.85);
      chest.add(scarf);
    }
    // Lapels, angled off the collar.
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.15, 0.011), suitMat);
      lapel.position.set(side * 0.042 * build, 0.168, 0.116 * build);
      lapel.rotation.z = side * 0.22;
      chest.add(lapel);
    }
    // A shirt collar standing at the neck, and the jacket's collar behind it.
    const shirtCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058 * build, 0.052 * build, 0.05, 18, 1, true),
      shirtMat,
    );
    shirtCollar.position.set(0, 0.248, 0.004);
    chest.add(shirtCollar);
    const jacketCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.072 * build, 0.02, 8, 20, Math.PI * 1.25),
      suitMat,
    );
    jacketCollar.rotation.set(Math.PI / 2, 0, Math.PI * 1.38);
    jacketCollar.position.set(0, 0.238, -0.008);
    chest.add(jacketCollar);
  }

  // --- Neck and head.
  const neck = new THREE.Group();
  neck.position.y = 0.25; // 1.47
  chest.add(neck);
  // A neck that flares into the shoulders and narrows under the jaw, rather
  // than a tube with two hard joins.
  // Thicker than the original taper: a neck this narrow read as a post the
  // head was skewered on rather than the muscle that actually holds it up.
  const neckGeo = new THREE.LatheGeometry(
    [
      [-0.07, 0.093],
      [-0.03, 0.07],
      [0.02, 0.058],
      [0.06, 0.056],
      [0.1, 0.057],
    ].map(([y, r]) => new THREE.Vector2(r, y)),
    18,
  );
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.y = 0.05; // chin, 1.52
  neck.add(head);

  const headRadius = 0.113;
  // Physical, matching `skinMat` below, so the join at the jaw and ears is a
  // seam in the sculpt rather than a seam in how the material responds to
  // light — a painted face with a plastic clearcoat next to a warm neck
  // reads as two different materials even when the colours line up.
  const headMat = new THREE.MeshPhysicalMaterial({
    map: faceTexture(look, spec.seed),
    roughness: 0.62,
    metalness: 0.01,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color(0xff6a3c), 0.55),
  });
  const skull = new THREE.Mesh(sculptHead(look), headMat);
  skull.scale.setScalar(headRadius);
  skull.position.y = headRadius * 1.0; // eye line lands near 1.63
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  // Everything on the face is placed by landmark, on the sculpted surface, so
  // the eyes sit in the sockets the sculpt actually made.
  const onSkull = (m: Landmark, out = 0): THREE.Vector3 =>
    deform(dirOf(m), look).multiplyScalar(headRadius).add(new THREE.Vector3(0, skull.position.y, 0))
      .addScaledVector(deform(dirOf(m), look).normalize(), out * headRadius);

  for (const m of [FACE.earL, FACE.earR] as Landmark[]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.2, 12, 10), skinMat);
    ear.scale.set(0.3, 1, 0.6);
    const p = onSkull(m, -0.02);
    ear.position.copy(p);
    ear.castShadow = true;
    head.add(ear);
  }

  // Eyes: a white ball, an iris and a pupil, so they catch the light.
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.22 });
  const irisMat = new THREE.MeshStandardMaterial({ color: look.eye, roughness: 0.18, metalness: 0.05 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0908 });
  const eyelids: THREE.Mesh[] = [];
  const eyeR = headRadius * 0.135;
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.55 });
  for (const m of [FACE.eyeL, FACE.eyeR] as Landmark[]) {
    const eye = new THREE.Group();
    // Set into the socket so the ball bulges the way an eye does rather than
    // sitting on the face like a bead.
    eye.position.copy(onSkull(m, -0.085));
    eye.lookAt(new THREE.Vector3(eye.position.x * 2.4, eye.position.y, eye.position.z * 3));
    head.add(eye);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 20, 16), scleraMat);
    eye.add(ball);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.46, 24), irisMat);
    iris.position.z = eyeR * 0.915;
    eye.add(iris);
    // A limbal ring: the dark edge that makes an iris read as an iris.
    const limbal = new THREE.Mesh(
      new THREE.RingGeometry(eyeR * 0.38, eyeR * 0.47, 24),
      new THREE.MeshBasicMaterial({ color: 0x2b2018, transparent: true, opacity: 0.55 }),
    );
    limbal.position.z = eyeR * 0.925;
    eye.add(limbal);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.2, 16), pupilMat);
    pupil.position.z = eyeR * 0.93;
    eye.add(pupil);
    // A glossy cornea over the iris, which is where the catchlight comes from.
    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(eyeR * 1.02, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.32),
      new THREE.MeshPhysicalMaterial({
        transmission: 0.9,
        roughness: 0.02,
        metalness: 0,
        thickness: 0.002,
        transparent: true,
        opacity: 0.35,
      }),
    );
    cornea.rotation.x = Math.PI / 2;
    eye.add(cornea);

    // Lids as geometry, so the aperture is a real shape and the lash line
    // cannot drift away from the eyeball the way a painted one does.
    const makeLid = (upper: boolean): THREE.Mesh => {
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(eyeR * 1.06, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
        skinMat,
      );
      // Rotated so the rim cuts across the ball: the top third and the bottom
      // fifth are covered, which is where a real aperture sits.
      lid.rotation.x = upper ? UPPER_LID_OPEN : Math.PI + 0.52;
      lid.scale.set(1.07, 1, 1.07);
      return lid;
    };
    eye.add(makeLid(false));
    const lid = makeLid(true);
    eye.add(lid);

    // The lash line rides the upper lid's leading edge, so it can never drift
    // away from the eyeball the way a painted one does.
    const lashGeo = new THREE.TorusGeometry(eyeR * 1.055, eyeR * 0.05, 6, 20, Math.PI * 0.72);
    lashGeo.rotateX(Math.PI / 2);
    lashGeo.rotateY(-Math.PI * 0.14);
    const lash = new THREE.Mesh(lashGeo, lashMat);
    lid.add(lash);
    eyelids.push(lid);
  }

  const hair = buildHair(look, spec.seed);
  if (hair) {
    hair.scale.setScalar(headRadius);
    hair.position.y = skull.position.y;
    head.add(hair);
  }

  if (look.glasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.35, metalness: 0.5 });
    for (const m of [FACE.eyeL, FACE.eyeR] as Landmark[]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(headRadius * 0.17, headRadius * 0.014, 8, 20),
        frameMat,
      );
      rim.position.copy(onSkull(m, 0.03));
      rim.lookAt(new THREE.Vector3(rim.position.x * 2.2, rim.position.y, rim.position.z * 3));
      head.add(rim);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(headRadius * 0.018, headRadius * 0.018, headRadius * 0.62),
        frameMat,
      );
      const a = onSkull(m, 0.02);
      arm.position.set(a.x * 1.5, a.y, a.z * 0.55);
      head.add(arm);
    }
    const nose = onSkull(FACE.noseBridge, 0.04);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(headRadius * 0.17, headRadius * 0.012, headRadius * 0.012),
      frameMat,
    );
    bridge.position.copy(nose);
    head.add(bridge);
  }

  // --- Arms. Shoulder 1.44, elbow 1.10, wrist 0.85.
  const sleeve = dress === "casual" ? shirtMat : suitMat;
  const makeArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.163 * build, 0.185, 0);
    chest.add(shoulder);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.043 * build, 14, 12), sleeve);
    cap.scale.set(1, 0.8, 0.92);
    cap.castShadow = true;
    shoulder.add(cap);

    const upper = limb(shoulder, 0.31, 0.046 * build, 0.037 * build, sleeve);
    const fore = limb(upper, 0.25, 0.037 * build, 0.03 * build, sleeve);
    fore.position.y = -0.31;

    // A thin shirt cuff at the sleeve's edge, then a hand that overlaps it, so
    // the wrist is a join rather than a gap.
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.0325, 0.0315, 0.011, 14), shirtMat);
    cuff.position.y = -0.2495;
    fore.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), skinMat);
    hand.scale.set(0.78, 1.5, 0.48);
    hand.position.y = -0.288;
    hand.castShadow = true;
    fore.add(hand);
    return { shoulder, fore };
  };
  const rightArm = makeArm(1);
  const leftArm = makeArm(-1);

  // --- Legs. Hip 0.92, knee 0.50, ankle 0.07.
  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.078 * build, -0.02, 0);
    hips.add(hip);
    const thigh = limb(hip, 0.4, 0.075 * build, 0.058 * build, suitMat);
    const shin = limb(thigh, 0.43, 0.062 * build, 0.046 * build, suitMat);
    shin.position.y = -0.4;
    const shoe = new THREE.Group();
    shoe.position.set(0, -0.452, 0.03);
    const last = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), shoeMat);
    last.scale.set(0.72, 0.46, 1.85);
    last.position.z = 0.03;
    last.castShadow = true;
    shoe.add(last);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.075), shoeMat);
    heel.position.set(0, -0.008, -0.06);
    heel.castShadow = true;
    shoe.add(heel);
    shin.add(shoe);
    return { hip, shin };
  };
  const rightLeg = makeLeg(1);
  const leftLeg = makeLeg(-1);

  group.scale.setScalar(scale);

  const character: Character = {
    group,
    head,
    neck,
    chest,
    hips,
    arms: {
      left: leftArm.shoulder,
      right: rightArm.shoulder,
      leftFore: leftArm.fore,
      rightFore: rightArm.fore,
    },
    legs: { left: leftLeg.hip, right: rightLeg.hip, leftShin: leftLeg.shin, rightShin: rightLeg.shin },
    eyelids,
    look,
    height: look.height,
  };

  applyPose(character, spec.pose ?? "stand", rnd);
  return character;
}

// ------------------------------------------------------------------- poses

/** Sets the joint rotations for a pose, with a little per-person variation. */
export function applyPose(c: Character, pose: Pose, rnd: () => number = Math.random): void {
  const jitter = (k: number) => (rnd() - 0.5) * k;
  const { arms, legs, hips, chest, neck } = c;

  if (pose === "sit" || pose === "sit-forward") {
    // Seated on a 0.46m chair: the hips drop and the legs fold forward.
    hips.position.y = 0.5;
    legs.left.rotation.x = -Math.PI / 2 + jitter(0.1);
    legs.right.rotation.x = -Math.PI / 2 + jitter(0.1);
    legs.leftShin.rotation.x = Math.PI / 2.1 + jitter(0.12);
    legs.rightShin.rotation.x = Math.PI / 2.1 + jitter(0.12);
    legs.left.rotation.z = 0.1;
    legs.right.rotation.z = -0.1;

    const forward = pose === "sit-forward" ? 0.26 : 0.05;
    chest.rotation.x = forward;
    neck.rotation.x = -forward * 0.6;

    // Forearms come up onto the table in front of them.
    arms.left.rotation.x = -0.42 - forward + jitter(0.09);
    arms.right.rotation.x = -0.42 - forward + jitter(0.09);
    arms.left.rotation.z = 0.2;
    arms.right.rotation.z = -0.2;
    arms.leftFore.rotation.x = -1.05 + jitter(0.14);
    arms.rightFore.rotation.x = -1.05 + jitter(0.14);
    return;
  }

  if (pose === "lean") {
    hips.position.y = 0.92;
    chest.rotation.z = 0.06;
    hips.rotation.z = -0.05;
    legs.left.rotation.x = 0.05;
    legs.right.rotation.x = -0.08;
    legs.right.rotation.z = -0.14;
    arms.left.rotation.x = -0.22;
    arms.left.rotation.z = 0.14;
    arms.leftFore.rotation.x = -1.5;
    arms.right.rotation.z = -0.1;
    arms.rightFore.rotation.x = -0.28;
    return;
  }

  // Standing: arms hang with a slight outward set, weight a touch to one side.
  hips.position.y = 0.92;
  arms.left.rotation.z = 0.165 + jitter(0.05);
  arms.right.rotation.z = -0.165 + jitter(0.05);
  arms.left.rotation.x = 0.05 + jitter(0.12);
  arms.right.rotation.x = 0.05 + jitter(0.12);
  arms.leftFore.rotation.x = -0.2 + jitter(0.15);
  arms.rightFore.rotation.x = -0.2 + jitter(0.15);
  legs.left.rotation.x = jitter(0.06);
  legs.right.rotation.x = jitter(0.06);
}

// --------------------------------------------------------------- animation

/**
 * Keeps a cast alive: breathing, blinking, small weight shifts, and heads that
 * turn toward whoever has just walked in.
 */
export class CharacterAnimator {
  private cast: { c: Character; phase: number; nextBlink: number; blink: number; baseY: number }[] = [];
  private clock = 0;

  add(character: Character): void {
    this.cast.push({
      c: character,
      phase: Math.random() * Math.PI * 2,
      nextBlink: 1 + Math.random() * 5,
      blink: 0,
      baseY: character.chest.position.y,
    });
  }

  clear(): void {
    this.cast.length = 0;
  }

  update(dt: number, lookAt: THREE.Vector3 | null): void {
    this.clock += dt;
    const world = new THREE.Vector3();

    for (const entry of this.cast) {
      const { c } = entry;
      const t = this.clock + entry.phase;

      // Breathing, in the chest rather than the whole body.
      c.chest.position.y = entry.baseY + Math.sin(t * 1.15) * 0.006;
      c.chest.scale.setScalar(1 + Math.sin(t * 1.15) * 0.008);

      // A slow weight shift, so nobody stands perfectly still.
      c.hips.rotation.y = Math.sin(t * 0.31) * 0.035;
      c.chest.rotation.y = Math.sin(t * 0.23 + 1.1) * 0.045;

      // Blinking.
      entry.nextBlink -= dt;
      if (entry.nextBlink <= 0) {
        entry.blink = 0.14;
        entry.nextBlink = 1.8 + Math.random() * 5.5;
      }
      // Blinking rotates the upper lid down over the eye.
      const openX = UPPER_LID_OPEN;
      if (entry.blink > 0) {
        entry.blink -= dt;
        const shut = Math.sin(Math.max(0, entry.blink / 0.14) * Math.PI);
        for (const lid of c.eyelids) lid.rotation.x = openX + shut * 1.5;
      } else {
        for (const lid of c.eyelids) lid.rotation.x = openX;
      }

      // Heads turn toward the player, within a polite range.
      if (lookAt) {
        c.head.getWorldPosition(world);
        const to = lookAt.clone().sub(world);
        const yaw = Math.atan2(to.x, to.z);
        // Convert into the head's local frame via the character's own rotation.
        let local = yaw - c.group.rotation.y - c.hips.rotation.y - c.chest.rotation.y;
        while (local > Math.PI) local -= Math.PI * 2;
        while (local < -Math.PI) local += Math.PI * 2;
        const clamped = Math.max(-0.85, Math.min(0.85, local));
        const attention = Math.abs(local) < 1.5 ? 1 : 0;
        c.neck.rotation.y += (clamped * attention - c.neck.rotation.y) * Math.min(1, dt * 2.4);
        const pitch = Math.max(-0.25, Math.min(0.3, Math.atan2(lookAt.y - world.y, to.length())));
        c.neck.rotation.z += (0 - c.neck.rotation.z) * Math.min(1, dt * 2);
        c.head.rotation.x += (-pitch * attention * 0.6 - c.head.rotation.x) * Math.min(1, dt * 2);
      }
    }
  }
}


// ------------------------------------------------------------------- crowds

/**
 * A chamber holds a hundred members and a briefing room holds forty
 * reporters. Building each of them as a full character would cost hundreds of
 * draw calls, so anonymous people are drawn as instanced meshes: one body, one
 * head and one head of hair per group, with a matrix each.
 *
 * They are seated, they vary in size and colour, and from the well of the
 * House that is the whole job.
 */
export interface CrowdMember {
  position: THREE.Vector3;
  rotationY: number;
  /** Groups the member into one instanced draw, e.g. by faction. */
  group: number;
  seed: number;
}

/** The colours each crowd group is drawn in. */
export interface CrowdStyle {
  suit: number;
  accent?: number;
}

function seatedBodyGeometry(): THREE.BufferGeometry {
  // A seated torso with thighs, as one static mesh. The pose never changes, so
  // it does not need joints.
  const parts: THREE.BufferGeometry[] = [];

  const rows: [number, number][] = [
    [0.0, 0.17],
    [0.12, 0.16],
    [0.24, 0.168],
    [0.34, 0.178],
    [0.42, 0.172],
    [0.48, 0.138],
    [0.52, 0.07],
  ];
  const torso = new THREE.LatheGeometry(
    rows.map(([y, r]) => new THREE.Vector2(r, y)),
    16,
  );
  torso.scale(1, 1, 0.74);
  torso.translate(0, 0.5, 0);
  parts.push(torso);

  // Thighs forward, shins down.
  for (const side of [-1, 1]) {
    const thigh = new THREE.CylinderGeometry(0.075, 0.06, 0.4, 8);
    thigh.rotateX(Math.PI / 2);
    thigh.translate(side * 0.085, 0.48, 0.2);
    parts.push(thigh);
    const shin = new THREE.CylinderGeometry(0.06, 0.045, 0.42, 8);
    shin.translate(side * 0.085, 0.26, 0.39);
    parts.push(shin);
  }
  // Arms tucked against the body, forearms resting forward on the desk, so a
  // packed bench reads as people rather than a row of aeroplanes.
  for (const side of [-1, 1]) {
    const upper = new THREE.CylinderGeometry(0.044, 0.036, 0.3, 8);
    upper.rotateX(0.42);
    upper.rotateZ(side * -0.08);
    upper.translate(side * 0.152, 0.82, 0.03);
    parts.push(upper);
    const fore = new THREE.CylinderGeometry(0.035, 0.029, 0.26, 8);
    fore.rotateX(Math.PI / 2.1);
    fore.translate(side * 0.14, 0.71, 0.22);
    parts.push(fore);
  }
  // Shoulders, sitting on the torso rather than beyond it.
  for (const side of [-1, 1]) {
    const cap = new THREE.SphereGeometry(0.045, 10, 8);
    cap.scale(1, 0.82, 1);
    cap.translate(side * 0.152, 0.955, 0);
    parts.push(cap);
  }

  return mergeGeometries(parts);
}

/** Concatenates geometries that share an attribute layout. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of list) {
    const geo = g.index ? g.toNonIndexed() : g;
    const p = geo.attributes.position.array;
    geo.computeVertexNormals();
    const n = geo.attributes.normal.array;
    for (let i = 0; i < p.length; i++) positions.push(p[i]);
    for (let i = 0; i < n.length; i++) normals.push(n[i]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return out;
}

/**
 * One shared face for the crowd. Instanced meshes cannot each have their own
 * texture, so everybody in a chamber gets the same features — which reads fine
 * from the well of the House and costs one texture instead of a hundred.
 * Per-instance colour still varies the skin underneath it.
 */
let crowdFace: THREE.CanvasTexture | null = null;
function crowdFaceTexture(): THREE.CanvasTexture {
  if (crowdFace) return crowdFace;
  const look = pickLook({ seed: "crowd-face" });
  // Neutral skin, so the per-instance colour is what tints it.
  const tex = faceTexture({ ...look, skin: 0xffffff, hair: 0x6b5a48, age: 40 }, "crowd-face");
  crowdFace = tex;
  return tex;
}

/** A simplified head and hair for someone you will never speak to. */
function crowdHeadGeometry(): THREE.BufferGeometry {
  const look = pickLook({ seed: "crowd" });
  const geo = new THREE.SphereGeometry(1, 22, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = deform(v, look);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  geo.computeVertexNormals();
  geo.scale(0.113, 0.113, 0.113);
  geo.translate(0, 1.2, 0);
  return geo;
}

function crowdHairGeometry(): THREE.BufferGeometry {
  const sphere = new THREE.SphereGeometry(1.04, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const look = pickLook({ seed: "crowd" });
  const pos = sphere.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = deform(v.clone().normalize(), look).multiplyScalar(1.06);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  sphere.computeVertexNormals();
  sphere.scale(0.113, 0.113, 0.113);
  sphere.translate(0, 1.2, 0);
  return sphere;
}

/**
 * Draws a seated crowd as instanced meshes: three draw calls per group,
 * however many people are in it.
 */
export function buildCrowd(members: CrowdMember[], styles: CrowdStyle[]): THREE.Group {
  const root = new THREE.Group();
  const bodyGeo = seatedBodyGeometry();
  const headGeo = crowdHeadGeometry();
  const hairGeo = crowdHairGeometry();

  const byGroup = new Map<number, CrowdMember[]>();
  for (const m of members) {
    const list = byGroup.get(m.group) ?? [];
    list.push(m);
    byGroup.set(m.group, list);
  }

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const colour = new THREE.Color();

  for (const [groupIndex, list] of byGroup) {
    const style = styles[groupIndex % styles.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color: style.suit, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ map: crowdFaceTexture(), roughness: 0.66 });
    const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });

    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, list.length);
    const head = new THREE.InstancedMesh(headGeo, headMat, list.length);
    const hair = new THREE.InstancedMesh(hairGeo, hairMat, list.length);
    for (const mesh of [body, head, hair]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      root.add(mesh);
    }

    list.forEach((m, i) => {
      const rnd = seeded(`crowd:${m.seed}`);
      const h = 0.93 + rnd() * 0.14;
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.rotationY + (rnd() - 0.5) * 0.35);
      scale.set(h, h, h);
      matrix.compose(m.position, quat, scale);
      body.setMatrixAt(i, matrix);
      head.setMatrixAt(i, matrix);
      hair.setMatrixAt(i, matrix);

      // Per-instance colour is what stops a chamber looking like clones.
      body.setColorAt(i, colour.set(style.suit).offsetHSL(0, 0, (rnd() - 0.5) * 0.09));
      head.setColorAt(i, colour.set(SKIN[Math.floor(rnd() * SKIN.length)]));
      hair.setColorAt(i, colour.set(HAIR[Math.floor(rnd() * HAIR.length)]));
    });
    for (const mesh of [body, head, hair]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  return root;
}
