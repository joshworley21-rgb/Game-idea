import { actionCooldownLeft, actionsFor, STATION_INFO } from "../game/actions.ts";
import { describeEffects } from "../game/effects.ts";
import { BLOCS } from "../game/blocs.ts";
import { PASS_THRESHOLD } from "../game/bills.ts";
import { FACTION_BY_KEY } from "../game/congress.ts";
import { memberById, stateOf } from "../game/family.ts";
import { electionMargin, gradeFor, scoreLegacy } from "../game/endings.ts";
import type { MonthReport } from "../game/sim.ts";
import {
  BUDGET_KEYS,
  BUDGET_LABELS,
  SECTOR_NEED,
  calendar,
  debtService,
  legislatedSpending,
  totalDiscretionary,
} from "../game/state.ts";
import type { Bill, BudgetKey, Crisis, Ending, GameState, StationId } from "../game/types.ts";
import type { Engine, Outcome } from "../game/engine.ts";
import { clear, el, meter, money, one, sparkline } from "./dom.ts";

function chips(effects: { text: string; good: boolean }[]): HTMLElement {
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

function panel(
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

/**
 * The people upstairs, as people: what they are doing, how long since you gave
 * them an evening, and whatever they are carrying while you are at work.
 */
function familyRoster(s: GameState): HTMLElement[] {
  const kids = [...(s.family ?? [])].filter((m) => m.kind === "child").sort((a, b) => b.age - a.age);
  const rank = (member: (typeof kids)[number]): string => {
    if (kids.length < 2) return "your child";
    if (member.id === kids[0].id) return "your eldest";
    if (member.id === kids[kids.length - 1].id) return "your youngest";
    return "your middle";
  };
  return (s.family ?? []).map((member) => {
    const tone = member.bond >= 65 ? "ok" : member.bond >= 42 ? "warn" : "bad";
    const waiting =
      member.since === 0
        ? "you saw them this month"
        : `${member.since} ${member.since === 1 ? "month" : "months"} since you gave them an evening`;
    return el("div", { class: "cabinet-row" }, [
      el("div", { class: "bloc-head" }, [
        el("span", {}, [member.name]),
        el("span", { class: "bloc-share" }, [
          member.kind === "spouse" ? `your spouse, ${member.age}` : `${rank(member)}, ${member.age}`,
        ]),
        el("span", { class: `v ${tone}` }, [Math.round(member.bond).toString()]),
      ]),
      el("div", { class: "cabinet-meta" }, [member.doing]),
      el("div", { class: "meter-track" }, [
        el("div", { class: `meter-fill ${tone}`, style: `width:${member.bond}%` }),
      ]),
      el("div", { class: `family-state${member.strain ? " strained" : ""}` }, [
        member.strain ? `${member.name} is ${member.strain.label}. ${member.strain.detail}` : `${stateOf(member)} · ${waiting}`,
      ]),
    ]);
  });
}

// ------------------------------------------------------------------ station

export function stationPanel(
  engine: Engine,
  station: StationId,
  host: PanelHost,
  onOpenBills: () => void,
  onOpenBudget: () => void,
): HTMLElement {
  const s = engine.state;
  const info = STATION_INFO[station];
  const body = el("div", {});

  if (station === "desk") {
    body.append(
      el("div", { class: "section-title" }, ["Legislation"]),
      el("button", { class: "option", onclick: onOpenBills }, [
        el("div", { class: "option-top" }, [
          el("span", { class: "option-label" }, ["Open the legislative agenda"]),
          el("span", { class: "option-cost" }, ["1 action + capital"]),
        ]),
        el("div", { class: "option-detail" }, [
          `${engine.availableBills().length} bills could go to the floor. ${s.counters.billsPassed ?? 0} signed into law so far.`,
        ]),
      ]),
    );
  }
  if (station === "budget") {
    const due = engine.budgetPending();
    body.append(
      el("div", { class: "section-title" }, ["Appropriations"]),
      el("button", { class: "option", onclick: onOpenBudget }, [
        el("div", { class: "option-top" }, [
          el("span", { class: "option-label" }, [due ? "Sign this year's budget" : "Review the books"]),
          el("span", { class: "option-cost" }, [due ? "1 action" : "no cost"]),
        ]),
        el("div", { class: "option-detail" }, [
          due
            ? "The fiscal year starts now. Nine agencies and a tax rate are waiting on your signature."
            : "The budget is set until the next fiscal year. You can still read what it is doing to you.",
        ]),
      ]),
    );
  }

  if (station === "family" && s.family?.length) {
    body.append(el("div", { class: "section-title" }, ["Upstairs"]), ...familyRoster(s));
  }
  if (station === "rest") {
    const p = s.personal;
    body.append(
      el("div", { class: "section-title" }, ["The body you are doing this in"]),
      meter("Health", p.health),
      meter("Sleep debt", p.sleepDebt, true),
      meter("Fitness", p.fitness),
      meter("Stress", p.stress, true),
      el("div", { class: "option-detail" }, [
        p.condition
          ? `Walter Reed is managing ${p.condition}. It does not manage itself.`
          : p.sleepDebt > 60
            ? "You are running on less sleep than the physician has written down anywhere."
            : "Nothing on the chart your physician wants to talk about yet.",
      ]),
    );
  }

  const actions = actionsFor(s, station);
  if (actions.length) {
    body.append(el("div", { class: "section-title" }, ["What you can do this month"]));
    const grid = el("div", { class: "option-grid" });
    for (const action of actions) {
      const cooldown = actionCooldownLeft(s, action);
      const shortAp = s.ap < action.ap;
      const shortCapital = (action.capitalCost ?? 0) > s.politics.capital;
      const disabled = cooldown > 0 || shortAp || shortCapital;
      const cost = [
        `${action.ap} action${action.ap > 1 ? "s" : ""}`,
        action.capitalCost ? `${action.capitalCost} capital` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      grid.append(
        el(
          "button",
          {
            class: "option",
            disabled,
            onclick: () => {
              if (engine.performAction(action.id)) host.close();
            },
          },
          [
            el("div", { class: "option-top" }, [
              el("span", { class: "option-label" }, [action.label]),
              el("span", { class: "option-cost" }, [cost]),
            ]),
            el("div", { class: "option-detail" }, [action.detail]),
            // An hour upstairs is worth naming the person it goes to.
            chips([
              ...(action.target && action.attention
                ? [
                    {
                      text: `${action.target === "all" ? "Everyone" : (memberById(s, action.target)?.name ?? "Them")} +${action.attention}`,
                      good: true,
                    },
                  ]
                : []),
              ...describeEffects(action.effects),
            ]),
            cooldown > 0
              ? el("div", { class: "reason" }, [`Not again for ${cooldown} month${cooldown > 1 ? "s" : ""}.`])
              : shortAp
                ? el("div", { class: "reason" }, ["Not enough action points left this month."])
                : shortCapital
                  ? el("div", { class: "reason" }, ["Not enough political capital."])
                  : null,
          ],
        ),
      );
    }
    body.append(grid);
  }

  return panel("Station", info.name, info.blurb, body, undefined, {
    onClose: () => host.close(),
  });
}

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

// --------------------------------------------------------------- dashboard

export function dashboardPanel(engine: Engine, host: PanelHost): HTMLElement {
  const s = engine.state;
  const legacy = scoreLegacy(s);
  const history = s.history;

  const left = el("div", {}, [
    ...(s.threads.length
      ? [
          el("div", { class: "section-title" }, ["Situations running"]),
          ...s.threads.map((t) =>
            el("div", { class: "option", style: "margin-bottom:9px" }, [
              el("div", { class: "option-top" }, [
                el("span", { class: "option-label" }, [t.label]),
                el("span", { class: "option-cost" }, [
                  `${Math.round(t.intensity)} · ${t.drift > 0 ? "worsening" : "easing"} · month ${t.age + 1}`,
                ]),
              ]),
              el("div", { class: "option-detail" }, [t.detail]),
              el("div", { class: "meter-track", style: "margin-top:8px" }, [
                el("div", {
                  class: `meter-fill ${t.intensity > 60 ? "bad" : t.intensity > 30 ? "warn" : "ok"}`,
                  style: `width:${t.intensity}%`,
                }),
              ]),
            ]),
          ),
        ]
      : []),
    el("div", { class: "section-title" }, ["Public services"]),
    ...BUDGET_KEYS.map((k) => meter(BUDGET_LABELS[k], s.nation.sectors[k])),
    el("div", { class: "section-title" }, ["Upstairs"]),
    ...familyRoster(s),
    el("div", { class: "section-title" }, ["Your cabinet"]),
    ...(s.cabinet ?? []).map((person) => {
      const def = FACTION_BY_KEY.get(person.faction);
      const loyalTone = person.loyalty >= 55 ? "ok" : person.loyalty >= 35 ? "warn" : "bad";
      return el("div", { class: "cabinet-row" }, [
        el("div", { class: "bloc-head" }, [
          el("span", {}, [person.name]),
          el("span", { class: "bloc-share" }, [person.title]),
        ]),
        el("div", { class: "cabinet-meta" }, [
          `${def?.short ?? "unaligned"} · ${person.months} months in post`,
        ]),
        el("div", { class: "cabinet-bars" }, [
          el("span", { class: "k" }, ["Competence"]),
          el("div", { class: "meter-track whip-meter" }, [
            el("div", { class: "meter-fill ok", style: `width:${person.competence}%` }),
          ]),
          el("span", { class: "k" }, ["Loyalty"]),
          el("div", { class: "meter-track whip-meter" }, [
            el("div", { class: `meter-fill ${loyalTone}`, style: `width:${person.loyalty}%` }),
          ]),
        ]),
      ]);
    }),
    el("div", { class: "section-title" }, ["Conditions"]),
    meter("Security", s.nation.security),
    meter("Global standing", s.nation.standing),
    meter("Civil unrest", s.nation.unrest, true),
    meter("Press relations", s.politics.media),
    meter("Party backing", s.politics.party),
    meter("Scandal exposure", s.politics.scandal, true),
  ]);

  const right = el("div", {});

  // The coalition board: approval broken into the people it is made of.
  right.append(el("div", { class: "section-title" }, ["Your coalition"]));
  const ranked = [...BLOCS].sort((a, b) => (s.blocs[b.key] ?? 50) - (s.blocs[a.key] ?? 50));
  for (const def of ranked) {
    const support = s.blocs[def.key] ?? 50;
    const tone = support >= 55 ? "ok" : support >= 45 ? "warn" : "bad";
    right.append(
      el("div", { class: "bloc-row", title: def.cares }, [
        el("div", { class: "bloc-head" }, [
          el("span", {}, [def.short]),
          el("span", { class: "bloc-share" }, [`${Math.round(def.weight * 100)}% of voters`]),
          el("span", { class: `v ${tone}` }, [Math.round(support).toString()]),
        ]),
        el("div", { class: "meter-track" }, [
          el("div", { class: `meter-fill ${tone}`, style: `width:${support}%` }),
        ]),
      ]),
    );
  }
  // Congress, faction by faction: who holds the seats and how they feel today.
  right.append(el("div", { class: "section-title" }, ["The floor"]));
  for (const key of Object.keys(s.factions) as (keyof typeof s.factions)[]) {
    const faction = s.factions[key];
    const def = FACTION_BY_KEY.get(key);
    if (!faction || !def) continue;
    const tone = faction.mood >= 55 ? "ok" : faction.mood >= 45 ? "warn" : "bad";
    right.append(
      el("div", { class: "bloc-row", title: def.blurb }, [
        el("div", { class: "bloc-head" }, [
          el("span", {}, [def.short]),
          el("span", { class: "bloc-share" }, [`${Math.round(faction.seats)} seats`]),
          el("span", { class: `v ${tone}` }, [Math.round(faction.mood).toString()]),
        ]),
        el("div", { class: "meter-track" }, [
          el("div", { class: `meter-fill ${tone}`, style: `width:${faction.mood}%` }),
        ]),
      ]),
    );
  }

  const margin = electionMargin(s);
  right.append(
    el("div", { class: "option-detail", style: "margin-top:10px" }, [
      margin > 0
        ? `On these numbers you win re-election by about ${Math.round(margin)} points.`
        : `On these numbers you lose re-election by about ${Math.round(-margin)} points.`,
    ]),
  );

  if (history.length > 1) {
    right.append(el("div", { class: "section-title" }, ["Since the inauguration"]));
    const series: [string, number[], number, number, string][] = [
      ["Approval", history.map((h) => h.approval), 20, 80, "#e2c16e"],
      ["Growth", history.map((h) => h.growth), -3, 6, "#7fc294"],
      ["Unrest", history.map((h) => h.unrest), 0, 100, "#e07a68"],
      ["Your health", history.map((h) => h.health), 0, 100, "#8fb6e0"],
    ];
    for (const [label, values, min, max, tone] of series) {
      right.append(
        el("div", { style: "margin-bottom:14px" }, [
          el("div", { class: "stat-line" }, [
            el("span", { class: "k" }, [label]),
            el("span", { class: "v" }, [one(values[values.length - 1])]),
          ]),
          sparkline(values, min, max, tone),
        ]),
      );
    }
  }

  right.append(
    el("div", { class: "section-title" }, ["Legacy so far"]),
    el(
      "div",
      { class: "legacy-grid" },
      [
        ["Economy", legacy.economy],
        ["Society", legacy.society],
        ["World", legacy.standing],
        ["Politics", legacy.politics],
        ["Personal", legacy.personal],
      ].map(([label, value]) =>
        el("div", { class: "delta" }, [
          el("div", { class: "k" }, [String(label)]),
          el("div", { class: "v" }, [Math.round(Number(value)).toString()]),
        ]),
      ),
    ),
    el("div", { class: "option-detail" }, [
      `Projected grade if the term ended today: ${gradeFor(legacy.total)} (${Math.round(legacy.total)}/100).`,
    ]),
    el("div", { class: "section-title" }, ["Recent headlines"]),
    ...s.news.slice(0, 6).map((n) =>
      el("div", { class: `headline ${n.tone}` }, [
        el("div", { class: "headline-text" }, [n.headline]),
        el("div", { class: "headline-meta" }, [`${n.source} · month ${n.month}`]),
      ]),
    ),
    el("div", { class: "section-title" }, ["Your record"]),
    ...s.log.slice(0, 8).map((entry) =>
      el("div", { class: "stat-line" }, [
        el("span", { class: "k" }, [`M${entry.month}`]),
        el("span", { class: "v" }, [entry.text]),
      ]),
    ),
  );

  const body = el("div", { class: "two-col" }, [left, right]);
  return panel(
    "Situation Room",
    "The State of Play",
    `${s.presidentName} · ${s.counters.billsPassed ?? 0} laws passed, ${s.counters.crisesHandled ?? 0} crises handled.`,
    body,
    undefined,
    { onClose: () => host.close() },
  );
}

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
