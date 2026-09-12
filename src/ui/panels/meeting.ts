import { STATION_INFO } from "../../game/actions.ts";
import { describeEffects } from "../../game/effects.ts";
import { memberById } from "../../game/family.ts";
import type { ConversationBeat, Effects } from "../../game/types.ts";
import type { Engine } from "../../game/engine.ts";
import { clear, el } from "../dom.ts";
import { speakerBlock } from "../speakerView.ts";
import { chips, panel, type PanelHost } from "./host.ts";

/**
 * A meeting played beat by beat: each option applies its effects immediately
 * and either opens the next beat or ends the exchange, at which point the
 * whole thing is judged as one outcome — the same way a crisis resolves as
 * one thing rather than a scoreboard.
 *
 * The beat is framed as a conversation. The person speaking is shown with
 * their face, their name and their office, and what they said is set as
 * speech rather than as a brief — which is the difference between a caption
 * and somebody in the room with you.
 */
export function conversationPanel(engine: Engine, conversationId: string, host: PanelHost): HTMLElement {
  const started = engine.startConversation(conversationId);
  const body = el("div", {});
  const close = () => {
    engine.endConversation();
    host.close();
  };
  const container = panel(
    started ? STATION_INFO[started.conversation.station].name : "Meeting",
    started ? started.conversation.label : "Not available",
    started ? started.conversation.intro : "",
    body,
    undefined,
    { onClose: close },
  );
  container.classList.add("meeting");

  if (!started) {
    body.append(el("div", { class: "option-detail" }, ["This meeting isn't available right now."]));
    return container;
  }

  const renderBeat = (beat: ConversationBeat, path: string[]) => {
    clear(body);
    body.append(speakerBlock(beat.speaker, beat.prompt, engine.state));
    const grid = el("div", { class: "option-grid" });
    for (const option of engine.optionsFor(beat, path)) {
      const affordable = engine.conversationOptionAffordable(option);
      grid.append(
        el(
          "button",
          {
            class: "option",
            disabled: !affordable,
            onclick: () => {
              const result = engine.chooseConversationOption(option.id);
              if (!result) return;
              if (result.beat) renderBeat(result.beat, result.path);
              else renderClose(result.text, result.totalEffects);
            },
          },
          [
            el("div", { class: "option-top" }, [
              el("span", { class: "option-label" }, [option.label]),
              option.capitalCost
                ? el("span", { class: "option-cost" }, [`${option.capitalCost} capital`])
                : null,
            ]),
            el("div", { class: "option-detail" }, [option.detail]),
            chips([
              ...(option.target && option.attention
                ? [
                    {
                      text: `${option.target === "all" ? "Everyone" : (memberById(engine.state, option.target)?.name ?? "Them")} ${option.attention > 0 ? "+" : ""}${option.attention}`,
                      good: option.attention > 0,
                    },
                  ]
                : []),
              ...describeEffects(option.effects),
            ]),
            option.risk
              ? el("div", { class: "risk-note" }, [
                  `Roughly a ${Math.round(option.risk * 100)}% chance this goes wrong.`,
                ])
              : null,
            !affordable ? el("div", { class: "reason" }, ["Not enough political capital for this."]) : null,
          ],
        ),
      );
    }
    body.append(grid);
  };

  const renderClose = (text: string, totalEffects: Effects) => {
    clear(body);
    body.append(
      el("div", { class: "speaker-line" }, [text]),
      chips(describeEffects(totalEffects)),
      el("div", { style: "margin-top:14px" }, [
        el("button", { class: "btn primary", onclick: () => host.close() }, ["Done"]),
      ]),
    );
  };

  renderBeat(started.beat, []);
  return container;
}
