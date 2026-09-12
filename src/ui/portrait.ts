import * as THREE from "three";
import { buildCharacter } from "../world/character.ts";
import type { Character } from "../world/character.ts";

/**
 * Faces for the UI.
 *
 * The cast already exists as code — `buildCharacter` turns a name into a
 * sculpted head with a painted face. The panels, though, only ever had a
 * string to show. This renders that same character to a canvas once, off the
 * main scene, and hands the UI a picture of the person who is talking.
 *
 * There is deliberately no second art path here. A portrait is the same
 * geometry, the same texture and the same seed as the figure standing in the
 * Cabinet Room, so a secretary cannot look like one person in the room and
 * somebody else in the meeting.
 */

/** How someone is holding themselves, which the portrait shows. */
export type Mood =
  | "neutral"
  | "warm"
  | "concerned"
  | "hostile"
  | "tired"
  | "amused"
  | "guarded";

interface MoodShape {
  /** Head pitch, radians. Negative looks down. */
  pitch: number;
  /** Head yaw, radians. */
  yaw: number;
  /** Head roll, radians. */
  roll: number;
  /** How far the upper lids are dropped, radians. */
  lid: number;
  /** Brow weight multiplier, applied to the painted brow via the sculpt. */
  brow: number;
  /** Neck lean, radians. */
  lean: number;
}

/**
 * A mood is a pose, not a different face. Everything here is a rotation or a
 * lid angle on the character that was already built, so the same person can
 * be warm in one beat and hostile in the next without being rebuilt.
 */
const MOODS: Record<Mood, MoodShape> = {
  neutral: { pitch: 0, yaw: 0, roll: 0, lid: 0, brow: 1, lean: 0 },
  warm: { pitch: 0.04, yaw: 0.06, roll: 0.03, lid: -0.06, brow: 1, lean: 0.02 },
  concerned: { pitch: -0.05, yaw: -0.04, roll: -0.05, lid: 0.1, brow: 1.15, lean: 0.04 },
  hostile: { pitch: -0.02, yaw: 0.02, roll: 0, lid: 0.16, brow: 1.35, lean: -0.03 },
  tired: { pitch: -0.09, yaw: -0.03, roll: -0.07, lid: 0.24, brow: 0.9, lean: 0.06 },
  amused: { pitch: 0.05, yaw: 0.09, roll: 0.06, lid: -0.1, brow: 1.05, lean: 0.02 },
  guarded: { pitch: -0.03, yaw: -0.08, roll: 0, lid: 0.08, brow: 1.2, lean: -0.02 },
};

/** The size a portrait is rendered at, in device pixels. */
const PORTRAIT_PX = 256;

/**
 * One renderer for the whole UI. Creating a WebGL context per portrait would
 * exhaust the browser's context limit after a dozen people, so every portrait
 * is drawn through this one and then cached as an image.
 */
class PortraitRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private current: Character | null = null;
  /** Set once a context has failed, so we stop trying and fall back to initials. */
  private broken = false;

  private ensure(): boolean {
    if (this.broken) return false;
    if (this.renderer) return true;
    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(PORTRAIT_PX, PORTRAIT_PX, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      // A head-and-shoulders framing: a long lens, so the face is not
      // distorted the way a wide one would distort it up close.
      const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 12);
      camera.position.set(0, 1.62, 1.05);
      camera.lookAt(0, 1.6, 0);

      // Three-point lighting, matching the warm interior the rooms use. The
      // lights are added to the scene and never touched again, so they are
      // locals rather than fields.
      const key = new THREE.DirectionalLight(0xfff2dd, 2.1);
      key.position.set(0.7, 1.9, 1.5);
      const fill = new THREE.DirectionalLight(0xbfd0e8, 0.7);
      fill.position.set(-1.3, 1.5, 0.9);
      const rim = new THREE.DirectionalLight(0xffd9a8, 1.1);
      rim.position.set(-0.4, 1.8, -1.6);
      scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.42));

      this.renderer = renderer;
      this.scene = scene;
      this.camera = camera;
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  /**
   * Draws one person and returns the canvas. The character is disposed
   * immediately afterwards: a portrait is a picture, not a live model, and
   * holding a hundred of them would cost more memory than the whole game.
   */
  render(seed: string, age: number | undefined, mood: Mood, dress: string): HTMLCanvasElement | null {
    if (!this.ensure()) return null;
    const renderer = this.renderer!;
    const scene = this.scene!;
    const camera = this.camera!;

    if (this.current) {
      scene.remove(this.current.group);
      disposeCharacter(this.current);
      this.current = null;
    }

    const character = buildCharacter({
      seed,
      age,
      dress: dress as "suit" | "smart" | "casual" | "robe",
      pose: "stand",
    });
    this.current = character;
    scene.add(character.group);

    applyMood(character, MOODS[mood]);

    // Frame the head: the camera sits at eye height and the head is what it
    // is looking at, so a tall secretary and a short one are both centred.
    const headY = character.group.position.y + character.height * 0.93;
    camera.position.set(0, headY, 1.02);
    camera.lookAt(0, headY - 0.015, 0);

    renderer.render(scene, camera);
    return renderer.domElement;
  }

  dispose(): void {
    if (this.current) {
      this.scene?.remove(this.current.group);
      disposeCharacter(this.current);
      this.current = null;
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}

/** Frees the geometry and textures a character owns. */
function disposeCharacter(c: Character): void {
  c.group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      if (!m) continue;
      const std = m as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      m.dispose();
    }
  });
}

/**
 * Puts a mood on a built character. Every value is a rotation on a joint that
 * already exists, so this is cheap and cannot desynchronise from the model.
 */
function applyMood(c: Character, mood: MoodShape): void {
  c.head.rotation.x += mood.pitch;
  c.head.rotation.y += mood.yaw;
  c.head.rotation.z += mood.roll;
  c.neck.rotation.x += mood.lean;
  c.neck.rotation.y += mood.yaw * 0.4;
  for (const lid of c.eyelids) lid.rotation.x += mood.lid;
  // A guarded or hostile look pulls the shoulders up a little.
  c.chest.rotation.x += mood.lean * 0.5;
}

const renderer = new PortraitRenderer();

/** A rendered portrait, cached by everything that changes how it looks. */
const cache = new Map<string, string>();

function cacheKey(seed: string, age: number | undefined, mood: Mood, dress: string): string {
  return `${seed}|${age ?? ""}|${mood}|${dress}`;
}

/**
 * A data URL for a person's face, or null if WebGL is unavailable. Cached, so
 * the same secretary in the same mood is only ever drawn once.
 */
export function portraitUrl(
  seed: string,
  opts: { age?: number; mood?: Mood; dress?: string } = {},
): string | null {
  const mood = opts.mood ?? "neutral";
  const dress = opts.dress ?? "suit";
  const key = cacheKey(seed, opts.age, mood, dress);
  const hit = cache.get(key);
  if (hit !== undefined) return hit || null;

  const canvas = renderer.render(seed, opts.age, mood, dress);
  if (!canvas) {
    cache.set(key, "");
    return null;
  }
  // A copy, because the renderer's canvas is reused for the next portrait.
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")!.drawImage(canvas, 0, 0);
  const url = copy.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

/**
 * A portrait as an element, with initials behind it. If WebGL is missing the
 * initials are what shows, so the panel still reads as a person rather than a
 * broken image.
 */
export function portrait(
  seed: string,
  opts: { age?: number; mood?: Mood; dress?: string; size?: number; name?: string } = {},
): HTMLElement {
  const size = opts.size ?? 64;
  const url = portraitUrl(seed, opts);
  const wrap = document.createElement("div");
  wrap.className = "portrait";
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;

  const initials = document.createElement("span");
  initials.className = "portrait-initials";
  initials.textContent = initialsOf(opts.name ?? seed);
  wrap.append(initials);

  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = opts.name ?? "";
    img.draggable = false;
    wrap.append(img);
  }
  return wrap;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Warms the cache for people the player is about to meet. */
export function prewarmPortraits(
  people: { seed: string; age?: number; dress?: string }[],
  moods: Mood[] = ["neutral"],
): void {
  for (const person of people) {
    for (const mood of moods) {
      portraitUrl(person.seed, { age: person.age, mood, dress: person.dress });
    }
  }
}

/** Frees the renderer. Called when the game tears down. */
export function disposePortraits(): void {
  renderer.dispose();
  cache.clear();
}
