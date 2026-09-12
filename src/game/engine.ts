import { Emitter } from "../core/emitter.ts";
import { Rng } from "../core/rng.ts";
import { actionCooldownLeft } from "./actions.ts";
import { billCatalog, forecastVote } from "./bills.ts";
import { createCabinet } from "./cabinet.ts";
import { createFamily } from "./family.ts";
import { CRISES } from "./crises.ts";
import { CONVERSATIONS, conversationById } from "./conversations.ts";
import type { CampaignDeltas } from "./campaign.ts";
import { applyEffects, describeEffects } from "./effects.ts";
import { buildEnding, checkFailState, isTermOver } from "./endings.ts";
import { generateNews, pushNews } from "./news.ts";
import { createSimContext } from "./sim.ts";
import type { MonthReport, SimContext } from "./sim.ts";
import { BUDGET_KEYS, ELECTION_MONTH, TERM_MONTHS, createInitialState } from "./state.ts";
import type { NewGameOptions } from "./state.ts";
import { endMonth as runMonth, isBudgetPending } from "./engineMonth.ts";
import { answerArc, arcBlocksMonth, pendingArc as pendingArcOf } from "./arcHooks.ts";
import {
  affordable,
  chooseConversationOption,
  optionsFor,
  performAction,
  proposeBill,
  resolveCrisis,
  setConversationLookup,
  signBudget,
  startConversation,
} from "./verbs.ts";
import type { ActiveConversation } from "./verbs.ts";
import type { Arc } from "./arcs.ts";
import type { Outcome } from "./outcome.ts";
import type {
  Bill,
  BudgetKey,
  Choice,
  Conversation,
  ConversationBeat,
  ConversationOption,
  Crisis,
  Effects,
  BlocKey,
  Ending,
  GameState,
  StationId,
} from "./types.ts";

export type { Outcome };

interface EngineEvents {
  state: GameState;
  outcome: Outcome;
  crisis: Crisis;
  arc: Arc;
  report: MonthReport;
  ended: Ending;
  reelectionQuestion: void;
}

/**
 * The engine owns the state and emits what happened. The rules of each verb
 * live in `verbs.ts`, the month in `engineMonth.ts`, and the arcs in
 * `arcHooks.ts` — this class is the seam between them and the UI.
 */
export class Engine extends Emitter<EngineEvents> {
  state!: GameState;
  private rng!: Rng;
  private ctx!: SimContext;
  private activeConversation: ActiveConversation | null = null;

  constructor(opts?: NewGameOptions) {
    super();
    // The conversation catalogue is injected rather than imported by `verbs`,
    // so the rules module does not depend on the content.
    setConversationLookup(conversationById);
    this.newGame(opts ?? { name: "President Vance", party: "blue" });
  }

  newGame(opts: NewGameOptions): void {
    this.state = createInitialState(opts);
    this.rng = new Rng(this.state.seed);
    this.ctx = createSimContext(this.rng);
    this.state.bills = billCatalog();
    this.state.cabinet = createCabinet(this.rng);
    this.state.family = createFamily(this.rng, this.state.personal.age);
    this.log("system", `You are sworn in as President of the United States.`);
    this.log("system", `Cabinet confirmed: ${this.state.cabinet.map((c) => c.name).join(", ")}.`);
    pushNews(this.state, generateNews(this.state, this.rng));
    this.emit("state", this.state);
  }

  /**
   * Folds the campaign's accumulated deltas into the freshly-sworn-in state,
   * so the numbers the presidency opens with carry the reason for them. Call
   * this once, right after `newGame`.
   */
  applyCampaignResult(deltas: CampaignDeltas, summary: string): void {
    const s = this.state;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    if (deltas.approval) s.politics.approval = clamp(s.politics.approval + deltas.approval);
    if (deltas.capital) s.politics.capital = clamp(s.politics.capital + deltas.capital);
    if (deltas.party) s.politics.party = clamp(s.politics.party + deltas.party);
    if (deltas.media) s.politics.media = clamp(s.politics.media + deltas.media);
    for (const [k, v] of Object.entries(deltas.blocs ?? {})) {
      const key = k as BlocKey;
      s.blocs[key] = clamp((s.blocs[key] ?? 50) + (v as number));
    }
    this.log("system", summary);
    pushNews(s, [{ month: s.month, headline: summary, source: "Election Night Wire", tone: "neutral" }]);
    this.emit("state", s);
  }

  /** Restores a saved game. Bills are rehydrated from the catalog by id. */
  loadFrom(state: GameState): void {
    const catalog = billCatalog();
    state.bills = catalog.map((b) => {
      const saved = state.bills.find((x) => x.id === b.id);
      return saved ? { ...b, status: saved.status, failedMonth: saved.failedMonth } : b;
    });
    this.state = state;
    this.rng = new Rng(state.seed ^ (state.month * 2654435761));
    if (!state.cabinet?.length) state.cabinet = createCabinet(this.rng);
    if (!state.family?.length) state.family = createFamily(this.rng, state.personal.age);
    // A save written before the body had parts would otherwise arithmetic to NaN.
    state.personal.sleepDebt ??= 22;
    state.personal.fitness ??= 62;
    // A save written before arcs existed has no field to read.
    state.pendingArc ??= null;
    this.ctx = createSimContext(this.rng, state.month);
    this.emit("state", this.state);
  }

  // ---------------------------------------------------------------- helpers

  private log(kind: "policy" | "personal" | "crisis" | "system", text: string): void {
    this.state.log.unshift({ month: this.state.month, text, kind });
    if (this.state.log.length > 120) this.state.log.length = 120;
  }

  private outcome(o: Outcome): void {
    this.emit("outcome", o);
    this.emit("state", this.state);
  }

  get pendingCrises(): Crisis[] {
    return this.state.pendingCrises
      .map((id) => CRISES.find((c) => c.id === id))
      .filter((c): c is Crisis => Boolean(c));
  }

  /** The story arc waiting on an answer, if there is one. */
  get pendingArc(): Arc | null {
    return pendingArcOf(this.state);
  }

  /** Bills the player may bring to the floor right now. */
  availableBills(): Bill[] {
    return this.state.bills.filter((b) => {
      if (b.status === "passed") return false;
      if (b.status === "failed" && this.state.month - (b.failedMonth ?? 0) < 6) return false;
      if (b.requires && !b.requires(this.state)) return false;
      return true;
    });
  }

  forecast(bill: Bill, push: number) {
    return forecastVote(this.state, bill, push);
  }

  // ---------------------------------------------------------------- actions

  performAction(actionId: string): boolean {
    const result = performAction(this.state, this.rng, actionId);
    if (!result) return false;
    for (const label of result.startedThreads) this.log("crisis", `${label} begins.`);
    this.outcome(result.outcome);
    return true;
  }

  // ----------------------------------------------------------- conversations

  /** Conversations open at a station right now — cooldown and availability, not cost. */
  conversationsFor(station: StationId): Conversation[] {
    return CONVERSATIONS.filter((c) => c.station === station && (!c.available || c.available(this.state)));
  }

  conversationCooldownLeft(conversation: Conversation): number {
    return actionCooldownLeft(this.state, conversation);
  }

  /** Options open to you at a beat, given how the conversation has gone so far. */
  optionsFor(beat: ConversationBeat, path: readonly string[]): ConversationOption[] {
    return optionsFor(beat, path);
  }

  conversationOptionAffordable(option: ConversationOption): boolean {
    return (option.capitalCost ?? 0) <= this.state.politics.capital;
  }

  /** Starts a meeting, spending its entry cost, and returns its opening beat. */
  startConversation(id: string): { conversation: Conversation; beat: ConversationBeat } | null {
    const started = startConversation(this.state, id, (c) => this.conversationCooldownLeft(c));
    if (!started) return null;
    this.activeConversation = {
      conversation: started.conversation,
      beat: started.beat,
      path: [],
      totalShown: {},
    };
    this.emit("state", this.state);
    return started;
  }

  /**
   * Takes one line in the meeting under way. Returns the next beat, or a
   * closing result once there is nowhere further for the conversation to go.
   */
  chooseConversationOption(
    optionId: string,
  ): { beat: ConversationBeat | null; path: string[]; failed: boolean; text: string; totalEffects: Effects } | null {
    const active = this.activeConversation;
    if (!active) return null;
    const result = chooseConversationOption(this.state, this.rng, active, optionId);
    if (!result) return null;
    for (const label of result.startedThreads) this.log("crisis", `${label} begins.`);

    if (result.beat) {
      this.emit("state", this.state);
      return {
        beat: result.beat,
        path: result.path,
        failed: result.failed,
        text: "",
        totalEffects: result.totalEffects,
      };
    }

    this.log(
      active.conversation.station === "family" || active.conversation.station === "rest"
        ? "personal"
        : "policy",
      active.conversation.label,
    );
    this.activeConversation = null;
    if (result.outcome) this.outcome(result.outcome);
    return {
      beat: null,
      path: result.path,
      failed: result.failed,
      text: result.text,
      totalEffects: result.totalEffects,
    };
  }

  /** Abandons a meeting early. Whatever was already said still happened. */
  endConversation(): void {
    this.activeConversation = null;
  }

  // ------------------------------------------------------------ legislation

  /**
   * Brings a bill to a vote. `push` is extra capital spent whipping votes on
   * top of the bill's entry cost.
   */
  proposeBill(billId: string, push: number): boolean {
    const outcome = proposeBill(this.state, this.rng, billId, push);
    if (!outcome) return false;
    this.outcome(outcome);
    return true;
  }

  // ---------------------------------------------------------------- budget

  budgetPending(): boolean {
    return isBudgetPending(this.state);
  }

  /** Signs the fiscal year's appropriations. Costs one action point. */
  signBudget(budget: Record<BudgetKey, number>, taxRate: number): boolean {
    if (!this.budgetPending()) return false;
    const outcome = signBudget(this.state, budget, taxRate);
    if (!outcome) return false;
    this.outcome(outcome);
    return true;
  }

  // ---------------------------------------------------------------- crises

  resolveCrisis(crisisId: string, choiceId: string): boolean {
    const crisis = CRISES.find((c) => c.id === crisisId);
    if (!crisis) return false;
    const result = resolveCrisis(this.state, this.rng, crisis, choiceId);
    if (!result) return false;
    for (const label of result.startedThreads) this.log("crisis", `${label} begins.`);
    this.outcome(result.outcome);
    return true;
  }

  affordable(crisis: Crisis, choice: Choice): boolean {
    return affordable(this.state, crisis, choice);
  }

  // ------------------------------------------------------------------ arcs

  /** Answers the story arc on the desk. */
  resolveArc(arcId: string, choiceId: string): boolean {
    if (this.state.pendingArc !== arcId) return false;
    const result = answerArc(this.state, this.rng, choiceId);
    if (!result) return false;
    this.log("system", `${result.arc.title}: answered.`);
    this.outcome({
      title: result.arc.title,
      text: result.text,
      effects: describeEffects(result.effects),
      tone: result.failed ? "bad" : "neutral",
    });
    return true;
  }

  // ------------------------------------------------------------- month flow

  canEndMonth(): { ok: boolean; reason?: string } {
    if (this.state.phase !== "playing") return { ok: false, reason: "The term is over." };
    if (this.state.pendingCrises.length > 0) {
      return { ok: false, reason: "There is a decision on your desk that cannot wait." };
    }
    if (arcBlocksMonth(this.state)) {
      return { ok: false, reason: "Something you did has caught up with you." };
    }
    return { ok: true };
  }

  endMonth(): void {
    if (!this.canEndMonth().ok) return;
    const result = runMonth(this.state, this.ctx, this.rng);

    for (const o of result.outcomes) this.emit("outcome", o);
    for (const crisis of result.crises) this.emit("crisis", crisis);
    if (result.arc) this.emit("arc", result.arc);

    if (result.ending) {
      this.emit("ended", result.ending);
      this.emit("report", result.report);
      this.emit("state", this.state);
      return;
    }

    if (result.askReelection) this.emit("reelectionQuestion", undefined);

    this.emit("report", result.report);
    this.emit("state", this.state);
  }

  setReelection(running: boolean): void {
    this.state.runningForReelection = running;
    this.log("system", running ? "You will seek a second term." : "You will not seek a second term.");
    if (!running) {
      applyEffects(this.state, { "politics.capital": 10, "personal.stress": -8, "politics.party": -10 });
    }
    this.emit("state", this.state);
  }

  /** Months remaining in the term, for the HUD. */
  get monthsLeft(): number {
    return Math.max(0, TERM_MONTHS - this.state.month + 1);
  }

  get isElectionYear(): boolean {
    return this.state.month >= ELECTION_MONTH - 12;
  }

  get budgetKeys(): BudgetKey[] {
    return BUDGET_KEYS;
  }
}
