import "./ui/style.css";
import { Engine } from "./game/engine.ts";
import type { Outcome } from "./game/engine.ts";
import { clearSave, hasSave, loadGame, saveGame } from "./game/save.ts";
import { STATION_ORDER } from "./game/actions.ts";
import { calendar } from "./game/state.ts";
import type { Crisis, Ending, GameState, Party, StationId } from "./game/types.ts";
import type { MonthReport } from "./game/sim.ts";
import { Hud } from "./ui/hud.ts";
import {
  PanelHost,
  billsPanel,
  budgetPanel,
  crisisPanel,
  dashboardPanel,
  endingPanel,
  reelectionPanel,
  reportPanel,
  stationPanel,
} from "./ui/panels.ts";
import { el } from "./ui/dom.ts";
import { MoveStick, isTouchDevice } from "./ui/touch.ts";
import { World } from "./world/scene.ts";

const canvas = document.getElementById("scene") as HTMLCanvasElement;

/** Modal factories waiting their turn, so events never stack on screen. */
type Modal = () => void;

class Game {
  private engine: Engine;
  private world: World;
  private hud: Hud;
  private host = new PanelHost();
  private queue: Modal[] = [];
  private nearest: StationId | null = null;
  private ended = false;
  private stick = new MoveStick();

  constructor(engine: Engine) {
    this.engine = engine;
    this.world = new World(canvas);
    this.hud = new Hud(
      () => this.endMonth(),
      () => this.open(() => dashboardPanel(this.engine, this.host)),
      (station) => {
        if (!this.host.isOpen && !this.ended) this.openStation(station);
      },
    );
    document.body.append(this.hud.root, this.stick.root);

    // Walking with a thumb. The stick only appears once a touch is seen.
    this.stick.onChange = (x, y) => {
      this.world.player.moveInput = { x, y };
    };
    if (isTouchDevice()) this.stick.enable();
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch") this.stick.enable();
      },
      { capture: true },
    );

    // Tapping or clicking a station in the room opens it.
    this.world.onStationTap = (station) => {
      if (!this.host.isOpen && !this.ended) this.openStation(station);
    };

    // Android's back button closes what is open rather than leaving the game.
    this.onBack = () => {
      if (this.ended) return false;
      if (this.host.isOpen) {
        this.host.close();
        return true;
      }
      return false;
    };

    this.host.onClose = () => {
      if (this.drain()) return;
      if (!this.ended) {
        this.world.player.enabled = true;
        this.hud.setPrompt(this.nearest);
        this.world.player.lock();
      }
    };

    this.world.onNearestChange = (station) => {
      this.nearest = station;
      this.hud.setPrompt(this.host.isOpen ? null : station);
    };

    engine.on("state", (s) => this.onState(s));
    engine.on("outcome", (o: Outcome) => this.host.toast(o));
    engine.on("crisis", (c: Crisis) => this.queue.push(() => this.open(() => crisisPanel(this.engine, c, this.host), true)));
    engine.on("report", (r: MonthReport) => this.queue.unshift(() => this.open(() => reportPanel(this.engine, r, this.host))));
    engine.on("reelectionQuestion", () =>
      this.queue.push(() => this.open(() => reelectionPanel(this.engine, this.host), true)),
    );
    engine.on("ended", (e: Ending) => this.showEnding(e));

    window.addEventListener("keydown", this.onKey);

    this.onState(engine.state);
    this.world.start();
    currentGame = this;
    // Any crises already waiting from a loaded save.
    for (const crisis of engine.pendingCrises) {
      this.queue.push(() => this.open(() => crisisPanel(this.engine, crisis, this.host), true));
    }
    this.drain();
  }

  /** Returns true when the press was handled and should not exit the app. */
  onBack: () => boolean = () => false;

  private onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Tab") {
      e.preventDefault();
      if (this.host.isOpen) this.host.close();
      else this.open(() => dashboardPanel(this.engine, this.host));
      return;
    }
    if (this.host.isOpen || this.ended) return;
    const digit = /^Digit([1-7])$/.exec(e.code);
    if (digit) {
      e.preventDefault();
      this.openStation(STATION_ORDER[Number(digit[1]) - 1]);
      return;
    }
    if (e.code === "KeyE" && this.nearest) {
      e.preventDefault();
      this.openStation(this.nearest);
    }
    if (e.code === "Enter") {
      e.preventDefault();
      this.endMonth();
    }
  };

  private openStation(station: StationId): void {
    this.world.focus(station);
    this.open(() =>
      stationPanel(
        this.engine,
        station,
        this.host,
        () => this.open(() => billsPanel(this.engine, this.host)),
        () => this.open(() => budgetPanel(this.engine, this.host)),
      ),
    );
  }

  private open(factory: () => HTMLElement, locked = false): void {
    this.world.player.enabled = false;
    this.world.player.unlock();
    this.hud.setPrompt(null);
    this.host.show(factory(), locked);
  }

  /** Shows the next queued modal. Returns true if one was shown. */
  private drain(): boolean {
    const next = this.queue.shift();
    if (!next) return false;
    next();
    return true;
  }

  private endMonth(): void {
    const check = this.engine.canEndMonth();
    if (!check.ok) return;
    this.engine.endMonth();
    this.drain();
  }

  private onState(s: GameState): void {
    this.hud.render(s);
    this.world.setMonth(s.month);
    this.world.stations.setBadge("desk", s.pendingCrises.length);
    this.world.stations.setBadge("budget", this.engine.budgetPending() ? 1 : 0);

    const check = this.engine.canEndMonth();
    this.hud.setEndEnabled(
      check.ok,
      check.ok ? `End ${calendar(s.month).monthName}` : "A decision is waiting",
    );
    if (s.phase === "playing") saveGame(s);
  }

  private showEnding(ending: Ending): void {
    this.ended = true;
    this.queue.length = 0;
    this.world.player.enabled = false;
    this.world.player.unlock();
    this.host.release();
    clearSave();
    document.body.append(
      endingPanel(this.engine.state, ending, () => {
        window.location.reload();
      }),
    );
  }
}

/** The running game, so the platform back button can reach it. */
let currentGame: Game | null = null;

/**
 * On Android the hardware back button should close a panel, not quit. The
 * Capacitor App plugin is only present in the native build, so it is loaded
 * lazily and its absence is not an error.
 */
async function wireHardwareBack(): Promise<void> {
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      void canGoBack;
      if (currentGame?.onBack()) return;
      void App.exitApp();
    });
  } catch {
    /* running in a browser; there is no hardware back button */
  }
}

// ------------------------------------------------------------ title screen

function titleScreen(): void {
  let party: Party = "blue";
  const nameInput = el("input", {
    type: "text",
    value: "President Reyes",
    maxlength: "34",
    placeholder: "Your name",
  }) as HTMLInputElement;

  const blue = el("button", { class: "party selected" }, [
    el("strong", {}, ["The Union Party"]),
    el("span", {}, ["Progressive base. Health, climate and labour play well at home."]),
  ]);
  const red = el("button", { class: "party" }, [
    el("strong", {}, ["The Heritage Party"]),
    el("span", {}, ["Conservative base. Defense, growth and enforcement play well at home."]),
  ]);
  blue.addEventListener("click", () => {
    party = "blue";
    blue.classList.add("selected");
    red.classList.remove("selected");
  });
  red.addEventListener("click", () => {
    party = "red";
    red.classList.add("selected");
    blue.classList.remove("selected");
  });

  const start = (state?: GameState) => {
    overlay.remove();
    const engine = state
      ? (() => {
          const e = new Engine({ name: state.presidentName, party: state.party });
          e.loadFrom(state);
          return e;
        })()
      : new Engine({ name: nameInput.value, party });
    new Game(engine);
  };

  const saved = hasSave() ? loadGame() : null;

  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "title-card" }, [
      el("div", { class: "title-mark" }, ["A single-player presidency"]),
      el("div", { class: "title-name" }, ["OVAL"]),
      el("div", { class: "title-tag" }, [
        "Four years. Forty-eight months. A budget nobody can balance, a Congress that owes you nothing, and a family upstairs who would like to see you occasionally.",
      ]),
      el("div", { class: "field" }, [el("label", {}, ["Your name"]), nameInput]),
      el("div", { class: "field" }, [
        el("label", {}, ["Your party"]),
        el("div", { class: "party-picker" }, [blue, red]),
      ]),
      el("div", { class: "title-actions" }, [
        el("button", { class: "btn primary", onclick: () => start() }, ["Take the oath"]),
        saved
          ? el("button", { class: "btn", onclick: () => start(saved) }, [
              `Continue — ${calendar(saved.month).label}`,
            ])
          : null,
      ]),
      el("div", { class: "help-list" }, [
        el("div", {}, [el("b", {}, ["Move"]), " — W A S D, mouse to look. Click to capture the mouse."]),
        el("div", {}, [el("b", {}, ["E"]), " — use whatever you are standing at."]),
        el("div", {}, [el("b", {}, ["Tab"]), " — the full dashboard. ", el("b", {}, ["Enter"]), " — end the month."]),
        el("div", {}, [
          "You get two or three actions a month, and rather more than three things that need doing.",
        ]),
      ]),
    ]),
  ]);
  document.body.append(overlay);
}

titleScreen();
void wireHardwareBack();
