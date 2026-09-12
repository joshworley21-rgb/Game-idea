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
