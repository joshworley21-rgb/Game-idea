import * as THREE from "three";
import type { World } from "./scene.ts";
import type { RoomId } from "./roomkit.ts";
import { PostFX, CABINET_GRADE, CAPITOL_GRADE, OVAL_GRADE, PRESS_GRADE, RESIDENCE_GRADE, STUDY_GRADE } from "./postfx.ts";

/**
 * Renderer upgrade layer.
 *
 * The base `World` class builds its own composer inline. This module upgrades
 * it to the cinematic post chain (color grade per room, vignette, film grain)
 * by swapping the composer construction and the per-room grade application.
 *
 * It is applied from `main.ts` after the World is constructed, before the
 * first frame renders, so there is no visual pop.
 */

const ROOM_GRADES: Record<RoomId, typeof OVAL_GRADE> = {
  oval: OVAL_GRADE,
  cabinet: CABINET_GRADE,
  capitol: CAPITOL_GRADE,
  press: PRESS_GRADE,
  residence: RESIDENCE_GRADE,
  study: STUDY_GRADE,
};

/**
 * Replaces the World's inline composer with the upgraded PostFX chain.
 * Returns the PostFX instance so the caller can keep a handle.
 */
export function upgradeRenderer(world: World): PostFX | null {
  // The World already built its own composer in its constructor. We need to
  // tear that down and replace it. Since the World's composer fields are
  // private, we reach in through the type system — this is a deliberate
  // integration seam, not a hack: the alternative is rewriting scene.ts,
  // which is a much larger diff for the same result.
  const w = world as unknown as {
    composer: unknown;
    gtao: unknown;
    bloom: unknown;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    enterRoom: (id: RoomId) => void;
    current: { id: RoomId };
    resize: () => void;
    measure: (ms: number) => void;
    dropComposer: () => void;
  };

  // If the world already dropped its composer (weak device), don't re-add it.
  if (!w.composer) return null;

  // Dispose the old chain.
  (w.composer as { dispose?: () => void })?.dispose?.();

  const width = window.innerWidth;
  const height = window.innerHeight;
  const postfx = new PostFX(w.renderer, w.scene, w.camera, width, height);

  // Replace the World's internals with the upgraded chain.
  w.composer = postfx.composer;
  w.gtao = null; // GTAO is inside PostFX now
  w.bloom = null;

  // Apply the current room's grade.
  postfx.setGrade(ROOM_GRADES[w.current.id]);

  // Patch resize to keep the PostFX sized.
  const originalResize = w.resize;
  w.resize = () => {
    originalResize();
    postfx.setSize(window.innerWidth, window.innerHeight);
  };

  // Patch enterRoom to apply the room's grade on entry.
  const originalEnter = w.enterRoom;
  w.enterRoom = (id: RoomId) => {
    originalEnter(id);
    postfx.setGrade(ROOM_GRADES[id]);
  };

  // Patch the render loop to use PostFX.render (which advances grain time).
  // The World's start() loop calls this.composer.render() directly, so we
  // need to intercept that. We do it by wrapping the composer object.
  const originalRender = postfx.composer.render.bind(postfx.composer);
  postfx.composer.render = () => {
    postfx.render();
  };

  // Patch measure/dropComposer so the watchdog still works.
  const originalDrop = w.dropComposer;
  w.dropComposer = () => {
    originalDrop();
    postfx.dispose();
  };

  return postfx;
}
