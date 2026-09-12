// --------------------------------------------------------------- dashboard

export function dashboardPanel(engine: Engine, host: PanelHost): HTMLElement {
  const s = engine.state;
  const legacy = scoreLegacy(s);
  const history = s.history;

  const n = s.nation;
  const left = el("div", {}, [
    el("div", { class: "section-title" }, ["The nation"]),
    statLine("Growth", `${one(n.growth)}%`, band(n.growth, 2, 0.8)),
    statLine("Unemployment", `${one(n.unemployment)}%`, bandLow(n.unemployment, 5, 6.8)),
    statLine("Inflation", `${one(n.inflation)}%`, bandLow(n.inflation, 3, 4.5)),
    statLine("Debt / GDP", `${Math.round(n.debtToGdp)}%`, bandLow(n.debtToGdp, 105, 125)),
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
      // A secretary who has stopped believing in you looks it.
      const mood = person.loyalty < 35 ? "guarded" : person.loyalty < 55 ? "concerned" : "neutral";
      return personRow({
        seed: person.name,
        name: person.name,
        role: person.title,
        mood,
        meta: `${def?.short ?? "unaligned"} · ${person.months} months in post`,
        bars: [
          { label: "Competence", value: person.competence, tone: "ok" },
          { label: "Loyalty", value: person.loyalty, tone: loyalTone },
        ],
      });
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
