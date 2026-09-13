import * as THREE from "three";
import type { CrisisTag, GameState, Thread } from "../game/types.ts";
import { DOMAIN_NAME, HEAT_DOMAINS } from "../game/actions.ts";
import { measureSitroom } from "./sitroomModelLayout.ts";

/**
 * The Situation Room's displays, driven by the game.
 *
 * The model ships three blank panels — one wide display on the wall the
 * president faces, and two projector screens on the wall the Watch Floor seat
 * faces — and blank is the one thing they must not be. The procedural room
 * this replaces drew the running situations and the domain heat on its own
 * walls, and losing that to a prettier room would be a bad trade: the whole
 * point of the room is that you can read the month off it.
 *
 * So the panels are redrawn here and hung a couple of centimetres proud of the
 * model's own surfaces. They are `MeshBasicMaterial` with `toneMapped: false`,
 * which is what makes a screen in a dark room read as a light source rather
 * than as a lit object.
 *
 * Rectangles were measured off the model by walking a ray along each wall and
 * recording where the frame material starts and stops, rather than by eye off
 * a screenshot — which is how the first pass got panels a third too small,
 * floating inside their own frames with cream showing all round them:
 *
 *     far wall  x -2.00 .. 1.84   y 1.04 .. 1.92    3.84m x 0.88m
 *     +x wall   z -1.84 .. -0.16  y 1.30 .. 2.10    1.68m x 0.80m
 *     +x wall   z  0.52 .. 2.20   y 1.30 .. 2.10    1.68m x 0.80m
 */

/** How far off the model's own surface a panel hangs, in metres. */
const PROUD = 0.025;

const WIDE = { width: 3.8, height: 0.86, centreX: -0.08, centreY: 1.48 };
const SIDE = { width: 1.64, height: 0.78, centreY: 1.7, zs: [-1.0, 1.36] };

const ACCENT = { hot: "#e0654b", warm: "#d8b45f", cool: "#6fbf8b", dim: "rgba(150,190,220,0.55)" };
const INK = "#dce8f2";
const GROUND = "#0a1118";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d")!;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, w, h);
  return [el, ctx];
}

function texture(el: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function accentFor(intensity: number): string {
  return intensity > 60 ? ACCENT.hot : intensity > 30 ? ACCENT.warm : ACCENT.cool;
}

/** Wraps a heading onto at most `lines` lines and returns the height used. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, lines = 3): void {
  const words = text.split(" ");
  let line = "";
  let row = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      ctx.fillText(line, x, y + row * lh);
      row += 1;
      line = word;
      if (row >= lines - 1) break;
    } else {
      line = next;
    }
  }
  ctx.fillText(line, x, y + row * lh);
}

/**
 * The wide display: one column per running situation, worst first.
 *
 * Three columns, because the panel is three times as wide as it is tall and a
 * situation room wall is a row of feeds, not one big picture.
 */
function wideTexture(threads: Thread[]): THREE.CanvasTexture {
  // 4.4:1, the shape of the wall it hangs on.
  const W = 1792;
  const H = 408;
  const [el, ctx] = canvas(W, H);
  const running = [...threads].sort((a, b) => b.intensity - a.intensity).slice(0, 3);

  ctx.strokeStyle = "rgba(110,150,185,0.3)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo((W / 3) * i, 24);
    ctx.lineTo((W / 3) * i, H - 24);
    ctx.stroke();
  }

  if (!running.length) {
    ctx.fillStyle = ACCENT.dim;
    ctx.font = "500 44px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("NO ACTIVE SITUATION", W / 2, H / 2 + 16);
    return texture(el);
  }

  for (let i = 0; i < 3; i += 1) {
    const t = running[i];
    const x = (W / 3) * i + 44;
    const w = W / 3 - 88;
    ctx.textAlign = "left";
    if (!t) {
      ctx.fillStyle = "rgba(150,190,220,0.3)";
      ctx.font = "500 28px ui-monospace, monospace";
      ctx.fillText("— CLEAR —", x, H / 2);
      continue;
    }
    const accent = accentFor(t.intensity);

    ctx.fillStyle = ACCENT.dim;
    ctx.font = "500 24px ui-monospace, monospace";
    ctx.fillText(`RUNNING · MONTH ${t.age + 1}`, x, 56);

    ctx.fillStyle = INK;
    ctx.font = "600 38px Georgia, serif";
    wrap(ctx, t.label, x, 116, w - 130, 44, 2);

    ctx.fillStyle = accent;
    ctx.font = "600 64px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(t.intensity)), x + w, 124);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, 268, w, 18);
    ctx.fillStyle = accent;
    ctx.fillRect(x, 268, w * Math.max(0, Math.min(1, t.intensity / 100)), 18);

    ctx.fillStyle = ACCENT.dim;
    ctx.font = "500 24px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(t.drift > 0.5 ? "WORSENING" : t.drift < -0.5 ? "EASING" : "HOLDING", x, 340);
  }
  return texture(el);
}

/** The left projector screen: the crisis domains, ranked by heat. */
function domainTexture(heat: Partial<Record<CrisisTag, number>>): THREE.CanvasTexture {
  const W = 1024;
  const H = 520;
  const [el, ctx] = canvas(W, H);

  ctx.strokeStyle = "rgba(120,160,195,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  ctx.fillStyle = "rgba(175,205,230,0.85)";
  ctx.font = "600 26px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText("DOMAIN WATCH", 40, 58);

  // Two columns, because eleven rows down a 2:1 panel would be a thin stripe.
  const ranked = HEAT_DOMAINS.map((tag) => ({ tag, heat: heat[tag] ?? 0 })).sort((a, b) => b.heat - a.heat);
  const perColumn = Math.ceil(ranked.length / 2);
  ranked.forEach((d, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const x = 40 + col * (W / 2 - 20);
    const y = 106 + row * 68;
    const hot = d.heat > 55;
    const warm = d.heat > 25;

    ctx.fillStyle = hot ? ACCENT.hot : warm ? ACCENT.warm : "rgba(160,195,222,0.8)";
    ctx.font = "500 24px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(DOMAIN_NAME[d.tag].replace(/^the /, "").toUpperCase(), x, y);
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(d.heat)), x + W / 2 - 80, y);

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(140,180,210,0.18)";
    ctx.fillRect(x, y + 12, W / 2 - 80, 12);
    ctx.fillStyle = hot ? ACCENT.hot : warm ? ACCENT.warm : "#5c85a5";
    ctx.fillRect(x, y + 12, Math.max(3, (W / 2 - 80) * (d.heat / 100)), 12);
  });
  return texture(el);
}

/** The right projector screen: the watch summary, in the room's own language. */
function watchTexture(s: GameState | null): THREE.CanvasTexture {
  const W = 1024;
  const H = 520;
  const [el, ctx] = canvas(W, H);

  ctx.strokeStyle = "rgba(120,160,195,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  ctx.fillStyle = "rgba(175,205,230,0.85)";
  ctx.font = "600 26px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText("WATCH FLOOR", 40, 58);

  if (!s) return texture(el);

  const running = s.threads.length;
  const worst = [...s.threads].sort((a, b) => b.intensity - a.intensity)[0] ?? null;
  const hottest = HEAT_DOMAINS.map((tag) => ({ tag, heat: s.heat[tag] ?? 0 })).sort(
    (a, b) => b.heat - a.heat,
  )[0];

  const lines: [string, string, string][] = [
    ["SITUATIONS RUNNING", String(running), running > 2 ? ACCENT.hot : running ? ACCENT.warm : ACCENT.cool],
    [
      "WORST",
      worst ? String(Math.round(worst.intensity)) : "—",
      worst ? accentFor(worst.intensity) : ACCENT.cool,
    ],
    [
      "HOTTEST DOMAIN",
      hottest && hottest.heat > 0 ? DOMAIN_NAME[hottest.tag].replace(/^the /, "").toUpperCase() : "—",
      hottest && hottest.heat > 55 ? ACCENT.hot : hottest && hottest.heat > 25 ? ACCENT.warm : ACCENT.cool,
    ],
    ["UNREST", String(Math.round(s.nation.unrest)), s.nation.unrest > 55 ? ACCENT.hot : ACCENT.cool],
  ];

  lines.forEach(([label, value, colour], i) => {
    const y = 140 + i * 92;
    ctx.fillStyle = ACCENT.dim;
    ctx.font = "500 24px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(label, 40, y);
    ctx.fillStyle = colour;
    ctx.font = "600 48px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(value, W - 40, y + 6);
  });

  if (worst) {
    ctx.fillStyle = INK;
    ctx.font = "500 26px Georgia, serif";
    ctx.textAlign = "left";
    wrap(ctx, worst.label, 40, H - 46, W - 80, 32, 1);
  }
  return texture(el);
}

export interface SitroomScreens {
  group: THREE.Group;
  update: (state: GameState | null) => void;
}

/** Hangs the three live panels on the model and returns their updater. */
export function buildSitroomScreens(model: THREE.Object3D): SitroomScreens | null {
  const room = measureSitroom(model);
  if (!room) return null;

  const group = new THREE.Group();
  group.name = "sitroom-screens";

  const panel = (w: number, h: number, tex: THREE.CanvasTexture) => {
    const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    group.add(mesh);
    return { mesh, material };
  };

  // The wide display on the wall the Situation Table faces.
  const wide = panel(WIDE.width, WIDE.height, wideTexture([]));
  wide.mesh.position.set(room.centre.x + WIDE.centreX, room.floorY + WIDE.centreY, room.maxZ - PROUD);
  wide.mesh.rotation.y = Math.PI;

  // The two projector screens on the wall the Watch Floor faces.
  const left = panel(SIDE.width, SIDE.height, domainTexture({}));
  left.mesh.position.set(room.maxX - 0.45 - PROUD, room.floorY + SIDE.centreY, SIDE.zs[0]);
  left.mesh.rotation.y = -Math.PI / 2;

  const right = panel(SIDE.width, SIDE.height, watchTexture(null));
  right.mesh.position.set(room.maxX - 0.45 - PROUD, room.floorY + SIDE.centreY, SIDE.zs[1]);
  right.mesh.rotation.y = -Math.PI / 2;

  // A little light off each panel, so the screens light the room rather than
  // floating in it. Cheap: three point lights for the whole readout.
  // A little light off each panel, so the screens light the room rather than
  // floating in it. Each sits half a metre out along the panel's own normal,
  // which is what `getWorldDirection` gives once the mesh has been turned.
  for (const m of [wide.mesh, left.mesh, right.mesh]) {
    const glow = new THREE.PointLight(0x8fb6d8, 2.2, 5, 2);
    const out = new THREE.Vector3();
    m.updateMatrixWorld(true);
    m.getWorldDirection(out);
    glow.position.copy(m.position).addScaledVector(out, 0.5);
    group.add(glow);
  }

  const swap = (target: { material: THREE.MeshBasicMaterial }, tex: THREE.CanvasTexture) => {
    target.material.map?.dispose();
    target.material.map = tex;
    target.material.needsUpdate = true;
  };

  return {
    group,
    update: (state) => {
      swap(wide, wideTexture(state?.threads ?? []));
      swap(left, domainTexture(state?.heat ?? {}));
      swap(right, watchTexture(state));
    },
  };
}
