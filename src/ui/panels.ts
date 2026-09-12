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
