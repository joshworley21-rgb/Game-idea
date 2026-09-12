import * as THREE from "three";
import { PostFX } from "./postfx.ts";
import type { Grade } from "./postfx.ts";

/**
 * Owns the post-processing chain and the frame loop.
 *
 * The chain is dropped wholesale if frames get too expensive, which is the
 * mobile safety net: a device that cannot afford GTAO + bloom + SMAA falls
 * back to a plain forward render rather than stuttering forever.
 */
export class RenderLoop {
  private postfx: PostFX | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  /** A rolling frame-time sample, used to drop the extra passes if needed. */
  private frameCost = 0;
  private frameSamples = 0;
  private grade: Grade | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    /** Everything that must tick before the frame is drawn. */
    private onFrame: (dt: number) => void,
  ) {}

  get active(): boolean {
    return this.postfx !== null;
  }

  /** Builds the chain. Skipped entirely when the caller asks for a plain render. */
  build(grade: Grade): void {
    if (this.postfx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.postfx = new PostFX(this.renderer, this.scene, this.camera, w, h);
    this.grade = grade;
    this.postfx.setGrade(grade);
  }

  /** Retunes the colour grade, for when the president changes rooms. */
  setGrade(grade: Grade): void {
    this.grade = grade;
    this.postfx?.setGrade(grade);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.postfx?.setSize(w, h);
  }

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.onFrame(dt);

      if (this.postfx) {
        const t0 = performance.now();
        this.postfx.render();
        this.measure(performance.now() - t0);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  private measure(ms: number): void {
    if (!this.postfx) return;
    this.frameSamples += 1;
    if (this.frameSamples < 8) return;
    if (ms > 120) {
      this.drop();
      return;
    }
    if (this.frameSamples > 32) return;
    this.frameCost += ms;
    if (this.frameSamples === 32 && this.frameCost / 24 > 22) this.drop();
  }

  /** Tears the chain down and falls back to a plain forward render. */
  private drop(): void {
    this.postfx?.dispose();
    this.postfx = null;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
