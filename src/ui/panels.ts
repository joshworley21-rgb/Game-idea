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
import type { Bill, BudgetKey, ConversationBeat, Crisis, Effects, Ending, GameState, StationId } from "../game/types.ts";
import type { Engine, Outcome } from "../game/engine.ts";
import { clear, el, meter, money, one, sparkline } from "./dom.ts";
import { personRow, speakerBlock } from "./speakerView.ts";

const band = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v >= good ? "ok" : v >= bad ? "warn" : "bad";
const bandLow = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v <= good ? "ok" : v <= bad ? "warn" : "bad";

function statLine(key: string, value: string, tone: "ok" | "warn" | "bad" | ""): HTMLElement {
  return el("div", { class: "stat-line" }, [
    el("span", { class: "k" }, [key]),
    el("span", { class: `v ${tone}` }, [value]),
  ]);
}

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
    return personRow({
      seed: member.name,
      name: member.name,
      role: member.kind === "spouse" ? `your spouse, ${member.age}` : `${rank(member)}, ${member.age}`,
      age: member.age,
      dress: member.kind === "spouse" ? "smart" : "casual",
      // Someone carrying something reads as tired; otherwise they are fine.
      mood: member.strain ? "concerned" : member.bond >= 65 ? "warm" : "neutral",
      value: { text: Math.round(member.bond).toString(), tone },
      meta: member.doing,
      bars: [{ label: "Bond", value: member.bond, tone }],
      strain: member.strain
        ? {
            text: `${member.name} is ${member.strain.label}. ${member.strain.detail}`,
            severe: member.strain.severity > 55,
          }
        : undefined,
    });
  });
}

// ------------------------------------------------------------------ station

export function stationPanel(
  engine: Engine,
  station: StationId,
  host: PanelHost,
  onOpenBills: () => void,
  onOpenBudget: () => void,
  onOpenConversation: (id: string) => void,
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

  const conversations = engine.conversationsFor(station);
  if (conversations.length) {
    body.append(el("div", { class: "section-title" }, ["Meetings"]));
    const grid = el("div", { class: "option-grid" });
    for (const conv of conversations) {
      const cooldown = engine.conversationCooldownLeft(conv);
      const shortAp = s.ap < conv.ap;
      const shortCapital = (conv.capitalCost ?? 0) > s.politics.capital;
      const disabled = cooldown > 0 || shortAp || shortCapital;
      const cost = [
        `${conv.ap} action${conv.ap > 1 ? "s" : ""}`,
        conv.capitalCost ? `${conv.capitalCost} capital` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      grid.append(
        el(
          "button",
          {
            class: "option",
            disabled,
            onclick: () => onOpenConversation(conv.id),
          },
          [
            el("div", { class: "option-top" }, [
              el("span", { class: "option-label" }, [conv.label]),
              el("span", { class: "option-cost" }, [cost]),
            ]),
            el("div", { class: "option-detail" }, [conv.detail]),
            el("div", { class: "chips" }, [el("span", { class: "chip neutral" }, ["a conversation, not a click"])]),
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
            action.risk
              ? el("div", { class: "risk-note" }, [
                  `Roughly a ${Math.round(action.risk * 100)}% chance this goes wrong.`,
                ])
              : null,
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
