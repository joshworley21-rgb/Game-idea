import { Emitter } from "../core/emitter.ts";
import { Rng } from "../core/rng.ts";
import { ACTIONS, actionCooldownLeft } from "./actions.ts";
import { billCatalog, forecastVote, holdVote, voteAftermath } from "./bills.ts";
import { CRISES, applyConsequence, crisisPressure, eligibleCrises } from "./crises.ts";
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
  Crisis,
  Effects,
  Ending,
  GameState,
  OfficeAction,
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
    this.log("system", `You are sworn in as President of the United States.`);
    pushNews(this.state, generateNews(this.state, this.rng));
    this.emit("state", this.state);
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
    const action = ACTIONS.find((a) => a.id === actionId);
    if (!action) return false;
    if (s.ap < action.ap) return false;
    if ((action.capitalCost ?? 0) > s.politics.capital) return false;
    if (actionCooldownLeft(s, action) > 0) return false;

    s.ap -= action.ap;
    if (action.capitalCost) applyEffects(s, { "politics.capital": -action.capitalCost });
    applyEffects(s, action.effects);
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

    const failed = choice.risk !== undefined && this.rng.chance(choice.risk);
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

  private runMidterms(): void {
    const s = this.state;
    // The president's party almost always loses ground at the midterms.
    const swing = (s.politics.approval - 50) * 0.55 + this.rng.range(-4, 4) - 4;
    applyEffects(s, { "politics.house": swing, "politics.senate": swing * 0.7 });
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
