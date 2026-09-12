import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const fmt = (v: number): string => v.toFixed(2);

/**
 * Developer free-roam camera.
 *
 * Enabled with `?freecam`, or toggled from the HUD. One-finger drag orbits,
 * two-finger pinch/pan moves, and the wheel zooms. The current camera position
 * and orbit target are shown on screen and can be copied as a JSON pose for
 * pasting into office.ts.
 */
export class Freecam {
  readonly controls: OrbitControls;
  private panel: HTMLDivElement;
  private posLine: HTMLDivElement;
  private targetLine: HTMLDivElement;
  private jsonLine: HTMLDivElement;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLCanvasElement) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI * 0.96;
    this.controls.target.set(0, 1.2, 0);

    this.panel = document.createElement("div");
    this.panel.id = "freecam-panel";
    this.panel.style.cssText = [
      "position:fixed",
      "top:12px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:9999",
      "padding:10px 12px",
      "border-radius:10px",
      "background:rgba(14,16,22,0.92)",
      "color:#e9e4d8",
      "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
      "border:1px solid rgba(255,255,255,0.12)",
      "box-shadow:0 6px 24px rgba(0,0,0,0.5)",
      "pointer-events:auto",
      "max-width:calc(100vw - 16px)",
    ].join(";");

    this.posLine = document.createElement("div");
    this.targetLine = document.createElement("div");
    this.jsonLine = document.createElement("div");
    this.jsonLine.style.marginTop = "6px";
    this.jsonLine.style.color = "#c9a961";
    this.jsonLine.style.whiteSpace = "pre-wrap";
    this.jsonLine.style.wordBreak = "break-all";
    this.jsonLine.textContent = "Move to frame the shot, then tap Copy pose.";

    const copy = document.createElement("button");
    copy.textContent = "Copy pose";
    copy.style.cssText = [
      "margin-top:8px",
      "padding:7px 10px",
      "border-radius:8px",
      "border:1px solid rgba(201,169,97,0.6)",
      "background:rgba(201,169,97,0.14)",
      "color:#c9a961",
      "font:600 12px/1 inherit",
      "cursor:pointer",
    ].join(";");
    copy.addEventListener("click", () => this.copyPose(copy));

    this.panel.append(this.posLine, this.targetLine, this.jsonLine, copy);
    document.body.append(this.panel);
  }

  setTarget(target: THREE.Vector3): void {
    this.controls.target.copy(target);
  }

  update(): void {
    this.controls.update();
    const p = this.controls.object.position;
    const t = this.controls.target;
    this.posLine.textContent = `position: ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`;
    this.targetLine.textContent = `target:   ${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)}`;
  }

  private copyPose(button: HTMLButtonElement): void {
    const p = this.controls.object.position;
    const t = this.controls.target;
    const json = `{ "position": [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}], "target": [${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}] }`;
    this.jsonLine.textContent = json;
    void navigator.clipboard?.writeText(json);
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy pose";
    }, 1200);
  }

  dispose(): void {
    this.controls.dispose();
    this.panel.remove();
  }
}
