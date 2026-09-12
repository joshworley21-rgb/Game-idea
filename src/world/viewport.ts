import * as THREE from "three";
import type { RenderLoop } from "./renderLoop.ts";

/**
 * The size the renderer should draw at.
 *
 * `window.innerWidth`/`innerHeight` are the wrong source on Android: with
 * `viewport-fit=cover` the window excludes the safe-area insets, so it is
 * smaller than the box the canvas actually occupies. That mismatch is what
 * letterboxes the image. The canvas rect is the truth.
 */
export interface Viewport {
  width: number;
  height: number;
}

/** Measures the canvas box in CSS pixels, clamped to at least 1x1. */
export function measureViewport(canvas: HTMLCanvasElement): Viewport {
  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

/**
 * Sizes the renderer, the post chain and the camera from one measurement.
 *
 * `setSize` is called with `updateStyle` left at its default of true, so the
 * canvas CSS box is written to match the drawing buffer. Passing false here
 * left the canvas at its default 300x150 CSS size while the buffer was
 * resized, and the resulting aspect mismatch is what drew the black bars.
 */
export function applyViewport(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  loop: RenderLoop | null,
): Viewport {
  const { width, height } = measureViewport(canvas);

  // Re-applied every time: the ratio changes when the window moves between
  // displays, and setSize alone would leave the drawing buffer stale.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height);

  loop?.resize(width, height);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  return { width, height };
}
