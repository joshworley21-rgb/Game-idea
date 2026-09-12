import { actionCooldownLeft, actionsFor, STATION_INFO } from "../../game/actions.ts";
import { describeEffects } from "../../game/effects.ts";
import { memberById } from "../../game/family.ts";
import type { GameState, StationId } from "../../game/types.ts";
import type { Engine } from "../../game/engine.ts";
import { el, meter } from "../dom.ts";
import { personRow } from "../speakerView.ts";
import { chips, panel, type PanelHost } from "./host.ts";

/**
 * The people upstairs, as people: what they are doing, how long since you gave
 * them an evening, and whatever they are carrying while you are at work.
 */
export function familyRoster(s: GameState): HTMLElement[] {
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
      // What they are doing, and how long it has been since you asked.
      meta: `${member.doing} · ${waiting}`,
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

/** Everything you can do standing at one station, and who you can meet there. */
export function stationPanel(
  engine: Engine,
  station: StationId,
  host: PanelHost,
  onOpenBills: () => void,
  onOpenBudget: () => void,
  onOpenConversation: (id: string) => void,
  /**
   * Told the id of whatever the player just did, so the Chief of Staff can
   * react to it. Optional, because a panel built in a test has no chief.
   */
  onDid?: (id: string) => void,
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
              if (engine.performAction(action.id)) {
                host.close();
                onDid?.(action.id);
              }
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
