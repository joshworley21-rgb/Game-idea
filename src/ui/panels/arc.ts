import { describeEffects } from "../../game/effects.ts";
import type { Arc } from "../../game/arcs.ts";
import type { Engine } from "../../game/engine.ts";
import { el } from "../dom.ts";
import { chips, panel, type PanelHost } from "./host.ts";

/**
 * An arc, presented as a decision.
 *
 * This is deliberately the same shape as a crisis panel — a brief, then the
 * options — because that is what it is: something that will not wait. The
 * difference is where it came from. A crisis arrives from the country; an arc
 * arrives from something you did, and the brief says so.
 */
export function arcPanel(engine: Engine, arc: Arc, host: PanelHost): HTMLElement {
  const s = engine.state;
  const body = el("div", {}, [
    el("div", { class: "crisis-origin" }, ["This has been coming for a while"]),
    el("div", { class: "crisis-brief" }, [
      typeof arc.brief === "function" ? arc.brief(s) : arc.brief,
    ]),
  ]);
  const grid = el("div", { class: "option-grid" });

  for (const choice of arc.choices) {
    grid.append(
      el(
        "button",
        {
          class: "option",
          onclick: () => {
            if (engine.resolveArc(arc.id, choice.id)) host.release();
          },
        },
        [
          el("div", { class: "option-top" }, [
            el("span", { class: "option-label" }, [choice.label]),
          ]),
          el("div", { class: "option-detail" }, [choice.detail]),
          chips(describeEffects(choice.effects)),
          choice.risk
            ? el("div", { class: "risk-note" }, [
                `Roughly a ${Math.round(choice.risk * 100)}% chance this goes wrong.`,
              ])
            : null,
        ],
      ),
    );
  }
  body.append(grid);

  return panel(arc.source, arc.title, "This one has your name on it.", body);
}
