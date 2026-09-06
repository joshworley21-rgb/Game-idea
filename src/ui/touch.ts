import { el } from "./dom.ts";

const RADIUS = 54;

/**
 * Thumb stick for walking on a touch screen. It appears the first time a
 * touch is seen and stays hidden for mouse and keyboard players.
 */
export class MoveStick {
  readonly root: HTMLElement;
  private knob = el("div", { class: "stick-knob" });
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  onChange: (x: number, y: number) => void = () => {};

  constructor() {
    this.root = el("div", { class: "stick", "aria-hidden": "true" }, [this.knob]);
    this.root.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  /** Reveals the stick; called once a touch input is detected. */
  enable(): void {
    this.root.classList.add("visible");
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    const rect = this.root.getBoundingClientRect();
    this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.update(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.update(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.knob.style.transform = "translate(0px, 0px)";
    this.onChange(0, 0);
  };

  private update(clientX: number, clientY: number): void {
    let dx = clientX - this.origin.x;
    let dy = clientY - this.origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS;
      dy = (dy / distance) * RADIUS;
    }
    this.knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    // Up on the stick walks forward, so the y axis is inverted.
    this.onChange(dx / RADIUS, -dy / RADIUS);
  }
}

/** True when the device is driven by a finger rather than a mouse. */
export function isTouchDevice(): boolean {
  return matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}
