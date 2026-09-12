import { CHIEF_NAME, CHIEF_TITLE, chiefReaction, morningBriefing, outstandingObligations } from "../game/chief.ts";
import type { GameState } from "../game/types.ts";
import { clear, el } from "./dom.ts";
import { portrait } from "./portrait.ts";

/**
 * Ruth, on screen.
 *
 * Two things live here: the morning briefing she gives at the top of a month,
 * and the one-line reaction she has to a decision you just made. Both are the
 * same card, because they are the same person speaking, and she should look
 * like the same person every time she appears.
 *
 * The card is deliberately not modal. She is a voice in the room, not a
 * dialog box — you can ignore her and get on with the month, which is exactly
 * what a president does to a chief of staff.
 */
export class ChiefPanel {
  readonly root: HTMLElement;
  private body = el("div", { class: "chief-body" });
  private face = el("div", { class: "chief-face" });
  private name = el("div", { class: "chief-name" }, [CHIEF_NAME]);
  private role = el("div", { class: "chief-role" }, [CHIEF_TITLE]);
  private obligations = el("div", { class: "chief-obligations" });
  private dismissTimer = 0;

  constructor() {
    this.root = el("div", { id: "chief-panel", class: "chief-panel" }, [
      el("div", { class: "chief-head" }, [
        this.face,
        el("div", { class: "chief-who" }, [this.name, this.role]),
      ]),
      this.body,
      this.obligations,
    ]);
    this.face.append(portrait(CHIEF_NAME, { size: 44, dress: "suit", mood: "neutral" }));
  }

  /**
   * The briefing at the top of a month. Stays until dismissed or until the
   * player does something, because it is the first thing she says and it
   * should not vanish before it is read.
   */
  brief(s: GameState): void {
    const { text } = morningBriefing(s);
    clear(this.body);
    this.body.append(el("p", { class: "chief-line" }, [text]));
    this.renderObligations(s);
    this.root.classList.add("show", "briefing");
    window.clearTimeout(this.dismissTimer);
  }

  /**
   * A reaction to something the player just did. Shows for a while and then
   * gets out of the way, because she has said her piece.
   */
  react(id: string): void {
    const text = chiefReaction(id);
    if (!text) return;
    clear(this.body);
    this.body.append(el("p", { class: "chief-line" }, [text]));
    clear(this.obligations);
    this.root.classList.add("show", "reaction");
    window.clearTimeout(this.dismissTimer);
    this.dismissTimer = window.setTimeout(() => this.hide(), 9000);
  }

  /** The standing obligations, listed under whatever she is saying. */
  private renderObligations(s: GameState): void {
    clear(this.obligations);
    const open = outstandingObligations(s);
    if (!open.length) return;
    this.obligations.append(el("div", { class: "chief-obligations-title" }, ["Still to do"]));
    for (const o of open) {
      this.obligations.append(
        el("div", { class: "chief-obligation", title: o.detail }, [
          el("span", { class: "chief-obligation-dot" }),
          el("span", {}, [o.label]),
        ]),
      );
    }
  }

  hide(): void {
    this.root.classList.remove("show", "briefing", "reaction");
  }
}
