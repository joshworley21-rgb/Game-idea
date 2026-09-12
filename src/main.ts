import "./ui/style.css";
import "./ui/consoleBanner.ts";
import { Engine } from "./game/engine.ts";
import type { Outcome } from "./game/outcome.ts";
import { clearSave, hasSave, loadGame, saveGame } from "./game/save.ts";
import { STATION_ORDER } from "./game/actions.ts";
import { calendar } from "./game/state.ts";
import { chiefReaction } from "./game/chief.ts";
import type { Arc } from "./game/arcs.ts";
import type { Crisis, Ending, GameState, StationId } from "./game/types.ts";
import type { MonthReport } from "./game/sim.ts";
import { Hud } from "./ui/hud.ts";
import { ChiefPanel } from "./ui/chiefPanel.ts";
import {
  PanelHost,
  arcPanel,
  billsPanel,
  budgetPanel,
  conversationPanel,
  crisisPanel,
  dashboardPanel,
  endingPanel,
  reelectionPanel,
  reportPanel,
  stationPanel,
} from "./ui/panels.ts";
import { el } from "./ui/dom.ts";
import { openingCutscene, titleScreen } from "./ui/screens.ts";
import { STATION_ROOM, World } from "./world/scene.ts";
import type { Door } from "./world/roomkit.ts";

const canvas = document.getElementById("scene") as HTMLCanvasElement;

/** Modal factories waiting their turn, so events never stack on screen. */
type Modal = () => void;

class Game {
  private engine: Engine;
  private world: World;
  private hud: Hud;
  private chief = new ChiefPanel();
  private host = new PanelHost();
  private queue: Modal[] = [];
  private nearest: StationId | null = null;
  private ended = false;
  /** True once the Oval model is on screen. */
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  /** The month the Chief of Staff last briefed, so she speaks once a month. */
  private briefedMonth = 0;

  constructor(engine: Engine) {
    this.engine = engine;
    this.world = new World(canvas);
    this.world.onReady = () => this.onWorldReady();
    this.hud = new Hud(
      () => this.endMonth(),
      () => this.open(() => dashboardPanel(this.engine, this.host)),
      (station) => {
        if (!this.host.isOpen && !this.ended) this.openStation(station);
      },
      () => this.world.sound.toggleMute(),
      () => this.world.toggleFreecam(),
    );
    document.body.append(this.hud.root, this.chief.root);

    // The oath click is the user gesture browsers require before audio starts.
    this.world.startAudio();
    this.hud.setMuted(this.world.sound.isMuted);

    // Tapping or clicking a station in the room opens it.
    this.world.onStationTap = (station) => {
      if (!this.host.isOpen && !this.ended) this.openStation(station);
    };
    // Tapping a door walks through it — there is no "E" key on a phone.
    this.world.onDoorTap = (door) => {
      if (!this.host.isOpen && !this.ended) this.walkThrough(door);
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
      this.world.sound.closePanel();
      if (this.drain()) return;
      if (!this.ended) {
        this.hud.setPrompt(this.nearest);
      }
    };

    this.world.onRoomChange = (_room, name) => this.hud.setRoom(name);
    this.hud.setRoom(this.world.roomName);

    this.world.onNearestChange = (station) => {
      this.nearest = station;
      this.hud.setPrompt(this.host.isOpen ? null : station);
    };

    engine.on("state", (s) => this.onState(s));
    engine.on("outcome", (o: Outcome) => {
      this.host.toast(o);
      const sound = this.world.sound;
      if (o.tone === "good") sound.good();
      else if (o.tone === "bad") sound.bad();
      else sound.paper();
    });
    engine.on("crisis", (c: Crisis) =>
      this.queue.push(() => {
        this.world.sound.alert();
        this.open(() => crisisPanel(this.engine, c, this.host), true);
      }),
    );
    // An arc is a consequence arriving, so it gets the same weight as a
    // crisis: it blocks the month and it cannot be dismissed.
    engine.on("arc", (a: Arc) =>
      this.queue.push(() => {
        this.world.sound.alert();
        this.open(() => arcPanel(this.engine, a, this.host), true);
      }),
    );
    engine.on("report", (r: MonthReport) =>
      this.queue.unshift(() => {
        this.world.sound.chime();
        this.open(() => reportPanel(this.engine, r, this.host));
      }),
    );
    engine.on("reelectionQuestion", () =>
      this.queue.push(() => this.open(() => reelectionPanel(this.engine, this.host), true)),
    );
    engine.on("ended", (e: Ending) => this.showEnding(e));

    window.addEventListener("keydown", this.onKey);

    this.onState(engine.state);
    this.world.start();
    currentGame = this;
    // A read-only handle, so a test can see what the renderer settled on.
    (window as unknown as { __oval?: unknown }).__oval = this.world;
    void this.furnish();
    // Any crises or arcs already waiting from a loaded save.
    for (const crisis of engine.pendingCrises) {
      this.queue.push(() => this.open(() => crisisPanel(this.engine, crisis, this.host), true));
    }
    const arc = engine.pendingArc;
    if (arc) {
      this.queue.push(() => this.open(() => arcPanel(this.engine, arc, this.host), true));
    }
    this.drain();
  }

  /** Returns true when the press was handled and should not exit the app. */
  onBack: () => boolean = () => false;

  /** Fires when the Oval is on screen. Releases the cutscene if it is waiting. */
  private onWorldReady(): void {
    this.ready = true;
    for (const fn of this.readyWaiters) fn();
    this.readyWaiters.length = 0;
  }

  /** Resolves once the Oval is visible, or immediately if it already is. */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => this.readyWaiters.push(resolve));
  }

  /**
   * Pulls in the furniture models. The room renders immediately and fills in
   * as they arrive, so a slow connection delays the furniture, not the game.
   */
  private async furnish(): Promise<void> {
    const note = el("div", { id: "loading-note" }, ["Preparing the executive complex…"]);
    document.body.append(note);
    try {
      await this.world.loadAssets(({ loaded, total }) => {
        note.textContent = `Preparing the executive complex… ${loaded}/${total}`;
      });
    } finally {
      note.style.opacity = "0";
      setTimeout(() => note.remove(), 600);
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Tab") {
      e.preventDefault();
      if (this.host.isOpen) this.host.close();
      else this.open(() => dashboardPanel(this.engine, this.host));
      return;
    }
    if (this.host.isOpen || this.ended) return;
    const digit = /^Digit([1-8])$/.exec(e.code);
    if (digit) {
      e.preventDefault();
      const station = STATION_ORDER[Number(digit[1]) - 1];
      // A number key now walks you to the room the station is actually in.
      if (station) this.goToStation(station);
      return;
    }
    if (e.code === "KeyE") {
      e.preventDefault();
      if (this.nearest) this.openStation(this.nearest);
    }
    if (e.code === "Enter") {
      e.preventDefault();
      this.endMonth();
    }
  };

  /** Walks into the room a station lives in, then opens it. */
  private goToStation(station: StationId): void {
    const moved = this.world.room !== STATION_ROOM[station];
    this.world.goToStation(station);
    if (moved) this.world.sound.paper();
    this.openStation(station);
  }

  /** Uses the door the player tapped. */
  private walkThrough(door: Door): void {
    if (!this.world.useDoor(door)) return;
    this.world.sound.paper();
    this.hud.setRoom(this.world.roomName);
    this.hud.setPrompt(null);
  }

  private openStation(station: StationId): void {
    this.open(() =>
      stationPanel(
        this.engine,
        station,
        this.host,
        () => this.open(() => billsPanel(this.engine, this.host)),
        () => this.open(() => budgetPanel(this.engine, this.host)),
        (id) => this.open(() => conversationPanel(this.engine, id, this.host)),
      ),
    );
  }

  private open(factory: () => HTMLElement, locked = false): void {
    this.world.sound.openPanel();
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
    this.world.syncPeople(s);
    this.world.stations.setBadge("desk", s.pendingCrises.length);
    this.world.stations.setBadge("budget", this.engine.budgetPending() ? 1 : 0);

    const check = this.engine.canEndMonth();
    this.hud.setEndEnabled(
      check.ok,
      check.ok ? `End ${calendar(s.month).monthName}` : "A decision is waiting",
    );

    // The Chief of Staff speaks once at the top of each month. She is not
    // shown while a modal is up, because she would be talking over it.
    if (s.month !== this.briefedMonth && !this.host.isOpen && !this.ended) {
      this.briefedMonth = s.month;
      this.chief.brief(s);
    }

    if (s.phase === "playing") saveGame(s);
  }

  /**
   * Her one-line reaction to a decision, if she has one. Called from the
   * outcome handler so it lands with the toast rather than after it.
   */
  private reactTo(id: string): void {
    if (this.host.isOpen || this.ended) return;
    if (!chiefReaction(id)) return;
    this.chief.react(id);
  }

  private showEnding(ending: Ending): void {
    this.ended = true;
    this.queue.length = 0;
    this.chief.hide();
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

// ------------------------------------------------------------ boot

titleScreen({
  saved: hasSave() ? loadGame() : null,
  onStart: ({ deltas, summary }) => {
    const engine = new Engine({ name: "President Reyes", party: "blue" });
    engine.applyCampaignResult(deltas, summary);
    const game = new Game(engine);
    openingCutscene(game.whenReady());
  },
  onContinue: (state) => {
    const engine = new Engine({ name: state.presidentName, party: state.party });
    engine.loadFrom(state);
    const game = new Game(engine);
    openingCutscene(game.whenReady());
  },
});

void wireHardwareBack();
