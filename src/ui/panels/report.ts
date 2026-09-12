import { describeEffects } from "../../game/effects.ts";
import { calendar } from "../../game/state.ts";
import type { Crisis } from "../../game/types.ts";
import type { MonthReport } from "../../game/sim.ts";
import type { Engine } from "../../game/engine.ts";
import { el, money } from "../dom.ts";
import { chips, panel, type PanelHost } from "./host.ts";

// ------------------------------------------------------------------ crisis

export function crisisPanel(engine: Engine, crisis: Crisis, host: PanelHost): HTMLElement {
  // If a running situation produced this, say so: the player should be able to
  // trace trouble back to the decision that caused it.
  const from = engine.state.threads.filter((t) => t.feeds?.includes(crisis.id));
  const body = el("div", {}, [
    from.length
      ? el("div", { class: "crisis-origin" }, [`This follows from: ${from.map((t) => t.label).join(", ")}`])
      : null,
    el("div", { class: "crisis-brief" }, [
      typeof crisis.brief === "function" ? crisis.brief(engine.state) : crisis.brief,
    ]),
  ]);
  const grid = el("div", { class: "option-grid" });

  for (const choice of crisis.choices) {
    const affordable = engine.affordable(crisis, choice);
    grid.append(
      el(
        "button",
        {
          class: "option",
          disabled: !affordable,
          onclick: () => {
            if (engine.resolveCrisis(crisis.id, choice.id)) host.release();
          },
        },
        [
          el("div", { class: "option-top" }, [
            el("span", { class: "option-label" }, [choice.label]),
            choice.capitalCost
              ? el("span", { class: "option-cost" }, [`${choice.capitalCost} capital`])
              : null,
          ]),
          el("div", { class: "option-detail" }, [choice.detail]),
          chips(describeEffects(choice.effects)),
          choice.risk
            ? el("div", { class: "risk-note" }, [
                `Roughly a ${Math.round(choice.risk * 100)}% chance this goes wrong.`,
              ])
            : null,
          !affordable
            ? el("div", { class: "reason" }, ["Not enough political capital for this one."])
            : (choice.capitalCost ?? 0) > engine.state.politics.capital
              ? el("div", { class: "risk-note" }, [
                  "You do not have the capital for this. Taking it anyway spends everything you have.",
                ])
              : null,
        ],
      ),
    );
  }
  body.append(grid);

  return panel(crisis.source, crisis.title, "This does not wait for next month.", body);
}

// ------------------------------------------------------------------ report

export function reportPanel(engine: Engine, report: MonthReport, host: PanelHost): HTMLElement {
  const s = engine.state;
  const body = el("div", {});

  if (report.deltas.length) {
    body.append(el("div", { class: "section-title" }, ["What moved"]));
    const grid = el("div", { class: "delta-grid" });
    for (const d of report.deltas) {
      const change = d.to - d.from;
      grid.append(
        el("div", { class: "delta" }, [
          el("div", { class: "k" }, [d.label]),
          el("div", { class: `v ${d.good ? "up" : "down"}` }, [
            `${change > 0 ? "+" : ""}${change.toFixed(1)}`,
          ]),
        ]),
      );
    }
    body.append(grid);
  }

  if (report.notes.length) {
    body.append(el("div", { class: "section-title" }, ["On your mind"]));
    for (const note of report.notes) body.append(el("div", { class: "note" }, [note]));
  }

  const headlines = s.news.filter((n) => n.month >= report.month);
  if (headlines.length) {
    body.append(el("div", { class: "section-title" }, ["The press"]));
    for (const item of headlines.slice(0, 5)) {
      body.append(
        el("div", { class: `headline ${item.tone}` }, [
          el("div", { class: "headline-text" }, [item.headline]),
          el("div", { class: "headline-meta" }, [item.source]),
        ]),
      );
    }
  }

  const foot = el("div", { class: "panel-foot" }, [
    el("span", { class: "option-detail" }, [
      `${s.ap} action${s.ap === 1 ? "" : "s"} available in ${calendar(s.month).label}.`,
    ]),
    el("button", { class: "btn primary", onclick: () => host.close() }, ["Get to work"]),
  ]);

  return panel(
    "Monthly Brief",
    calendar(report.month).label,
    `The month closed with the deficit running at ${money(report.deficit)} a year.`,
    body,
    foot,
  );
}
