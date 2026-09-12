import { clear, el } from "../dom.ts";
import type { Outcome } from "../../game/engine.ts";

/**
 * The modal host and the small pieces every panel is built from.
 *
 * This used to live at the top of a single 40KB `panels.ts`. Splitting the
 * panels into their own modules means the shared parts need a home that does
 * not import any of them, so nothing ends up in a cycle.
 */

export const band = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v >= good ? "ok" : v >= bad ? "warn" : "bad";

export const bandLow = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v <= good ? "ok" : v <= bad ? "warn" : "bad";

export function statLine(key: string, value: string, tone: "ok" | "warn" | "bad" | ""): HTMLElement {
  return el("div", { class: "stat-line" }, [
    el("span", { class: "k" }, [key]),
    el("span", { class: `v ${tone}` }, [value]),
  ]);
}

export function chips(effects: { text: string; good: boolean }[]): HTMLElement {
  return el(
    "div",
    { class: "chips" },
    effects.map((e) => el("span", { class: `chip ${e.good ? "" : "bad"}` }, [e.text])),
  );
}

/** Owns the single modal slot and the toast stack. */
export class PanelHost {
  readonly root = el("div", { id: "panel-root" });
  readonly toasts = el("div", { id: "toast-root" });
  private scrim = el("div", { class: "scrim" });
  private slot = el("div");
  onClose: () => void = () => {};
  /** Blocks closing while a crisis demands an answer. */
  private locked = false;

  constructor() {
    this.scrim.addEventListener("click", () => {
      if (!this.locked) this.close();
    });
    this.root.append(this.scrim, this.slot);
    document.body.append(this.root, this.toasts);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen && !this.locked) this.close();
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains("open");
  }

  show(node: HTMLElement, locked = false): void {
    this.locked = locked;
    clear(this.slot);
    this.slot.append(node);
    this.root.classList.add("open");
  }

  close(): void {
    if (this.locked) return;
    this.root.classList.remove("open");
    clear(this.slot);
    this.onClose();
  }

  /** Force-closes even a locked panel, once its decision is made. */
  release(): void {
    this.locked = false;
    this.close();
  }

  toast(outcome: Outcome): void {
    const node = el("div", { class: `toast ${outcome.tone}` }, [
      el("div", { class: "toast-title" }, [outcome.title]),
      el("div", { class: "toast-text" }, [outcome.text]),
      outcome.effects.length ? chips(outcome.effects) : null,
    ]);
    this.toasts.append(node);
    setTimeout(() => {
      node.style.transition = "opacity 0.4s ease";
      node.style.opacity = "0";
      setTimeout(() => node.remove(), 400);
    }, 5200);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
  }
}

/** The frame every panel shares: an eyebrow, a title, a body, an optional foot. */
export function panel(
  eyebrow: string,
  title: string,
  sub: string,
  body: HTMLElement,
  foot?: HTMLElement,
  opts: { narrow?: boolean; onClose?: () => void } = {},
): HTMLElement {
  const head = el("div", { class: "panel-head" }, [
    el("div", {}, [
      el("div", { class: "panel-eyebrow" }, [eyebrow]),
      el("div", { class: "panel-title" }, [title]),
      sub ? el("div", { class: "panel-sub" }, [sub]) : null,
    ]),
    opts.onClose ? el("button", { class: "close-x", onclick: opts.onClose }, ["✕"]) : null,
  ]);
  return el("div", { class: `panel ${opts.narrow ? "narrow" : ""}` }, [
    head,
    el("div", { class: "panel-body" }, [body]),
    foot ?? null,
  ]);
}
