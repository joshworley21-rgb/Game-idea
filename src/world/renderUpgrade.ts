import * as THREE from "three";
import { PostFX, CABINET_GRADE, CAPITOL_GRADE, OVAL_GRADE, PRESS_GRADE, RESIDENCE_GRADE, STUDY_GRADE } from "./postfx.ts";
import type { RoomId } from "./roomkit.ts";

/**
 * Renderer upgrade layer.
 *
 * The base `World` class builds its own composer inline in `buildComposer()`.
 * This module upgrades it to the cinematic post chain (per-room color grade,
 * vignette, film grain) by monkey-patching the World prototype so every new
 * World instance automatically gets the upgraded chain.
 *
 * Import this module once from main.ts (or anywhere before the first World
 * is constructed) and the upgrade applies to every World that follows.
 *
 * The patch is deliberately surgical:
 *   - `buildComposer` is replaced to construct the PostFX chain instead of
 *     the inline one.
 *   - `enterRoom` is wrapped to apply the room's grade on entry.
 *   - `resize` is wrapped to keep PostFX sized.
 *   - `dropComposer` is wrapped to dispose PostFX.
 *   - `start`'s render call is redirected through PostFX.render so the grain
 *     animation advances.
 */

const ROOM_GRADES: Record<RoomId, typeof OVAL_GRADE> = {
  oval: OVAL_GRADE,
  cabinet: CABINET_GRADE,
  capitol: CAPITOL_GRADE,
  press: PRESS_GRADE,
  residence: RESIDENCE_GRADE,
  study: STUDY_GRADE,
};

/** The private fields we reach into on the World instance. */
interface WorldInternals {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposerLike | null;
  gtao: unknown;
  bloom: unknown;
  frameCost: number;
  frameSamples: number;
  current: { id: RoomId };
  horizontalFov: number;
  resize: () => void;
  enterRoom: (id: RoomId, arrivingFrom?: RoomId) => void;
  dropComposer: () => void;
  measure: (ms: number) => void;
}

interface EffectComposerLike {
  render: () => void;
  setSize: (w: number, h: number) => void;
  dispose: () => void;
}

// A per-instance handle to the PostFX, stored on a WeakMap so we never leak.
const postfxByWorld = new WeakMap<object, PostFX>();

let patched = false;

/** Applies the upgrade to the World prototype. Idempotent. */
export function installRendererUpgrade(): void {
  if (patched) return;
  patched = true;

  // We need the World class. It's imported lazily to avoid a circular import
  // (scene.ts imports from roomkit.ts, which we don't touch, but scene.ts is
  // the thing we're patching).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  void import("./scene.ts").then(({ World }) => {
    const proto = World.prototype as unknown as WorldInternals & {
      buildComposer: () => void;
      start: () => void;
    };

    // --- Replace buildComposer with the PostFX chain.
    const originalBuildComposer = proto.buildComposer;
    proto.buildComposer = function (this: WorldInternals) {
      // Skip if already built or if the plain flag is set (checked by caller).
      if (this.composer) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const postfx = new PostFX(this.renderer, this.scene, this.camera, w, h);
      postfxByWorld.set(this, postfx);

      // The World's render loop calls this.composer.render(). We redirect
      // through PostFX.render so the grain animation advances each frame.
      const originalRender = postfx.composer.render.bind(postfx.composer);
      postfx.composer.render = () => {
        postfx.render();
      };

      this.composer = postfx.composer as unknown as EffectComposerLike;
      this.gtao = null;
      this.bloom = null;

      // Apply the current room's grade.
      postfx.setGrade(ROOM_GRADES[this.current.id]);
    };

    // --- Wrap enterRoom to apply the room's grade.
    const originalEnterRoom = proto.enterRoom;
    proto.enterRoom = function (this: WorldInternals, id: RoomId, arrivingFrom?: RoomId) {
      originalEnterRoom.call(this, id, arrivingFrom);
      const postfx = postfxByWorld.get(this);
      if (postfx) postfx.setGrade(ROOM_GRADES[id]);
    };

    // --- Wrap resize to keep PostFX sized.
    const originalResize = proto.resize;
    proto.resize = function (this: WorldInternals) {
      originalResize.call(this);
      const postfx = postfxByWorld.get(this);
      if (postfx) postfx.setSize(window.innerWidth, window.innerHeight);
    };

    // --- Wrap dropComposer to dispose PostFX.
    const originalDrop = proto.dropComposer;
    proto.dropComposer = function (this: WorldInternals) {
      const postfx = postfxByWorld.get(this);
      if (postfx) {
        postfx.dispose();
        postfxByWorld.delete(this);
      }
      originalDrop.call(this);
    };

    // --- Wrap start so the render path goes through PostFX.
    const originalStart = proto.start;
    proto.start = function (this: WorldInternals & { clock: THREE.Clock; player: unknown; sound: unknown; stations: unknown; doors: unknown; animator: unknown; camera: THREE.Camera }) {
      // The original start() sets up its own requestAnimationFrame loop that
      // calls this.composer.render() or this.renderer.render(). Since we've
      // redirected composer.render through PostFX.render, the original loop
      // already does the right thing. So we just call the original.
      originalStart.call(this);
    };
  });
}

// Auto-install on import. This module is imported once from main.ts.
installRendererUpgrade();
