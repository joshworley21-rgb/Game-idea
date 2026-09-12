import { describeEffects } from "../../game/effects.ts";
import { scoreLegacy } from "../../game/endings.ts";
import type { Ending, GameState } from "../../game/types.ts";
import type { Engine } from "../../game/engine.ts";
import { el } from "../dom.ts";
import { chips, panel, type PanelHost } from "./host.ts";

// --------------------------------------------------------------- decisions

export function reelectionPanel(engine: Engine, host: PanelHost): HTMLElement {
  const body = el("div", {}, [
    el("div", { class: "crisis-brief" }, [
      "Your political director wants an answer she can act on. Filing deadlines are coming, the donors want to know, and half the cabinet is quietly deciding whether to start looking for other work.",
    ]),
    el("div", { class: "option-grid" }, [
      el(
        "button",
        {
          class: "option",
          onclick: () => {
            engine.setReelection(true);
            host.release();
          },
        },
        [
          el("div", { class: "option-top" }, [
            el("span", { class: "option-label" }, ["Run again"]),
          ]),
          el("div", { class: "option-detail" }, [
            "Everything from here is measured against November. The party falls in line and the schedule doubles.",
          ]),
        ],
      ),
      el(
        "button",
        {
          class: "option",
          onclick: () => {
            engine.setReelection(false);
            host.release();
          },
        },
        [
          el("div", { class: "option-top" }, [
            el("span", { class: "option-label" }, ["One term is enough"]),
          ]),
          el("div", { class: "option-detail" }, [
            "You stop spending your life raising money and start spending it governing. Your party will drift toward whoever comes next.",
          ]),
          chips(describeEffects({ "politics.capital": 10, "personal.stress": -8, "politics.party": -10 })),
        ],
      ),
    ]),
  ]);
  return panel("Political Director", "Do you run again?", "", body);
}

export function endingPanel(state: GameState, ending: Ending, onRestart: () => void): HTMLElement {
  const legacy = scoreLegacy(state);
  return el("div", { class: "overlay" }, [
    el("div", { class: "ending-card" }, [
      el("div", { class: "ending-grade" }, [ending.grade]),
      el("div", { class: "ending-title" }, [ending.title]),
      el("div", { class: "ending-body" }, [ending.blurb]),
      el(
        "div",
        { class: "legacy-grid" },
        [
          ["Economy", legacy.economy],
          ["Society", legacy.society],
          ["World", legacy.standing],
          ["Politics", legacy.politics],
          ["Personal", legacy.personal],
          ["Legacy", ending.legacy],
        ].map(([label, value]) =>
          el("div", { class: "delta" }, [
            el("div", { class: "k" }, [String(label)]),
            el("div", { class: "v" }, [Math.round(Number(value)).toString()]),
          ]),
        ),
      ),
      el("div", { style: "text-align:center" }, [
        el("button", { class: "btn primary", onclick: onRestart }, ["Run again from the beginning"]),
      ]),
    ]),
  ]);
}
