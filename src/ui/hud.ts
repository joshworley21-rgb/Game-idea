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
  private readonly touch = matchMedia("(pointer: coarse)").matches;
  private date = el("div", { class: "hud-card", id: "hud-date" });
  private roomName = "The Oval Office";
  private power = el("div", { class: "hud-card", id: "hud-power" });
  private nation = el("div", { class: "hud-card", id: "hud-nation" });
  private self = el("div", { class: "hud-card", id: "hud-self" });
  private prompt = el("div", { id: "prompt" });
  private crosshair = el("div", { id: "crosshair" });
  private actions = el("div", { class: "hud-card", id: "hud-actions" });
  private endButton: HTMLButtonElement;
  private legend = el("div", { class: "hud-card", id: "hud-legend" });
  /** Situations currently running; hidden when the country is calm. */
  private situations = el("div", { class: "hud-card", id: "hud-situations" });
  private roomReveal = el("div", { id: "room-reveal", "aria-live": "polite" });
  private roomRevealTimer = 0;

  private muteButton: HTMLButtonElement;

  constructor(
    onEndMonth: () => void,
    onDashboard: () => void,
    onStation: (station: StationId) => void,
    onToggleMute: () => boolean,
    onFreecam?: () => boolean,
  ) {
    this.endButton = el("button", { class: "btn primary", onclick: onEndMonth }, [
      "End the month",
    ]) as HTMLButtonElement;
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
        this.touch ? "Full stats" : "Dashboard (Tab)",
      ]),
      this.muteButton,
    );

    if (onFreecam) {
      const camButton = el("button", { class: "btn ghost small" }, ["Free camera"]) as HTMLButtonElement;
      camButton.addEventListener("click", () => {
        const active = onFreecam();
        camButton.textContent = active ? "Exit camera" : "Free camera";
      });
      this.actions.append(camButton);
    }

    // On a phone the number keys do not exist, so the legend is just a row of
    // tappable stations. On desktop the key hints are kept for keyboard play.
    STATION_ORDER.forEach((station, i) => {
      const children = this.touch
        ? [el("span", {}, [STATION_INFO[station].name])]
        : [el("kbd", {}, [String(i + 1)]), el("span", {}, [STATION_INFO[station].name])];
      this.legend.append(
        el("button", { class: "legend-row", onclick: () => onStation(station) }, children),
      );
    });

    this.root = el("div", { id: "hud" }, [
      this.date,
      this.power,
      this.nation,
      this.self,
      this.actions,
      this.legend,
      this.situations,
      this.roomReveal,
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
    if (this.touch) {
      this.prompt.append(document.createTextNode(blocked ? info.name : `Tap to open ${info.name}`));
    } else {
      this.prompt.append(el("kbd", {}, ["E"]), document.createTextNode(` ${blocked ? "—" : "Open"} ${info.name}`));
    }
    this.prompt.classList.add("show");
    this.crosshair.classList.add("hot");
  }

  setEndEnabled(enabled: boolean, label: string): void {
    this.endButton.disabled = !enabled;
    this.endButton.textContent = label;
  }

  /** Which room the president is standing in, shown under the date. */
  setRoom(name: string): void {
    this.roomName = name;
    const line = this.date.querySelector(".date-room");
    if (line) line.textContent = name;
    this.roomReveal.textContent = name;
    this.roomReveal.classList.remove("show");
    void this.roomReveal.offsetWidth;
    this.roomReveal.classList.add("show");
    window.clearTimeout(this.roomRevealTimer);
    this.roomRevealTimer = window.setTimeout(() => this.roomReveal.classList.remove("show"), 2400);
  }

  render(s: GameState): void {
    const cal = calendar(s.month);

    clear(this.date);
    this.date.append(
      el("div", { class: "date-line" }, [cal.label]),
      el("div", { class: "date-sub" }, [`Month ${s.month} of ${TERM_MONTHS}`]),
      el("div", { class: "date-room" }, [this.roomName]),
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
