import { Emitter } from "../core/emitter.ts";
import { Rng } from "../core/rng.ts";
import { ACTIONS, actionCooldownLeft, residenceActions } from "./actions.ts";
import { billCatalog, factionAftermath, forecastVote, holdVote, voteAftermath } from "./bills.ts";
import { createCabinet, crisisCompetence, replaceSecretary, tickCabinet } from "./cabinet.ts";
import { applyMidtermSwing } from "./congress.ts";
import { attend, createFamily, memberById, mostNeglected } from "./family.ts";
import { CRISES, applyConsequence, crisisPressure, eligibleCrises } from "./crises.ts";
import { CONVERSATIONS } from "./conversations.ts";
import type { CampaignDeltas } from "./campaign.ts";
import { applyEffects, describeEffects } from "./effects.ts";
import {
  buildEnding,
  checkFailState,
  isTermOver,
  updateDangerStreak,
} from "./endings.ts";
import { generateNews, pushNews } from "./news.ts";
import { createSimContext, simulateMonth } from "./sim.ts";
import type { MonthReport, SimContext } from "./sim.ts";
import {
  BUDGET_KEYS,
  ELECTION_MONTH,
  MIDTERM_MONTH,
  TERM_MONTHS,
  calendar,
  createInitialState,
  isBudgetMonth,
} from "./state.ts";
import type { NewGameOptions } from "./state.ts";
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
  OfficeAction,
  StationId,
} from "./types.ts";

export interface Outcome {
  title: string;
  text: string;
  effects: { text: string; good: boolean }[];
  tone: "good" | "bad" | "neutral";
}

interface EngineEvents {
  state: GameState;
  outcome: Outcome;
  crisis: Crisis;
  report: MonthReport;
  ended: Ending;
  reelectionQuestion: void;
}

export class Engine extends Emitter<EngineEvents> {
  state!: GameState;
  private rng!: Rng;
  private ctx!: SimContext;

  constructor(opts?: NewGameOptions) {
    super();
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
    this.log(
      "system",
      `Cabinet confirmed: ${this.state.cabinet.map((c) => c.name).join(", ")}.`,
    );
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
    const s = this.state;
    if (s.phase !== "playing") return false;
    // The residence's evenings are generated from the family, so they are not
    // in the static catalogue.
    const action =
      ACTIONS.find((a) => a.id === actionId) ??
      residenceActions(s).find((a) => a.id === actionId);
    if (!action) return false;
    if (s.ap < action.ap) return false;
    if ((action.capitalCost ?? 0) > s.politics.capital) return false;
    if (actionCooldownLeft(s, action) > 0) return false;

    s.ap -= action.ap;
    if (action.capitalCost) applyEffects(s, { "politics.capital": -action.capitalCost });
    applyEffects(s, action.effects);
    // An hour given to one person lands on that person, not on an average;
    // an evening with all of them lands on all of them.
    if (action.target && action.attention) {
      const people =
        action.target === "all" ? s.family : [memberById(s, action.target)];
      for (const member of people) if (member) attend(member, action.attention);
    }
    s.actionHistory[action.id] = s.month;
    this.log(action.station === "family" || action.station === "rest" ? "personal" : "policy", action.label);

    this.outcome({
      title: action.label,
      text: action.resultText,
      effects: describeEffects(this.effectsWithCost(action)),
      tone: "neutral",
    });
    return true;
  }

  private effectsWithCost(action: OfficeAction) {
    if (!action.capitalCost) return action.effects;
    const merged = { ...action.effects };
    merged["politics.capital"] = (merged["politics.capital"] ?? 0) - action.capitalCost;
    return merged;
  }

  // ----------------------------------------------------------- conversations

  /** Conversations open at a station right now — cooldown and availability, not cost. */
  conversationsFor(station: StationId): Conversation[] {
    return CONVERSATIONS.filter((c) => c.station === station && (!c.available || c.available(this.state)));
  }

  conversationCooldownLeft(conversation: Conversation): number {
    return actionCooldownLeft(this.state, conversation);
  }

  /** The conversation in progress, if a meeting is currently underway. */
  private activeConversation: {
    conversation: Conversation;
    beat: ConversationBeat;
    path: string[];
    totalShown: Effects;
  } | null = null;

  /** Options open to you at a beat, given how the conversation has gone so far. */
  optionsFor(beat: ConversationBeat, path: readonly string[]): ConversationOption[] {
    return beat.options.filter((o) => !o.requires || o.requires(path as string[]));
  }

  conversationOptionAffordable(option: ConversationOption): boolean {
    return (option.capitalCost ?? 0) <= this.state.politics.capital;
  }

  /** Starts a meeting, spending its entry cost, and returns its opening beat. */
  startConversation(id: string): { conversation: Conversation; beat: ConversationBeat } | null {
    const s = this.state;
    if (s.phase !== "playing") return null;
    const conv = CONVERSATIONS.find((c) => c.id === id);
    if (!conv) return null;
    if (s.ap < conv.ap) return null;
    if ((conv.capitalCost ?? 0) > s.politics.capital) return null;
    if (this.conversationCooldownLeft(conv) > 0) return null;
    if (conv.available && !conv.available(s)) return null;

    s.ap -= conv.ap;
    if (conv.capitalCost) applyEffects(s, { "politics.capital": -conv.capitalCost });
    s.actionHistory[conv.id] = s.month;
    const beat = conv.beats[conv.startBeat];
    this.activeConversation = { conversation: conv, beat, path: [], totalShown: {} };
    this.emit("state", s);
    return { conversation: conv, beat };
  }

  /**
   * Takes one line in the meeting under way. Returns the next beat, or a
   * closing result once there is nowhere further for the conversation to go.
   */
  chooseConversationOption(
    optionId: string,
  ): { beat: ConversationBeat | null; path: string[]; failed: boolean; text: string; totalEffects: Effects } | null {
    const s = this.state;
    const active = this.activeConversation;
    if (!active) return null;
    const option = this.optionsFor(active.beat, active.path).find((o) => o.id === optionId);
    if (!option || !this.conversationOptionAffordable(option)) return null;

    if (option.capitalCost) applyEffects(s, { "politics.capital": -option.capitalCost });
    const failed = option.risk !== undefined && this.rng.chance(option.risk);
    const effects = failed && option.onFail ? option.onFail : option.effects;
    applyEffects(s, effects);
    // An hour given to one person lands on that person; an evening with all
    // of them lands on all of them, the same as any other family action.
    if (option.target && option.attention) {
      const people = option.target === "all" ? s.family : [memberById(s, option.target)];
      for (const member of people) if (member) attend(member, option.attention);
    }
    const before = s.threads.map((t) => t.id);
    applyConsequence(s, failed && option.failConsequence ? option.failConsequence : option.consequence);
    for (const t of s.threads) {
      if (!before.includes(t.id)) this.log("crisis", `${t.label} begins.`);
    }
    if (option.modifier) {
      s.modifiers.push({
        id: option.modifier.id ?? `${active.conversation.id}-${option.id}`,
        label: option.modifier.label,
        months: option.modifier.months,
        perMonth: option.modifier.perMonth,
      });
    }

    const shown = { ...effects };
    if (option.capitalCost) shown["politics.capital"] = (shown["politics.capital"] ?? 0) - option.capitalCost;
    for (const [path, delta] of Object.entries(shown)) {
      if (typeof delta !== "number") continue;
      const key = path as keyof Effects;
      active.totalShown[key] = (active.totalShown[key] ?? 0) + delta;
    }
    active.path.push(option.id);

    const nextBeat = option.next ? active.conversation.beats[option.next] : undefined;
    if (nextBeat) {
      active.beat = nextBeat;
      this.emit("state", s);
      return { beat: nextBeat, path: [...active.path], failed, text: "", totalEffects: active.totalShown };
    }

    // The meeting is over: one result for the whole exchange, the way a
    // crisis resolves as one thing rather than a running commentary.
    this.log(
      active.conversation.station === "family" || active.conversation.station === "rest" ? "personal" : "policy",
      active.conversation.label,
    );
    const text = failed && option.failText ? option.failText : option.resultText;
    const totalEffects = active.totalShown;
    this.activeConversation = null;
    this.outcome({
      title: active.conversation.label,
      text,
      effects: describeEffects(totalEffects),
      tone: failed ? "bad" : "neutral",
    });
    return { beat: null, path: [...active.path], failed, text, totalEffects };
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
    const s = this.state;
    if (s.phase !== "playing") return false;
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return false;
    const total = bill.capitalCost + push;
    if (s.ap < 1 || s.politics.capital < total) return false;

    s.ap -= 1;
    applyEffects(s, { "politics.capital": -total });
    const result = holdVote(s, bill, push, this.rng);

    if (result.passed) {
      bill.status = "passed";
      applyEffects(s, bill.onPass);
      s.counters.billsPassed = (s.counters.billsPassed ?? 0) + 1;
      s.counters.legislatedSpending = (s.counters.legislatedSpending ?? 0) + bill.cost;
      this.log("policy", `${bill.title} signed into law.`);
      pushNews(s, [
        {
          month: s.month,
          headline: `${bill.title} passes; president signs in the East Room`,
          source: "Capitol Wire",
          tone: "good",
        },
      ]);
    } else {
      bill.status = "failed";
      bill.failedMonth = s.month;
      s.counters.billsFailed = (s.counters.billsFailed ?? 0) + 1;
      this.log("policy", `${bill.title} failed on the floor.`);
      pushNews(s, [
        {
          month: s.month,
          headline: `${bill.title} collapses on the floor; White House scrambles`,
          source: "The Beacon",
          tone: "bad",
        },
      ]);
    }

    const after = voteAftermath(bill, result);
    applyEffects(s, after);
    factionAftermath(s, bill, result.passed);

    const shown = { ...(result.passed ? bill.onPass : {}), ...after };
    shown["politics.capital"] = (shown["politics.capital"] ?? 0) - total;
    this.outcome({
      title: result.passed ? `${bill.title} — PASSED` : `${bill.title} — FAILED`,
      text: result.narrative,
      effects: describeEffects(shown),
      tone: result.passed ? "good" : "bad",
    });
    return true;
  }

  // ---------------------------------------------------------------- budget

  budgetPending(): boolean {
    return isBudgetMonth(this.state.month) && !this.state.flags[`budget${this.state.month}`];
  }

  /** Signs the fiscal year's appropriations. Costs one action point. */
  signBudget(budget: Record<BudgetKey, number>, taxRate: number): boolean {
    const s = this.state;
    if (!this.budgetPending() || s.ap < 1) return false;

    const oldTax = s.nation.taxRate;
    const taxDelta = taxRate - oldTax;
    s.ap -= 1;
    s.budget = { ...budget };
    s.enacted = { ...budget };
    s.nation.taxRate = Math.min(45, Math.max(6, taxRate));
    s.flags[`budget${s.month}`] = true;

    const effects: Effects = {};
    // Raising taxes is unpopular; cutting them buys short-term goodwill.
    if (Math.abs(taxDelta) > 0.05) {
      effects["politics.approval"] = -taxDelta * 2.2;
      effects["politics.party"] = taxDelta * (s.party === "blue" ? 2 : -2);
      effects["nation.growth"] = -taxDelta * 0.12;
      effects["nation.unrest"] = taxDelta * 1.2;
    }
    // A budget is a fight; passing one always costs something.
    effects["politics.capital"] = -6;
    effects["personal.stress"] = 6;
    applyEffects(s, effects);

    this.log("policy", `Signed the Year ${calendar(s.month).year} budget.`);
    this.outcome({
      title: `Year ${calendar(s.month).year} Budget Signed`,
      text:
        Math.abs(taxDelta) > 0.05
          ? `The appropriations are law, and the tax change is the lead paragraph in every story about them.`
          : `The appropriations are law. Nine agencies now know what they have to work with.`,
      effects: describeEffects(effects),
      tone: "neutral",
    });
    return true;
  }

  // ---------------------------------------------------------------- crises

  resolveCrisis(crisisId: string, choiceId: string): boolean {
    const s = this.state;
    const crisis = CRISES.find((c) => c.id === crisisId);
    if (!crisis || !s.pendingCrises.includes(crisisId)) return false;
    const choice = crisis.choices.find((c) => c.id === choiceId);
    if (!choice) return false;
    if (!this.affordable(crisis, choice)) return false;

    // Capital clamps at zero, so an unaffordable last resort simply empties it.
    if (choice.capitalCost) applyEffects(s, { "politics.capital": -choice.capitalCost });

    // A department that knows its business shaves the odds of it going wrong.
    const competence = crisisCompetence(this.state, crisis.tags);
    const risk =
      choice.risk === undefined
        ? undefined
        : Math.max(0.02, Math.min(0.95, choice.risk * (1 - (competence - 60) * 0.007)));
    const failed = risk !== undefined && this.rng.chance(risk);
    const effects = failed && choice.onFail ? choice.onFail : choice.effects;
    applyEffects(s, effects);

    // What the decision sets in motion, which may differ when it goes wrong.
    const before = s.threads.map((t) => t.id);
    applyConsequence(s, failed && choice.failConsequence ? choice.failConsequence : choice.consequence);
    for (const t of s.threads) {
      if (!before.includes(t.id)) this.log("crisis", `${t.label} begins.`);
    }

    if (choice.modifier) {
      s.modifiers.push({
        id: choice.modifier.id ?? `${crisisId}-${choiceId}`,
        label: choice.modifier.label,
        months: choice.modifier.months,
        perMonth: choice.modifier.perMonth,
      });
    }

    s.pendingCrises = s.pendingCrises.filter((id) => id !== crisisId);
    s.crisisHistory[crisisId] = s.month;
    s.counters.crisesHandled = (s.counters.crisesHandled ?? 0) + 1;
    this.log("crisis", `${crisis.title}: ${choice.label}.`);

    const shown = { ...effects };
    if (choice.capitalCost) {
      shown["politics.capital"] = (shown["politics.capital"] ?? 0) - choice.capitalCost;
    }
    this.outcome({
      title: crisis.title,
      text: failed && choice.failText ? choice.failText : choice.resultText,
      effects: describeEffects(shown),
      tone: failed ? "bad" : "good",
    });
    return true;
  }

  /**
   * Whether a crisis option can be taken. The cheapest option in a crisis is
   * always available, whatever the treasury looks like: a president with no
   * capital left still has to answer the phone, and a crisis nobody can
   * resolve would stall the term for good.
   */
  affordable(crisis: Crisis, choice: Choice): boolean {
    const cost = choice.capitalCost ?? 0;
    if (cost <= this.state.politics.capital) return true;
    const cheapest = Math.min(...crisis.choices.map((c) => c.capitalCost ?? 0));
    return cost === cheapest;
  }

  // ------------------------------------------------------------- month flow

  canEndMonth(): { ok: boolean; reason?: string } {
    if (this.state.phase !== "playing") return { ok: false, reason: "The term is over." };
    if (this.state.pendingCrises.length > 0) {
      return { ok: false, reason: "There is a decision on your desk that cannot wait." };
    }
    return { ok: true };
  }

  endMonth(): void {
    const s = this.state;
    const check = this.canEndMonth();
    if (!check.ok) return;

    // An unsigned budget means a continuing resolution: last year's numbers.
    if (this.budgetPending()) {
      s.flags[`budget${s.month}`] = true;
      applyEffects(s, {
        "politics.approval": -2.5,
        "politics.capital": -4,
        "nation.unrest": 2,
        "personal.stress": 5,
      });
      this.log("policy", "No budget signed; the government runs on a continuing resolution.");
      pushNews(s, [
        {
          month: s.month,
          headline: "Government funded by stopgap again as budget talks stall",
          source: "Capitol Wire",
          tone: "bad",
        },
      ]);
    }

    const crisisCount = s.counters.crisesThisMonth ?? 0;
    const report = simulateMonth(s, this.ctx, this.rng, crisisCount);
    s.counters.crisesThisMonth = 0;
    this.runCabinet(report);
    this.runBody(report);
    this.runResidence(report);

    s.history.push({
      month: s.month,
      approval: s.politics.approval,
      growth: s.nation.growth,
      unemployment: s.nation.unemployment,
      unrest: s.nation.unrest,
      health: s.personal.health,
    });

    s.month += 1;
    updateDangerStreak(s);

    if (s.month === MIDTERM_MONTH) this.runMidterms();

    const fail = checkFailState(s);
    if (fail || isTermOver(s)) {
      this.finish(fail);
      this.emit("report", report);
      return;
    }

    this.rollCrises();
    pushNews(s, generateNews(s, this.rng));

    if (s.month >= 34 && !s.flags.reelectionAsked) {
      s.flags.reelectionAsked = true;
      this.emit("reelectionQuestion", undefined);
    }

    this.emit("report", report);
    this.emit("state", s);
  }

  /**
   * The cabinet's month. People who have stopped believing in you either clear
   * their desk or find a reporter; either way it lands in the monthly brief.
   */
  private runCabinet(report: MonthReport): void {
    const s = this.state;
    for (const event of tickCabinet(s, this.rng)) {
      if (event.kind === "resigned") {
        const successor = replaceSecretary(this.rng, s.cabinet, event.person.office);
        applyEffects(s, {
          "politics.capital": -5,
          "politics.approval": -1.4,
          "politics.media": -3,
          "personal.stress": 5,
        });
        s.counters.resignations = (s.counters.resignations ?? 0) + 1;
        this.log("system", `${event.person.title} ${event.person.name} resigns; ${successor.name} sworn in.`);
        report.notes.push(`${event.person.name} is gone. ${successor.name} takes the department.`);
        pushNews(s, [
          {
            month: s.month,
            headline: `${event.person.name} resigns as ${event.person.title}, citing "differences of direction"`,
            source: "The Beacon",
            tone: "bad",
          },
        ]);
      } else {
        event.person.loyalty = Math.min(100, event.person.loyalty + 6); // the leak vents the pressure
        applyEffects(s, { "politics.scandal": 7, "politics.media": -5, "personal.stress": 4 });
        s.counters.leaks = (s.counters.leaks ?? 0) + 1;
        this.log("system", `A private meeting with ${event.person.name} appears in print.`);
        report.notes.push(`Someone in the room is talking to the press.`);
        pushNews(s, [
          {
            month: s.month,
            headline: `Leaked account of Oval Office meeting contradicts White House line`,
            source: "The Beacon",
            tone: "bad",
          },
        ]);
      }
    }
  }

  /**
   * The body's month. A full physical is what finds a condition before it
   * finds you; left long enough, exhaustion and a bad heart collect on their
   * own terms, and the country watches you do it.
   */
  private runBody(report: MonthReport): void {
    const s = this.state;
    const p = s.personal;

    // The physician cannot diagnose what you never let them look at.
    const lastPhysical = s.actionHistory["physical"];
    const looked = lastPhysical !== undefined && s.month - lastPhysical <= 2;
    if (!p.condition && looked) {
      const risk =
        (Math.max(0, p.age - 58) * 0.02 +
          Math.max(0, 55 - p.fitness) * 0.006 +
          Math.max(0, p.sleepDebt - 40) * 0.004) *
        (p.health < 55 ? 1.6 : 1);
      if (this.rng.chance(Math.min(0.6, risk))) {
        p.condition = this.rng.pick([
          "atrial fibrillation",
          "hypertension the letter called \"managed\"",
          "a coronary narrowing they want watched",
          "type 2 diabetes",
        ]);
        applyEffects(s, { "personal.stress": 8, "politics.media": -2 });
        this.log("personal", `Walter Reed finds ${p.condition}.`);
        report.notes.push(`The physical found something: ${p.condition}.`);
        this.outcome({
          title: "The Physical",
          text: `The letter the networks read out is two pages. The one your physician hands you privately is longer, and it names ${p.condition}. There is a plan. The plan involves the schedule.`,
          effects: describeEffects({ "personal.stress": 8, "politics.media": -2 }),
          tone: "bad",
        });
      }
    }

    // An episode: exhaustion, a heart, a body that has had enough.
    const episodeRisk =
      Math.max(0, p.sleepDebt - 62) * 0.004 +
      Math.max(0, 45 - p.health) * 0.005 +
      (p.condition ? 0.012 : 0) +
      Math.max(0, p.stress - 78) * 0.003;
    if (episodeRisk > 0 && this.rng.chance(Math.min(0.14, episodeRisk))) {
      const kind = p.condition
        ? "an episode the cardiology team had warned you about"
        : "a collapse in the residence corridor at four in the morning";
      applyEffects(s, {
        "personal.health": -9,
        "personal.stress": -14,
        "personal.sleepDebt": -35,
        "politics.capital": -8,
        "politics.approval": -2,
      });
      s.counters.healthEpisodes = (s.counters.healthEpisodes ?? 0) + 1;
      // A week at Walter Reed is a week you do not get back.
      s.ap = Math.max(0, s.ap - 1);
      this.log("personal", "A week at Walter Reed. The Vice President signs three things.");
      report.notes.push("You lost a week of the month to a hospital bed.");
      pushNews(s, [
        {
          month: s.month,
          headline: "President admitted to Walter Reed; White House says tests are precautionary",
          source: "Channel 8 Nightly",
          tone: "bad",
        },
      ]);
      this.outcome({
        title: "Walter Reed",
        text: `It is ${kind}. You wake up with a cannula in your arm and your chief of staff already in the room. The country is told it was precautionary. Your family is told the truth.`,
        effects: describeEffects({
          "personal.health": -9,
          "politics.capital": -8,
          "politics.approval": -2,
        }),
        tone: "bad",
      });
    }
  }

  /**
   * Upstairs. Nobody schedules this, so the month says once, plainly, who has
   * been waiting longest — and the country eventually notices a first family
   * that is never in the same room.
   */
  private runResidence(report: MonthReport): void {
    const s = this.state;
    const waiting = mostNeglected(s);
    if (waiting && waiting.since >= 4) {
      report.notes.push(
        `${waiting.name} has been waiting ${waiting.since} months for an evening.`,
      );
    }
    // A visibly absent family is a story, and a visibly close one is an asset.
    const closeness = (s.personal.marriage + s.personal.family) / 2;
    if (closeness < 38) {
      applyEffects(s, { "blocs.traditionalists": -0.9, "blocs.suburban": -0.5, "politics.media": -0.4 });
    } else if (closeness > 74) {
      applyEffects(s, { "blocs.traditionalists": 0.5, "blocs.suburban": 0.4, "politics.media": 0.3 });
    }
  }

  private runMidterms(): void {
    const s = this.state;
    // The president's party almost always loses ground at the midterms.
    const swing = (s.politics.approval - 50) * 0.55 + this.rng.range(-4, 4) - 4;
    applyEffects(s, { "politics.house": swing, "politics.senate": swing * 0.7 });
    // Seats actually change hands between the factions.
    applyMidtermSwing(s, swing);
    const won = swing > 0;
    this.log("system", `Midterm elections: ${won ? "gains" : "losses"} of ${Math.abs(swing).toFixed(1)} points.`);
    pushNews(s, [
      {
        month: s.month,
        headline: won
          ? "President's party defies history and holds the line at the midterms"
          : "Voters deliver a rebuke: opposition picks up seats in both chambers",
        source: "Channel 8 Nightly",
        tone: won ? "good" : "bad",
      },
    ]);
    this.outcome({
      title: "Midterm Elections",
      text: won
        ? "Your party holds. Nobody in this building can quite believe it, including you."
        : "Your party loses seats in both chambers. Every vote from here is harder than the last one was.",
      effects: describeEffects({
        "politics.house": swing,
        "politics.senate": swing * 0.7,
      }),
      tone: won ? "good" : "bad",
    });
  }

  private rollCrises(): void {
    const s = this.state;
    const pool = eligibleCrises(s);
    if (pool.length === 0) return;
    const totalPressure = pool.reduce((sum, c) => sum + crisisPressure(s, c), 0);
    const chance = Math.min(0.8, Math.max(0.15, 0.12 + totalPressure * 0.03));

    const fired: string[] = [];
    if (this.rng.chance(chance)) {
      const picked = this.rng.weighted(pool, (c) => c.weight * crisisPressure(s, c));
      if (picked) fired.push(picked.id);
    }
    // A second, rarer crisis when the country is genuinely under strain.
    if (fired.length === 1 && this.rng.chance(Math.min(0.25, totalPressure * 0.012))) {
      const rest = pool.filter((c) => !fired.includes(c.id));
      const second = this.rng.weighted(rest, (c) => c.weight * crisisPressure(s, c));
      if (second) fired.push(second.id);
    }

    s.pendingCrises = fired;
    s.counters.crisesThisMonth = fired.length;
    for (const id of fired) {
      const crisis = CRISES.find((c) => c.id === id)!;
      this.emit("crisis", crisis);
    }
  }

  setReelection(running: boolean): void {
    this.state.runningForReelection = running;
    this.log("system", running ? "You will seek a second term." : "You will not seek a second term.");
    if (!running) applyEffects(this.state, { "politics.capital": 10, "personal.stress": -8, "politics.party": -10 });
    this.emit("state", this.state);
  }

  private finish(fail: ReturnType<typeof checkFailState>): void {
    const s = this.state;
    s.phase = "ended";
    s.ending = buildEnding(s, this.rng, fail);
    this.emit("ended", s.ending);
    this.emit("state", s);
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
