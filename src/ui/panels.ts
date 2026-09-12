// --------------------------------------------------------------- meetings

/**
 * A meeting played beat by beat: each option applies its effects immediately
 * and either opens the next beat or ends the exchange, at which point the
 * whole thing is judged as one outcome — the same way a crisis resolves as
 * one thing rather than a scoreboard.
 *
 * The beat is framed as a conversation: the person speaking is shown with
 * their face, their name and their office, and what they said is set as
 * speech rather than as a brief.
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
