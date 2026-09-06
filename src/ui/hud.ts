import { STATION_INFO, STATION_ORDER } from "../game/actions.ts";
import { TERM_MONTHS, calendar } from "../game/state.ts";
import type { GameState, StationId } from "../game/types.ts";
import { clear, el, meter, one } from "./dom.ts";

function statLine(key: string, value: string, tone: "ok" | "warn" | "bad" | ""): HTMLElement {
  return el("div", { class: "stat-line" }, [
    el("span", { class: "k" }, [key]),
    el("span", { class: `v ${tone}` }, [value]),
  ]);
}

const band = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v >= good ? "ok" : v >= bad ? "warn" : "bad";
const bandLow = (v: number, good: number, bad: number): "ok" | "warn" | "bad" =>
  v <= good ? "ok" : v <= bad ? "warn" : "bad";

/** The always-on overlay: date, action points, the nation, and you. */
export class Hud {
  readonly root: HTMLElement;
  private date = el("div", { class: "hud-card", id: "hud-date" });
  private power = el("div", { class: "hud-card", id: "hud-power" });
  private nation = el("div", { class: "hud-card", id: "hud-nation" });
  private self = el("div", { class: "hud-card", id: "hud-self" });
  private prompt = el("div", { id: "prompt" });
  private crosshair = el("div", { id: "crosshair" });
  private actions = el("div", { class: "hud-card", id: "hud-actions" });
  private endButton: HTMLButtonElement;
  private legend = el("div", { class: "hud-card", id: "hud-legend" });
  /** Compact stat row shown only on small screens, where the cards are hidden. */
  private strip = el("div", { class: "hud-card", id: "hud-strip" });
  /** Situations currently running; hidden when the country is calm. */
  private situations = el("div", { class: "hud-card", id: "hud-situations" });

  private muteButton: HTMLButtonElement;

  constructor(
    onEndMonth: () => void,
    onDashboard: () => void,
    onStation: (station: StationId) => void,
    onToggleMute: () => boolean,
  ) {
    this.endButton = el("button", { class: "btn primary", onclick: onEndMonth }, [
      "End the month",
    ]) as HTMLButtonElement;
    // "(Tab)" means nothing on a phone, where this button is the only way in.
    const touch = matchMedia("(pointer: coarse)").matches;
    this.muteButton = el("button", {
      class: "btn ghost small mute",
      title: "Mute sound",
      "aria-label": "Mute sound",
      onclick: () => {
        this.muteButton.textContent = onToggleMute() ? "Sound off" : "Sound on";
      },
    }, ["Sound on"]) as HTMLButtonElement;

    this.actions.append(
      this.endButton,
      el("button", { class: "btn ghost small", onclick: onDashboard }, [
        touch ? "Full stats" : "Dashboard (Tab)",
      ]),
      this.muteButton,
    );
    // Number keys reach every station without walking, so the whole game is
    // playable from the keyboard alone.
    STATION_ORDER.forEach((station, i) => {
      this.legend.append(
        el("button", { class: "legend-row", onclick: () => onStation(station) }, [
          el("kbd", {}, [String(i + 1)]),
          el("span", {}, [STATION_INFO[station].name]),
        ]),
      );
    });

    this.root = el("div", { id: "hud" }, [
      this.date,
      this.power,
      this.nation,
      this.self,
      this.actions,
      this.legend,
      this.strip,
      this.situations,
    ]);
    document.body.append(this.crosshair, this.prompt);
  }

  /** Reflects the stored preference once audio starts. */
  setMuted(muted: boolean): void {
    this.muteButton.textContent = muted ? "Sound off" : "Sound on";
  }

  setPrompt(station: StationId | null, blocked = false): void {
    if (!station) {
      this.prompt.classList.remove("show");
      this.crosshair.classList.remove("hot");
      return;
    }
    const info = STATION_INFO[station];
    clear(this.prompt);
    this.prompt.append(
      el("kbd", {}, ["E"]),
      document.createTextNode(` ${blocked ? "—" : "Open"} ${info.name}`),
    );
    this.prompt.classList.add("show");
    this.crosshair.classList.add("hot");
  }

  setEndEnabled(enabled: boolean, label: string): void {
    this.endButton.disabled = !enabled;
    this.endButton.textContent = label;
  }

  render(s: GameState): void {
    const cal = calendar(s.month);

    clear(this.date);
    this.date.append(
      el("div", { class: "date-line" }, [cal.label]),
      el("div", { class: "date-sub" }, [`Month ${s.month} of ${TERM_MONTHS}`]),
      el("div", { class: "term-track" }, [
        el("div", { class: "term-fill", style: `width:${(s.month / TERM_MONTHS) * 100}%` }),
      ]),
    );

    clear(this.power);
    const pips = el("div", { class: "ap-pips" });
    for (let i = 0; i < s.apMax; i += 1) {
      pips.append(el("div", { class: `pip ${i < s.ap ? "on" : ""}` }));
    }
    this.power.append(
      el("div", { class: "power-row" }, [
        el("span", { class: "power-label" }, ["Actions left"]),
        pips,
      ]),
      el("div", { class: "power-row" }, [
        el("span", { class: "power-label" }, ["Approval"]),
        el("span", { class: `power-value ${band(s.politics.approval, 50, 38)}` }, [
          `${Math.round(s.politics.approval)}%`,
        ]),
      ]),
      el("div", { class: "power-row" }, [
        el("span", { class: "power-label" }, ["Capital"]),
        el("span", { class: `power-value ${band(s.politics.capital, 40, 18)}` }, [
          Math.round(s.politics.capital).toString(),
        ]),
      ]),
    );

    clear(this.nation);
    const n = s.nation;
    this.nation.append(
      el("div", { class: "hud-title" }, ["The Nation"]),
      statLine("Growth", `${one(n.growth)}%`, band(n.growth, 2, 0.8)),
      statLine("Unemployment", `${one(n.unemployment)}%`, bandLow(n.unemployment, 5, 6.8)),
      statLine("Inflation", `${one(n.inflation)}%`, bandLow(n.inflation, 3, 4.5)),
      statLine("Debt / GDP", `${Math.round(n.debtToGdp)}%`, bandLow(n.debtToGdp, 105, 125)),
      statLine("Unrest", Math.round(n.unrest).toString(), bandLow(n.unrest, 40, 60)),
      statLine("Congress", `${Math.round((s.politics.house + s.politics.senate) / 2)}%`, band((s.politics.house + s.politics.senate) / 2, 50, 42)),
    );

    // What is running, in the country and upstairs. A strain in the family is
    // the same kind of thing as a war: it gets worse while you are elsewhere.
    const strained = (s.family ?? []).filter((m) => m.strain);
    clear(this.situations);
    const anything = s.threads.length > 0 || strained.length > 0;
    this.situations.style.display = anything ? "block" : "none";
    if (anything) {
      this.situations.append(el("div", { class: "hud-title" }, ["Running"]));
      for (const thread of s.threads.slice(0, 3)) {
        const severity = thread.intensity > 60 ? "bad" : thread.intensity > 30 ? "warn" : "ok";
        this.situations.append(
          el("div", { class: "situation", title: thread.detail }, [
            el("div", { class: "situation-head" }, [
              el("span", {}, [thread.label]),
              el("span", { class: `v ${severity}` }, [`${Math.round(thread.intensity)}`]),
            ]),
            el("div", { class: "meter-track" }, [
              el("div", { class: `meter-fill ${severity}`, style: `width:${thread.intensity}%` }),
            ]),
          ]),
        );
      }
      for (const member of strained.slice(0, 3)) {
        const strain = member.strain!;
        const severity = strain.severity > 60 ? "bad" : strain.severity > 30 ? "warn" : "ok";
        this.situations.append(
          el("div", { class: "situation", title: strain.detail }, [
            el("div", { class: "situation-head" }, [
              el("span", {}, [`${member.name} — ${strain.label}`]),
              el("span", { class: `v ${severity}` }, [`${Math.round(strain.severity)}`]),
            ]),
            el("div", { class: "meter-track" }, [
              el("div", { class: `meter-fill ${severity}`, style: `width:${strain.severity}%` }),
            ]),
          ]),
        );
      }
    }

    clear(this.strip);
    for (const [label, value, tone] of [
      ["Growth", `${one(n.growth)}%`, band(n.growth, 2, 0.8)],
      ["Jobless", `${one(n.unemployment)}%`, bandLow(n.unemployment, 5, 6.8)],
      ["Unrest", Math.round(n.unrest).toString(), bandLow(n.unrest, 40, 60)],
      ["Health", Math.round(s.personal.health).toString(), band(s.personal.health, 60, 40)],
      ["Stress", Math.round(s.personal.stress).toString(), bandLow(s.personal.stress, 45, 70)],
      ["Family", Math.round(s.personal.family).toString(), band(s.personal.family, 55, 35)],
    ] as const) {
      this.strip.append(
        el("div", { class: "strip-item" }, [
          el("span", { class: "k" }, [label]),
          el("span", { class: `v ${tone}` }, [value]),
        ]),
      );
    }

    clear(this.self);
    this.self.append(
      el("div", { class: "hud-title" }, ["You"]),
      meter("Health", s.personal.health),
      meter("Stress", s.personal.stress, true),
      meter("Marriage", s.personal.marriage),
      meter("Family", s.personal.family),
    );
  }
}
