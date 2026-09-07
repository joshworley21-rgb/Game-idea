import * as THREE from "three";

/**
 * Procedural surface textures.
 *
 * Every material in the game was a flat colour, which is what made the rooms
 * read as cardboard however good the lighting was. These generate a colour map
 * and a matching normal map on a canvas — grain in the wood, weave in the
 * carpet, a float in the plaster — so surfaces respond to light instead of
 * sitting there. Nothing is downloaded; it is all a few hundred lines of
 * canvas work, cached by key so a repeated material costs nothing.
 */

export interface Surface {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

const cache = new Map<string, Surface>();

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a torus, so the result tiles. */
function tiledNoise(size: number, grid: number, seed: number): (x: number, y: number) => number {
  const rnd = rng(seed);
  const table = new Float32Array(grid * grid);
  for (let i = 0; i < table.length; i++) table[i] = rnd();
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = (x / size) * grid;
    const gy = (y / size) * grid;
    const x0 = Math.floor(gx) % grid;
    const y0 = Math.floor(gy) % grid;
    const x1 = (x0 + 1) % grid;
    const y1 = (y0 + 1) % grid;
    const tx = smooth(gx - Math.floor(gx));
    const ty = smooth(gy - Math.floor(gy));
    const a = table[y0 * grid + x0];
    const b = table[y0 * grid + x1];
    const c = table[y1 * grid + x0];
    const d = table[y1 * grid + x1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

/** Several octaves of it, which is what makes noise look like a material. */
function fbm(size: number, seed: number, octaves = 4, base = 4): (x: number, y: number) => number {
  const layers: { noise: (x: number, y: number) => number; amp: number }[] = [];
  for (let i = 0; i < octaves; i++) {
    layers.push({ noise: tiledNoise(size, base * 2 ** i, seed + i * 7919), amp: 1 / 2 ** i });
  }
  const total = layers.reduce((s, l) => s + l.amp, 0);
  return (x, y) => layers.reduce((s, l) => s + l.noise(x, y) * l.amp, 0) / total;
}

function canvasOf(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext("2d")!];
}

function finish(canvas: HTMLCanvasElement, repeat: number, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Turns a height field into a normal map by central differences. This is what
 * actually makes a surface catch light — the colour map alone just looks like
 * a photograph glued to a plane.
 */
function normalFrom(
  size: number,
  height: (x: number, y: number) => number,
  strength: number,
  repeat: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = canvasOf(size);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height((x - 1 + size) % size, y);
      const r = height((x + 1) % size, y);
      const u = height(x, (y - 1 + size) % size);
      const d = height(x, (y + 1) % size);
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      image.data[i] = (nx * 0.5 + 0.5) * 255;
      image.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      image.data[i + 2] = (nz / len) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return finish(canvas, repeat, false);
}

function greyMap(
  size: number,
  value: (x: number, y: number) => number,
  repeat: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = canvasOf(size);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, value(x, y))) * 255;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return finish(canvas, repeat, false);
}

// ------------------------------------------------------------------- woods

/** Boards with grain, growth rings and a seam every few planks. */
export function wood(colour: number, repeat = 3, seed = 1, planks = 5): Surface {
  const key = `wood:${colour}:${repeat}:${seed}:${planks}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const warp = fbm(size, seed, 4, 3);
  const fine = fbm(size, seed + 11, 3, 24);

  const height = (x: number, y: number): number => {
    // Rings, distorted by low-frequency noise, plus the gaps between planks.
    const board = Math.floor((y / size) * planks);
    const offset = ((board * 137) % 100) / 100;
    // Wide, soft rings: dense high-contrast stripes read as zebrano, not oak.
    const rings = Math.sin((x / size + offset) * 7.5 + warp(x, y) * 4.5) * 0.5 + 0.5;
    const grain = rings ** 1.6 * 0.55 + fine(x, y) * 0.45;
    const seam = Math.abs(((y / size) * planks) % 1 - 0.5) > 0.485 ? 0 : 1;
    return grain * seam;
  };

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const dark = base.clone().multiplyScalar(0.84);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.07);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = height(x, y);
      c.copy(dark).lerp(light, h);
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 0.9, repeat),
    // three multiplies this into `roughness`, so it must sit near 1 and only
    // vary: a map centred on 0.4 would make every wooden surface a mirror.
    roughnessMap: greyMap(size, (x, y) => 0.84 + height(x, y) * 0.16, repeat),
  };
  cache.set(key, surface);
  return surface;
}

// ------------------------------------------------------------------ fabric

/** Carpet: dense fibre noise, no shine, a deep normal. */
export function carpet(colour: number, repeat = 8, seed = 2): Surface {
  const key = `carpet:${colour}:${repeat}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const tuft = fbm(size, seed, 3, 48);
  const patch = fbm(size, seed + 5, 3, 6);
  const height = (x: number, y: number) => tuft(x, y) * 0.8 + patch(x, y) * 0.2;

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const dark = base.clone().multiplyScalar(0.74);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      c.copy(dark).lerp(light, height(x, y));
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 3.4, repeat),
  };
  cache.set(key, surface);
  return surface;
}

/** Woven cloth for upholstery and drapes: a visible warp and weft. */
export function weave(colour: number, repeat = 6, seed = 3): Surface {
  const key = `weave:${colour}:${repeat}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const slub = fbm(size, seed, 3, 10);
  const pitch = 26;
  const height = (x: number, y: number) => {
    const warpT = Math.sin((x / size) * Math.PI * 2 * pitch) * 0.5 + 0.5;
    const weftT = Math.sin((y / size) * Math.PI * 2 * pitch) * 0.5 + 0.5;
    // Over-under, so it reads as a weave rather than a grid.
    const over = ((Math.floor((x / size) * pitch) + Math.floor((y / size) * pitch)) % 2) === 0;
    return (over ? warpT : weftT) * 0.72 + slub(x, y) * 0.28;
  };

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const dark = base.clone().multiplyScalar(0.78);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.12);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      c.copy(dark).lerp(light, height(x, y));
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 2.6, repeat),
  };
  cache.set(key, surface);
  return surface;
}

// ------------------------------------------------------------------- walls

/** Plaster: almost flat, but the "almost" is the whole point. */
export function plaster(colour: number, repeat = 3, seed = 4): Surface {
  const key = `plaster:${colour}:${repeat}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const broad = fbm(size, seed, 4, 3);
  const fine = fbm(size, seed + 3, 2, 40);
  const height = (x: number, y: number) => broad(x, y) * 0.8 + fine(x, y) * 0.2;

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const dark = base.clone().multiplyScalar(0.94);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.05);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      c.copy(dark).lerp(light, height(x, y));
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 1.1, repeat),
  };
  cache.set(key, surface);
  return surface;
}

/** Marble, for mantelpieces: veins through a pale stone. */
export function marble(colour: number, repeat = 2, seed = 5): Surface {
  const key = `marble:${colour}:${repeat}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 512;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const warp = fbm(size, seed, 5, 3);
  const height = (x: number, y: number) => {
    const t = (x + y) / (size * 2) + warp(x, y) * 0.55;
    return Math.abs(Math.sin(t * Math.PI * 9)) ** 0.4;
  };

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const vein = base.clone().multiplyScalar(0.72);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      c.copy(vein).lerp(base, height(x, y));
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 0.5, repeat),
    roughnessMap: greyMap(size, (x, y) => 0.78 + (1 - height(x, y)) * 0.22, repeat),
  };
  cache.set(key, surface);
  return surface;
}

/** Wool suiting, for the cast: a fine twill that catches the key light. */
export function suiting(colour: number, repeat = 4, seed = 6): Surface {
  const key = `suiting:${colour}:${repeat}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 256;
  const [canvas, ctx] = canvasOf(size);
  const base = new THREE.Color(colour);
  const fleck = fbm(size, seed, 2, 46);
  const height = (x: number, y: number) => {
    const twill = Math.sin(((x + y) / size) * Math.PI * 2 * 30) * 0.5 + 0.5;
    return twill * 0.6 + fleck(x, y) * 0.4;
  };

  const image = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const dark = base.clone().multiplyScalar(0.86);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      c.copy(dark).lerp(light, height(x, y));
      const i = (y * size + x) * 4;
      image.data[i] = c.r * 255;
      image.data[i + 1] = c.g * 255;
      image.data[i + 2] = c.b * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const surface: Surface = {
    map: finish(canvas, repeat, true),
    normalMap: normalFrom(size, height, 1.4, repeat),
  };
  cache.set(key, surface);
  return surface;
}

/** Frees every cached texture, for a full teardown. */
export function disposeTextures(): void {
  for (const s of cache.values()) {
    s.map.dispose();
    s.normalMap.dispose();
    s.roughnessMap?.dispose();
  }
  cache.clear();
}
