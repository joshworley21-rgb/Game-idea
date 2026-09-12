import { describeEffects } from "../../game/effects.ts";
import { PASS_THRESHOLD } from "../../game/bills.ts";
import {
  BUDGET_KEYS,
  BUDGET_LABELS,
  SECTOR_NEED,
  calendar,
  debtService,
  legislatedSpending,
  totalDiscretionary,
} from "../../game/state.ts";
import type { Bill, BudgetKey } from "../../game/types.ts";
import type { Engine } from "../../game/engine.ts";
import { clear, el, money, one } from "../dom.ts";
import { chips, panel, type PanelHost } from "./host.ts";

// -------------------------------------------------------------- legislation

export function billsPanel(engine: Engine, host: PanelHost): HTMLElement {
  const s = engine.state;
  const body = el("div", {});
  const bills = engine.availableBills();

  const passed = s.bills.filter((b) => b.status === "passed");
  if (passed.length) {
    body.append(el("div", { class: "section-title" }, [`Signed into law (${passed.length})`]));
    body.append(
      el(
        "div",
        { class: "chips" },
        passed.map((b) => el("span", { class: "chip neutral" }, [b.title])),
      ),
    );
  }

  body.append(el("div", { class: "section-title" }, ["On the table"]));
  if (!bills.length) {
    body.append(el("div", { class: "option-detail" }, ["Nothing is ready for the floor this month."]));
  }

  const grid = el("div", { class: "option-grid" });
  for (const bill of bills) {
    grid.append(billCard(engine, bill, host));
  }
  body.append(grid);

  return panel(
    "The Resolute Desk",
    "Legislative Agenda",
    "Bringing a bill to the floor costs an action and the capital to open the door. Spend more to whip votes and the odds move with you.",
    body,
    undefined,
    { onClose: () => host.close() },
  );
}

function billCard(engine: Engine, bill: Bill, host: PanelHost): HTMLElement {
  const s = engine.state;
  const maxPush = Math.max(0, Math.min(35, Math.floor(s.politics.capital - bill.capitalCost)));
  let push = Math.min(12, maxPush);

  const odds = el("span", { class: "option-cost" });
  const forecastLine = el("div", { class: "option-detail" });
  const whipBoard = el("div", { class: "whip-board" });
  const pushLabel = el("span", { class: "budget-amount" });
  const slider = el("input", {
    type: "range",
    min: "0",
    max: String(maxPush),
    step: "1",
    value: String(push),
  }) as HTMLInputElement;

  const affordable = s.politics.capital >= bill.capitalCost;
  const goButton = el("button", {
    class: "btn primary small",
    disabled: !affordable || s.ap < 1,
  }, ["Bring it to a vote"]) as HTMLButtonElement;

  const refresh = () => {
    const f = engine.forecast(bill, push);
    odds.textContent = `${f.read} · ${Math.round(f.odds * 100)}%`;
    forecastLine.textContent = f.crossesParty
      ? "This crosses your own party. Passing it costs you at home."
      : `Whip count with ${bill.capitalCost + push} capital committed.`;
    pushLabel.textContent = `${bill.capitalCost + push} capital`;

    // The whip board: who is with you, faction by faction, and by how much.
    clear(whipBoard);
    whipBoard.append(
      el("div", { class: "whip-total" }, [
        `${Math.round(f.score)} of 100 votes expected · ${PASS_THRESHOLD} carries it`,
      ]),
    );
    for (const v of f.factions) {
      const pct = Math.round(v.odds * 100);
      const tone = pct >= 65 ? "ok" : pct >= 40 ? "warn" : "bad";
      whipBoard.append(
        el("div", { class: "whip-row", title: v.def.blurb }, [
          el("span", { class: "whip-name" }, [v.def.short]),
          el("span", { class: "whip-seats" }, [`${Math.round(v.seats)} seats`]),
          el("div", { class: "meter-track whip-meter" }, [
            el("div", { class: `meter-fill ${tone}`, style: `width:${pct}%` }),
          ]),
          el("span", { class: `whip-odds ${tone}` }, [`${pct}%`]),
        ]),
      );
    }
  };

  slider.addEventListener("input", () => {
    push = Number(slider.value);
    refresh();
  });
  goButton.addEventListener("click", () => {
    if (engine.proposeBill(bill.id, push)) host.close();
  });
  refresh();

  const tags = [
    bill.ideology,
    bill.cost > 0 ? `${money(bill.cost)}/yr` : bill.cost < 0 ? `${money(-bill.cost)}/yr saved` : "no net cost",
    `${bill.partisanship > 28 ? "divisive" : bill.partisanship > 16 ? "contested" : "broadly popular"}`,
  ];

  return el("div", { class: "option" }, [
    el("div", { class: "option-top" }, [
      el("span", { class: "option-label" }, [bill.title]),
      odds,
    ]),
    el("div", { class: "option-detail" }, [bill.summary]),
    el(
      "div",
      { class: "chips" },
      tags.map((t) => el("span", { class: "chip neutral" }, [t])),
    ),
    chips(describeEffects(bill.onPass)),
    el("div", { class: "budget-row", style: "margin-top:10px" }, [
      el("span", { class: "budget-name" }, ["Capital committed"]),
      slider,
      pushLabel,
    ]),
    forecastLine,
    whipBoard,
    el("div", { style: "margin-top:10px" }, [goButton]),
    !affordable
      ? el("div", { class: "reason" }, [`You need ${bill.capitalCost} capital just to open the door.`])
      : s.ap < 1
        ? el("div", { class: "reason" }, ["No action points left this month."])
        : null,
  ]);
}

// ------------------------------------------------------------------ budget

export function budgetPanel(engine: Engine, host: PanelHost): HTMLElement {
  const s = engine.state;
  const due = engine.budgetPending();
  const draft: Record<BudgetKey, number> = { ...s.enacted };
  let taxRate = s.nation.taxRate;

  const ledger = el("div", { class: "ledger" });
  const rows = el("div", {});

  const refresh = () => {
    clear(ledger);
    const revenue = (s.nation.gdp * taxRate) / 100;
    const discretionary = totalDiscretionary(draft);
    const interest = debtService(s);
    const laws = legislatedSpending(s);
    const deficit = discretionary + laws + interest - revenue;
    const line = (k: string, v: string, tone = "") =>
      el("div", { class: "stat-line" }, [
        el("span", { class: "k" }, [k]),
        el("span", { class: `v ${tone}` }, [v]),
      ]);
    ledger.append(
      line("Revenue", money(revenue)),
      line("Agency spending", money(-discretionary)),
      laws ? line("Spending mandated by law", money(-laws)) : el("div", {}),
      line("Interest on the debt", money(-interest)),
      el("div", { class: "stat-line ledger-total" }, [
        el("span", { class: "k" }, [deficit > 0 ? "Deficit" : "Surplus"]),
        el("span", { class: `v ${deficit > 0 ? (deficit > revenue * 0.25 ? "bad" : "warn") : "ok"}` }, [
          money(Math.abs(deficit)),
        ]),
      ]),
      el("div", { class: "option-detail" }, [
        `That is ${one((deficit / s.nation.gdp) * 100)}% of GDP. Debt stands at ${Math.round(s.nation.debtToGdp)}% and moves with the gap.`,
      ]),
    );
  };

  for (const key of BUDGET_KEYS) {
    const need = SECTOR_NEED[key];
    const amount = el("span", { class: "budget-amount" });
    const slider = el("input", {
      type: "range",
      min: "0",
      max: String(Math.round(need * 1.9)),
      step: "5",
      value: String(Math.round(draft[key])),
      disabled: !due,
    }) as HTMLInputElement;

    const paint = () => {
      const ratio = draft[key] / need;
      clear(amount);
      amount.append(
        document.createTextNode(money(draft[key])),
        el("span", { class: "budget-note" }, [
          ratio >= 1.12 ? "well funded" : ratio >= 0.95 ? "holding" : ratio >= 0.8 ? "squeezed" : "starved",
        ]),
      );
    };
    slider.addEventListener("input", () => {
      draft[key] = Number(slider.value);
      paint();
      refresh();
    });
    paint();

    rows.append(
      el("div", { class: "budget-row" }, [
        el("div", { class: "budget-name" }, [
          BUDGET_LABELS[key],
          el("small", {}, [`quality ${Math.round(s.nation.sectors[key])} · holds at ${money(need)}`]),
        ]),
        slider,
        amount,
      ]),
    );
  }

  const taxValue = el("span", { class: "budget-amount" });
  const taxSlider = el("input", {
    type: "range",
    min: "8",
    max: "32",
    step: "0.1",
    value: String(taxRate),
    disabled: !due,
  }) as HTMLInputElement;
  const paintTax = () => {
    clear(taxValue);
    taxValue.append(
      document.createTextNode(`${one(taxRate)}%`),
      el("span", { class: "budget-note" }, [`${one(taxRate - s.nation.taxRate)} vs today`]),
    );
  };
  taxSlider.addEventListener("input", () => {
    taxRate = Number(taxSlider.value);
    paintTax();
    refresh();
  });
  paintTax();
  refresh();

  const body = el("div", {}, [
    el("div", { class: "section-title" }, ["Agency appropriations"]),
    rows,
    el("div", { class: "section-title" }, ["Federal tax take"]),
    el("div", { class: "budget-row" }, [
      el("div", { class: "budget-name" }, [
        "Effective tax rate",
        el("small", {}, ["Raising it funds the state and costs you at the polls."]),
      ]),
      taxSlider,
      taxValue,
    ]),
    el("div", { class: "section-title" }, ["The books"]),
    ledger,
  ]);

  const signButton = el("button", {
    class: "btn primary",
    disabled: !due || s.ap < 1,
    onclick: () => {
      if (engine.signBudget(draft, taxRate)) host.close();
    },
  }, [due ? "Sign the budget (1 action)" : "Not due until the fiscal year turns"]);

  const foot = el("div", { class: "panel-foot" }, [
    el("span", { class: due && s.ap < 1 ? "reason" : "option-detail" }, [
      due && s.ap < 1
        ? "No action points left. End the month and the government runs on a stopgap instead."
        : due
          ? "Leave it unsigned and the government runs on a stopgap, which costs you standing."
          : `Next budget due in ${12 - ((s.month - 1) % 12)} months.`,
    ]),
    signButton,
  ]);

  return panel(
    "The Cabinet Table",
    `Year ${calendar(s.month).year} Budget`,
    "Every agency degrades toward the money you give it. The cost of standing still rises a little every month.",
    body,
    foot,
    { onClose: () => host.close() },
  );
}
