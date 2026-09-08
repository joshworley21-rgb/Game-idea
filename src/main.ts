import "./ui/style.css";
import { Engine } from "./game/engine.ts";
import type { Outcome } from "./game/engine.ts";
import { clearSave, hasSave, loadGame, saveGame } from "./game/save.ts";
import { STATION_INFO, STATION_ORDER } from "./game/actions.ts";
import { calendar } from "./game/state.ts";
import { CAMPAIGN_INTRO, CAMPAIGN_START, campaignBeats, mergeCampaignDeltas } from "./game/campaign.ts";
import type { CampaignDeltas } from "./game/campaign.ts";
import type { Crisis, Ending, GameState, Party, StationId } from "./game/types.ts";
import type { MonthReport } from "./game/sim.ts";
import { Hud } from "./ui/hud.ts";
import {
  PanelHost,
  billsPanel,
  budgetPanel,
  conversationPanel,
  crisisPanel,
  dashboardPanel,
  endingPanel,
  reelectionPanel,
  reportPanel,
  rosterPanel,
  stationPanel,
} from "./ui/panels.ts";
import { clear, el } from "./ui/dom.ts";
import { TravelVeil } from "./ui/travel.ts";
import { World } from "./world/scene.ts";
import type { Door } from "./world/roomkit.ts";

const canvas = document.getElementById("scene") as HTMLCanvasElement;

/** Modal factories waiting their turn, so events never stack on screen. */
type Modal = () => void;

class Game {
  private engine: Engine;
  private world: World;
  private hud: Hud;
  private host = new PanelHost();
  private queue: Modal[] = [];
  private ended = false;
  private travelVeil = new TravelVeil();

  constructor(engine: Engine) {
    this.engine = engine;
    this.world = new World(canvas);
    this.hud = new Hud(
      () => this.endMonth(),
      () => this.open(() => dashboardPanel(this.engine, this.host)),
      () => this.open(() => rosterPanel(this.host)),
      (station) => {
        if (!this.host.isOpen && !this.ended) this.visitStation(station);
      },
      () => this.world.sound.toggleMute(),
    );
    document.body.append(this.hud.root, this.travelVeil.root);

    // The oath click is the user gesture browsers require before audio starts.
    this.world.startAudio();
    this.hud.setMuted(this.world.sound.isMuted);

    // Tapping or clicking a station in the room opens it.
    this.world.onStationTap = (station) => {
      if (!this.host.isOpen && !this.ended) this.visitStation(station);
    };
    // Tapping or clicking a door heads through it.
    this.world.onDoorTap = (door) => {
      if (!this.host.isOpen && !this.ended) this.travelThroughDoor(door);
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
      if (!this.ended) this.world.player.enabled = true;
    };

    this.world.onRoomChange = (_room, name) => this.hud.setRoom(name);
    this.hud.setRoom(this.world.roomName);

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
    // Any crises already waiting from a loaded save.
    for (const crisis of engine.pendingCrises) {
      this.queue.push(() => this.open(() => crisisPanel(this.engine, crisis, this.host), true));
    }
    this.drain();
  }

  /** Returns true when the press was handled and should not exit the app. */
  onBack: () => boolean = () => false;

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
    if (e.code === "KeyR" && !this.ended) {
      e.preventDefault();
      if (this.host.isOpen) this.host.close();
      else this.open(() => rosterPanel(this.host));
      return;
    }
    if (this.host.isOpen || this.ended) return;
    const digit = /^Digit([1-8])$/.exec(e.code);
    if (digit) {
      e.preventDefault();
      const station = STATION_ORDER[Number(digit[1]) - 1];
      if (station) this.visitStation(station);
      return;
    }
    if (e.code === "Enter") {
      e.preventDefault();
      this.endMonth();
    }
  };

  /**
   * Heads to a station: an animated camera pan if it is in the room the
   * president is already in, or a cut — a travel line held over black, the
   * same one a door uses — if it means changing rooms first.
   */
  private visitStation(station: StationId): void {
    const targetRoom = this.world.roomOfStation(station);
    if (this.world.room === targetRoom) {
      this.world.panToStation(station);
      this.openStation(station);
      return;
    }
    this.world.sound.paper();
    void this.travelVeil
      .play(`Walking to ${STATION_INFO[station].name}…`, () => {
        this.world.enterRoom(targetRoom);
        this.world.snapToStation(station);
      })
      .then(() => {
        if (!this.host.isOpen && !this.ended) this.openStation(station);
      });
  }

  /** Cuts to the room on the other side of a door. */
  private travelThroughDoor(door: Door): void {
    this.world.sound.paper();
    void this.travelVeil.play(`Walking to ${door.label}…`, () => {
      this.world.enterRoom(door.to);
    });
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
    this.world.player.enabled = false;
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
    if (s.phase === "playing") saveGame(s);
  }

  private showEnding(ending: Ending): void {
    this.ended = true;
    this.queue.length = 0;
    this.world.player.enabled = false;
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

  const overlay = el("div", { class: "overlay" });
  document.body.append(overlay);

  const start = (state?: GameState, campaign?: { deltas: CampaignDeltas; summary: string }) => {
    overlay.remove();
    const engine = state
      ? (() => {
          const e = new Engine({ name: state.presidentName, party: state.party });
          e.loadFrom(state);
          return e;
        })()
      : new Engine({ name: nameInput.value.trim() || "President Reyes", party });
    if (!state && campaign) engine.applyCampaignResult(campaign.deltas, campaign.summary);
    new Game(engine);
  };

  const saved = hasSave() ? loadGame() : null;

  const showPicker = () => {
    clear(overlay);
    overlay.append(
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
          el(
            "button",
            {
              class: "btn primary",
              onclick: () => campaignScreen(overlay, party, (deltas, summary) => start(undefined, { deltas, summary })),
            },
            ["Run for it"],
          ),
          saved
            ? el("button", { class: "btn", onclick: () => start(saved) }, [
                `Continue — ${calendar(saved.month).label}`,
              ])
            : null,
        ]),
        el("div", { class: "help-list" }, [
          el("div", {}, [el("b", {}, ["Look"]), " — drag anywhere to look around."]),
          el("div", {}, [el("b", {}, ["Go"]), " — tap a door or a station and the camera takes you there."]),
          el("div", {}, [el("b", {}, ["Full stats"]), " and ", el("b", {}, ["End the month"]), " are the buttons in the bar below."]),
          el("div", {}, [
            "You get two or three actions a month, and rather more than three things that need doing.",
          ]),
        ]),
      ]),
    );
  };

  showPicker();
}

/**
 * The six weeks before the oath, played out beat by beat in the same overlay
 * the picker used. `onDone` fires once with the campaign's accumulated
 * deltas and a one-line summary once election night resolves.
 */
function campaignScreen(
  overlay: HTMLElement,
  party: Party,
  onDone: (deltas: CampaignDeltas, summary: string) => void,
): void {
  const beats = campaignBeats(party);
  const taken: CampaignDeltas[] = [];
  const path: string[] = [];

  const renderBeat = (beatId: string) => {
    const beat = beats[beatId];
    clear(overlay);
    overlay.append(
      el("div", { class: "title-card" }, [
        el("div", { class: "title-mark" }, [beat.speaker]),
        el("div", { class: "title-tag" }, [beat.prompt]),
        el(
          "div",
          { class: "option-grid", style: "text-align:left;margin-top:20px" },
          beat.options
            .filter((o) => !o.requires || o.requires(path))
            .map((option) =>
              el(
                "button",
                {
                  class: "option",
                  onclick: () => {
                    taken.push(option.deltas);
                    path.push(option.id);
                    if (option.next) renderBeat(option.next);
                    else renderResult(option.resultText);
                  },
                },
                [
                  el("div", { class: "option-top" }, [el("span", { class: "option-label" }, [option.label])]),
                  el("div", { class: "option-detail" }, [option.detail]),
                ],
              ),
            ),
        ),
      ]),
    );
  };

  const renderResult = (lastText: string) => {
    const total = mergeCampaignDeltas(taken);
    const margin = 4 + (total.approval ?? 0) * 0.6 + (total.party ?? 0) * 0.25;
    const summary =
      margin >= 0
        ? `Won a close one — up by roughly ${Math.round(margin)} points on the night.`
        : `Pulled it out anyway, down to the wire and short in the polls all October.`;
    clear(overlay);
    overlay.append(
      el("div", { class: "title-card" }, [
        el("div", { class: "title-mark" }, ["Election night"]),
        el("div", { class: "title-tag" }, [lastText]),
        el("div", { class: "title-tag", style: "margin-top:10px" }, [summary]),
        el("div", { class: "title-actions" }, [
          el("button", { class: "btn primary", onclick: () => onDone(total, summary) }, ["Take the oath"]),
        ]),
      ]),
    );
  };

  clear(overlay);
  overlay.append(
    el("div", { class: "title-card" }, [
      el("div", { class: "title-mark" }, ["Before the oath"]),
      el("div", { class: "title-tag" }, [CAMPAIGN_INTRO]),
      el("div", { class: "title-actions" }, [
        el("button", { class: "btn primary", onclick: () => renderBeat(CAMPAIGN_START) }, ["Begin"]),
      ]),
    ]),
  );
}

titleScreen();
void wireHardwareBack();
