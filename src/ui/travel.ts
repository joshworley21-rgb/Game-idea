import { el } from "./dom.ts";

/** How long the veil takes to fade each way — matches the CSS transition. */
const FADE_MS = 350;
/** How long it holds, fully black, over the travel line. */
const HOLD_MS = 550;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The cut between rooms: fades to black, holds on a travel line while the
 * world resets underneath (hidden, so it can just teleport), then fades back
 * in on wherever that left the camera.
 */
export class TravelVeil {
  readonly root: HTMLElement;
  private label = el("div", { class: "travel-label" });

  constructor() {
    this.root = el("div", { id: "travel-veil" }, [this.label]);
  }

  /** Fades out, runs `atBlack` while hidden, holds, then fades back in. */
  async play(label: string, atBlack: () => void): Promise<void> {
    this.label.textContent = label;
    this.root.classList.add("show");
    await wait(FADE_MS);
    atBlack();
    await wait(HOLD_MS);
    this.root.classList.remove("show");
    await wait(FADE_MS);
  }
}
