import { calendar } from "../game/state.ts";
import { CAMPAIGN_INTRO, CAMPAIGN_START, campaignBeats, mergeCampaignDeltas } from "../game/campaign.ts";
import type { CampaignDeltas } from "../game/campaign.ts";
import type { GameState, Party } from "../game/types.ts";
import { clear, el } from "./dom.ts";

/**
 * The screens before the game: the title card, the campaign, and the opening
 * crawl. They were in `main.ts`, which is the wiring for the running game and
 * had no business also holding three screens of copy.
 */

export interface TitleCallbacks {
  /** Starts a fresh run, with the campaign's deltas folded in. */
  onStart: (campaign: { deltas: CampaignDeltas; summary: string }) => void;
  /** Resumes a saved run. */
  onContinue: (state: GameState) => void;
  /** The save to offer, if there is one. */
  saved: GameState | null;
}

export function titleScreen(cb: TitleCallbacks): void {
  let party: Party = "blue";
  const nameInput = el("input", {
    type: "text",
    value: "President Reyes",
    maxlength: "34",
    placeholder: "Your name",
  }) as HTMLInputElement;

  const blue = el("button", { class: "party selected" }, [
    el("strong", {}, ["The Union Party"]),
    el("span", {}, ["Progressive base. Health, climate and labour play well at home."]),
  ]);
  const red = el("button", { class: "party" }, [
    el("strong", {}, ["The Heritage Party"]),
    el("span", {}, ["Conservative base. Defense, growth and enforcement play well at home."]),
  ]);
  blue.addEventListener("click", () => {
    party = "blue";
    blue.classList.add("selected");
    red.classList.remove("selected");
  });
  red.addEventListener("click", () => {
    party = "red";
    red.classList.add("selected");
    blue.classList.remove("selected");
  });

  const overlay = el("div", { class: "overlay" });
  document.body.append(overlay);

  clear(overlay);
  overlay.append(
    el("div", { class: "title-card" }, [
      el("div", { class: "title-mark" }, ["A single-player presidency"]),
      el("div", { class: "title-name" }, ["OVAL"]),
      el("div", { class: "title-tag" }, [
        "Four years. Forty-eight months. A budget nobody can balance, a Congress that owes you nothing, and a family upstairs who would like to see you occasionally.",
      ]),
      el("div", { class: "field" }, [el("label", {}, ["Your name"]), nameInput]),
      el("div", { class: "field" }, [
        el("label", {}, ["Your party"]),
        el("div", { class: "party-picker" }, [blue, red]),
      ]),
      el("div", { class: "title-actions" }, [
        el(
          "button",
          {
            class: "btn primary",
            onclick: () =>
              campaignScreen(overlay, party, (deltas, summary) => {
                overlay.remove();
                cb.onStart({ deltas, summary });
              }),
          },
          ["Run for it"],
        ),
        cb.saved
          ? el(
              "button",
              {
                class: "btn",
                onclick: () => {
                  overlay.remove();
                  cb.onContinue(cb.saved!);
                },
              },
              [`Continue — ${calendar(cb.saved.month).label}`],
            )
          : null,
      ]),
      el("div", { class: "help-list" }, [
        el("div", {}, [el("b", {}, ["Look"]), " — drag anywhere to turn your head."]),
        el("div", {}, [el("b", {}, ["Tap"]), " — open whatever you're looking at, or go through a door."]),
        el("div", {}, [
          el("b", {}, ["Full stats"]),
          " and ",
          el("b", {}, ["End the month"]),
          " are the buttons in the bar below.",
        ]),
        el("div", {}, [
          "You get two or three actions a month, and rather more than three things that need doing.",
        ]),
      ]),
    ]),
  );
}

/**
 * The six weeks before the oath, played out beat by beat in the same overlay
 * the picker used. `onDone` fires once with the campaign's accumulated
 * deltas and a one-line summary once election night resolves.
 */
export function campaignScreen(
  overlay: HTMLElement,
  party: Party,
  onDone: (deltas: CampaignDeltas, summary: string) => void,
): void {
  const beats = campaignBeats(party);
  const taken: CampaignDeltas[] = [];
  const path: string[] = [];

  const renderBeat = (beatId: string) => {
    const beat = beats[beatId];
    clear(overlay);
    overlay.append(
      el("div", { class: "title-card" }, [
        el("div", { class: "title-mark" }, [beat.speaker]),
        el("div", { class: "title-tag" }, [beat.prompt]),
        el(
          "div",
          { class: "option-grid", style: "text-align:left;margin-top:20px" },
          beat.options
            .filter((o) => !o.requires || o.requires(path))
            .map((option) =>
              el(
                "button",
                {
                  class: "option",
                  onclick: () => {
                    taken.push(option.deltas);
                    path.push(option.id);
                    if (option.next) renderBeat(option.next);
                    else renderResult(option.resultText);
                  },
                },
                [
                  el("div", { class: "option-top" }, [el("span", { class: "option-label" }, [option.label])]),
                  el("div", { class: "option-detail" }, [option.detail]),
                ],
              ),
            ),
        ),
      ]),
    );
  };

  const renderResult = (lastText: string) => {
    const total = mergeCampaignDeltas(taken);
    const margin = 4 + (total.approval ?? 0) * 0.6 + (total.party ?? 0) * 0.25;
    const summary =
      margin >= 0
        ? `Won a close one — up by roughly ${Math.round(margin)} points on the night.`
        : `Pulled it out anyway, down to the wire and short in the polls all October.`;
    clear(overlay);
    overlay.append(
      el("div", { class: "title-card" }, [
        el("div", { class: "title-mark" }, ["Election night"]),
        el("div", { class: "title-tag" }, [lastText]),
        el("div", { class: "title-tag", style: "margin-top:10px" }, [summary]),
        el("div", { class: "title-actions" }, [
          el("button", { class: "btn primary", onclick: () => onDone(total, summary) }, ["Take the oath"]),
        ]),
      ]),
    );
  };

  clear(overlay);
  overlay.append(
    el("div", { class: "title-card" }, [
      el("div", { class: "title-mark" }, ["Before the oath"]),
      el("div", { class: "title-tag" }, [CAMPAIGN_INTRO]),
      el("div", { class: "title-actions" }, [
        el("button", { class: "btn primary", onclick: () => renderBeat(CAMPAIGN_START) }, ["Begin"]),
      ]),
    ]),
  );
}

/**
 * The opening crawl. It plays over a black screen while the Oval model
 * downloads, and holds on the last line until `ready` resolves — so the
 * procedural stand-in is never visible.
 */
export function openingCutscene(ready: Promise<void>): void {
  const lines = [
    "January. The first month.",
    "The Oval is yours now. The desk, the phone, the door to the study.",
    "Everyone in this building wants an hour you do not have.",
    "Four years. Forty-eight months. Begin.",
  ];

  const overlay = el("div", { class: "cutscene" });
  const text = el("div", { class: "cutscene-line" });
  const hint = el("div", { class: "cutscene-hint" }, ["Tap to continue"]);
  overlay.append(text, hint);
  document.body.append(overlay);

  let index = 0;
  let timer = 0;
  let worldReady = false;
  let dismissed = false;

  ready.then(() => {
    worldReady = true;
  });

  const finish = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    overlay.classList.add("cutscene-out");
    setTimeout(() => overlay.remove(), 700);
  };

  const showLine = () => {
    text.textContent = lines[index];
    text.classList.remove("cutscene-in");
    // Force a reflow so the animation restarts on each line.
    void text.offsetWidth;
    text.classList.add("cutscene-in");
  };

  const advance = () => {
    clearTimeout(timer);
    index += 1;
    if (index < lines.length) {
      showLine();
      timer = window.setTimeout(advance, 2600);
      return;
    }
    // Past the last line: hold here until the Oval is on screen.
    text.textContent = lines[lines.length - 1];
    hint.classList.add("visible");
    if (worldReady) {
      finish();
      return;
    }
    // Poll rather than await, so a tap can still skip ahead.
    timer = window.setTimeout(() => {
      if (worldReady) finish();
      else advance();
    }, 400);
  };

  overlay.addEventListener("pointerdown", () => {
    if (index >= lines.length - 1 && worldReady) {
      finish();
      return;
    }
    advance();
  });

  showLine();
  timer = window.setTimeout(advance, 2600);
}
