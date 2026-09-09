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
  composer: { render: () => void; setSize: (w: number, h: number) => void; dispose: () => void } | null;
  gtao: unknown;
  bloom: unknown;
  current: { id: RoomId };
  resize: () => void;
  enterRoom: (id: RoomId, arrivingFrom?: RoomId) => void;
  dropComposer: () => void;
}

// A per-instance handle to the PostFX, stored on a WeakMap so we never leak.
const postfxByWorld = new WeakMap<object, PostFX>();

let patched = false;

/** Applies the upgrade to the World prototype. Idempotent. */
export function installRendererUpgrade(): void {
  if (patched) return;
  patched = true;

  void import("./scene.ts").then(({ World }) => {
    const proto = World.prototype as unknown as WorldInternals & {
      buildComposer: () => void;
    };

    // --- Replace buildComposer with the PostFX chain.
    proto.buildComposer = function (this: WorldInternals) {
      if (this.composer) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const postfx = new PostFX(this.renderer, this.scene, this.camera, w, h);
      postfxByWorld.set(this, postfx);

      // The World's render loop calls this.composer.render(). We hand it a
      // wrapper whose render() advances the PostFX grain and renders the
      // chain — no circular reference, because the wrapper calls postfx.render()
      // which internally calls the real composer.render().
      const realComposer = postfx.composer;
      this.composer = {
        render: () => postfx.render(),
        setSize: (ww: number, hh: number) => realComposer.setSize(ww, hh),
        dispose: () => realComposer.dispose(),
      };
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
  });
}

// Auto-install on import. This module is imported once from main.ts.
installRendererUpgrade();
