import { STATION_INFO, STATION_ORDER } from "../game/actions.ts";
import { TERM_MONTHS, calendar } from "../game/state.ts";
import type { GameState, StationId } from "../game/types.ts";
import { clear, el, meter, one } from "./dom.ts";
import { band, bandLow, statLine } from "./panels/host.ts";

/**
 * The always-on overlay: date, action points, the nation, and you.
 *
 * The nation and self panels are collapsible drawers that slide in from the
 * screen edges, so the 3D scene is not permanently framed by two columns of
 * numbers. The station buttons and end-of-month actions live in one scrollable
 * dock at the bottom instead of two bulky clusters in the corners.
 */

/** Icon glyphs for the two edge tabs. Drawn inline so there is no icon font. */
const NATION_GLYPH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 19v-5M10 19V8M15 19v-7M20 19V5"/></svg>`;
const SELF_GLYPH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="7.5" r="3.4"/><path d="M5.5 20c1.4-3.6 3.7-5.1 6.5-5.1s5.1 1.5 6.5 5.1"/></svg>`;

function edgeTab(side: "left" | "right", glyph: string, label: string): HTMLButtonElement {
  return el("button", {
    class: `edge-tab edge-tab-${side}`,
    type: "button",
    title: label,
    "aria-label": label,
    "aria-expanded": "false",
    html: glyph,
  }) as HTMLButtonElement;
}

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
  private actions = el("div", { class: "dock-actions", id: "hud-actions" });
  private endButton: HTMLButtonElement;
  private legend = el("div", { class: "dock-stations", id: "hud-legend" });
  /** Situations currently running; hidden when the country is calm. */
  private situations = el("div", { class: "hud-card", id: "hud-situations" });
  private roomReveal = el("div", { id: "room-reveal", "aria-live": "polite" });
  private roomRevealTimer = 0;
  private muteButton: HTMLButtonElement;

  /** The slide-out homes of the two stat cards. */
  private nationDrawer = el("div", { class: "drawer drawer-left", id: "drawer-nation" });
  private selfDrawer = el("div", { class: "drawer drawer-right", id: "drawer-self" });
  private nationTab: HTMLButtonElement;
  private selfTab: HTMLButtonElement;
  private dock = el("nav", { class: "dock", "aria-label": "Quick actions" });

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

    // The two stat cards slide out from their edge tabs.
    this.nationDrawer.append(this.nation);
    this.selfDrawer.append(this.self);
    this.nationTab = edgeTab("left", NATION_GLYPH, "The Nation");
    this.selfTab = edgeTab("right", SELF_GLYPH, "You");
    this.nationTab.addEventListener("click", () => this.toggleDrawer(this.nationDrawer, this.nationTab));
    this.selfTab.addEventListener("click", () => this.toggleDrawer(this.selfDrawer, this.selfTab));

    this.dock.append(this.legend, this.actions);

    this.root = el("div", { id: "hud" }, [
      this.date,
      this.power,
      this.situations,
      this.roomReveal,
      this.nationDrawer,
      this.selfDrawer,
      this.nationTab,
      this.selfTab,
      this.dock,
    ]);
    document.body.append(this.crosshair, this.prompt);
  }

  private toggleDrawer(drawer: HTMLElement, tab: HTMLButtonElement): void {
    const open = drawer.classList.toggle("open");
    tab.classList.toggle("active", open);
    tab.setAttribute("aria-expanded", open ? "true" : "false");
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
    const congress = (s.politics.house + s.politics.senate) / 2;
    this.nation.append(
      el("div", { class: "hud-title" }, ["The Nation"]),
      statLine("Growth", `${one(n.growth)}%`, band(n.growth, 2, 0.8)),
      statLine("Unemployment", `${one(n.unemployment)}%`, bandLow(n.unemployment, 5, 6.8)),
      statLine("Inflation", `${one(n.inflation)}%`, bandLow(n.inflation, 3, 4.5)),
      statLine("Debt / GDP", `${Math.round(n.debtToGdp)}%`, bandLow(n.debtToGdp, 105, 125)),
      statLine("Unrest", Math.round(n.unrest).toString(), bandLow(n.unrest, 40, 60)),
      statLine("Congress", `${Math.round(congress)}%`, band(congress, 50, 42)),
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
        this.situations.append(
          situationRow(thread.label, thread.intensity, thread.detail),
        );
      }
      for (const member of strained.slice(0, 3)) {
        const strain = member.strain!;
        this.situations.append(
          situationRow(`${member.name} — ${strain.label}`, strain.severity, strain.detail),
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

/** One running situation: a label, a severity, and a bar. */
function situationRow(label: string, severity: number, detail: string): HTMLElement {
  const tone = severity > 60 ? "bad" : severity > 30 ? "warn" : "ok";
  return el("div", { class: "situation", title: detail }, [
    el("div", { class: "situation-head" }, [
      el("span", {}, [label]),
      el("span", { class: `v ${tone}` }, [`${Math.round(severity)}`]),
    ]),
    el("div", { class: "meter-track" }, [
      el("div", { class: `meter-fill ${tone}`, style: `width:${severity}%` }),
    ]),
  ]);
}
