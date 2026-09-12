import { ACTIONS, actionCooldownLeft, residenceActions } from "./actions.ts";
import { applyConsequence } from "./crises.ts";
import { applyEffects, describeEffects } from "./effects.ts";
import { attend, memberById } from "./family.ts";
import { holdVote, voteAftermath, factionAftermath } from "./bills.ts";
import { crisisCompetence } from "./cabinet.ts";
import { pushNews } from "./news.ts";
import { calendar } from "./state.ts";
import type { Outcome } from "./outcome.ts";
import type { Rng } from "../core/rng.ts";
import type {
  BudgetKey,
  Choice,
  Conversation,
  ConversationBeat,
  ConversationOption,
  Crisis,
  Effects,
  GameState,
} from "./types.ts";

/**
 * The engine's verbs: the things a player does.
 *
 * Split out of `engine.ts` so the class is a shell that owns state and emits
 * events, and the actual rules of each action are readable in one place.
 * Every function here takes the state and mutates it, returning what to show.
 */

// ---------------------------------------------------------------- actions

export function performAction(
  s: GameState,
  rng: Rng,
  actionId: string,
): { outcome: Outcome; startedThreads: string[] } | null {
  if (s.phase !== "playing") return null;
  // The residence's evenings are generated from the family, so they are not
  // in the static catalogue.
  const action =
    ACTIONS.find((a) => a.id === actionId) ?? residenceActions(s).find((a) => a.id === actionId);
  if (!action) return null;
  if (s.ap < action.ap) return null;
  if ((action.capitalCost ?? 0) > s.politics.capital) return null;
  if (actionCooldownLeft(s, action) > 0) return null;

  s.ap -= action.ap;
  if (action.capitalCost) applyEffects(s, { "politics.capital": -action.capitalCost });

  // Same shape as a crisis choice: a chance this backfires, and what it
  // sets in motion either way — so a decision made here can still be
  // paying (or costing) something months from now, not just this month.
  const failed = action.risk !== undefined && rng.chance(action.risk);
  const effects = failed && action.onFail ? action.onFail : action.effects;
  applyEffects(s, effects);
  const before = s.threads.map((t) => t.id);
  applyConsequence(s, failed && action.failConsequence ? action.failConsequence : action.consequence);
  const startedThreads = s.threads.filter((t) => !before.includes(t.id)).map((t) => t.label);

  // An hour given to one person lands on that person, not on an average;
  // an evening with all of them lands on all of them.
  if (action.target && action.attention) {
    const people = action.target === "all" ? s.family : [memberById(s, action.target)];
    for (const member of people) if (member) attend(member, action.attention);
  }
  s.actionHistory[action.id] = s.month;

  const shown = { ...effects };
  if (action.capitalCost) shown["politics.capital"] = (shown["politics.capital"] ?? 0) - action.capitalCost;
  return {
    outcome: {
      title: action.label,
      text: failed && action.failText ? action.failText : action.resultText,
      effects: describeEffects(shown),
      tone: failed ? "bad" : "neutral",
    },
    startedThreads,
  };
}

// ----------------------------------------------------------- conversations

export interface ActiveConversation {
  conversation: Conversation;
  beat: ConversationBeat;
  path: string[];
  totalShown: Effects;
}

/**
 * The flags a finished meeting sets. A meeting that has happened is a fact
 * about the term, and the Chief of Staff's list of outstanding obligations
 * reads these to know what is still owed.
 */
const CONVERSATION_FLAGS: Record<string, string> = {
  "first-cabinet": "met:cabinet",
  "address-house": "addressed:house",
};

export function startConversation(
  s: GameState,
  id: string,
  cooldownLeft: (c: Conversation) => number,
): { conversation: Conversation; beat: ConversationBeat } | null {
  if (s.phase !== "playing") return null;
  const conv = CONVERSATIONS_LOOKUP(id);
  if (!conv) return null;
  if (s.ap < conv.ap) return null;
  if ((conv.capitalCost ?? 0) > s.politics.capital) return null;
  if (cooldownLeft(conv) > 0) return null;
  if (conv.available && !conv.available(s)) return null;

  s.ap -= conv.ap;
  if (conv.capitalCost) applyEffects(s, { "politics.capital": -conv.capitalCost });
  s.actionHistory[conv.id] = s.month;
  return { conversation: conv, beat: conv.beats[conv.startBeat] };
}

/** Injected by the engine so this module does not import the catalogue. */
let CONVERSATIONS_LOOKUP: (id: string) => Conversation | undefined = () => undefined;
export function setConversationLookup(fn: (id: string) => Conversation | undefined): void {
  CONVERSATIONS_LOOKUP = fn;
}

export function optionsFor(beat: ConversationBeat, path: readonly string[]): ConversationOption[] {
  return beat.options.filter((o) => !o.requires || o.requires(path as string[]));
}

export function chooseConversationOption(
  s: GameState,
  rng: Rng,
  active: ActiveConversation,
  optionId: string,
): {
  beat: ConversationBeat | null;
  path: string[];
  failed: boolean;
  text: string;
  totalEffects: Effects;
  outcome: Outcome | null;
  startedThreads: string[];
} | null {
  const option = optionsFor(active.beat, active.path).find((o) => o.id === optionId);
  if (!option) return null;
  if ((option.capitalCost ?? 0) > s.politics.capital) return null;

  if (option.capitalCost) applyEffects(s, { "politics.capital": -option.capitalCost });
  const failed = option.risk !== undefined && rng.chance(option.risk);
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
  const startedThreads = s.threads.filter((t) => !before.includes(t.id)).map((t) => t.label);
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
    return {
      beat: nextBeat,
      path: [...active.path],
      failed,
      text: "",
      totalEffects: active.totalShown,
      outcome: null,
      startedThreads,
    };
  }

  // The meeting is over: one result for the whole exchange, the way a
  // crisis resolves as one thing rather than a running commentary.
  const flag = CONVERSATION_FLAGS[active.conversation.id];
  if (flag) s.flags[flag] = true;

  const text = failed && option.failText ? option.failText : option.resultText;
  return {
    beat: null,
    path: [...active.path],
    failed,
    text,
    totalEffects: active.totalShown,
    outcome: {
      title: active.conversation.label,
      text,
      effects: describeEffects(active.totalShown),
      tone: failed ? "bad" : "neutral",
    },
    startedThreads,
  };
}

// ------------------------------------------------------------ legislation

export function proposeBill(
  s: GameState,
  rng: Rng,
  billId: string,
  push: number,
): Outcome | null {
  if (s.phase !== "playing") return null;
  const bill = s.bills.find((b) => b.id === billId);
  if (!bill) return null;
  const total = bill.capitalCost + push;
  if (s.ap < 1 || s.politics.capital < total) return null;

  s.ap -= 1;
  applyEffects(s, { "politics.capital": -total });
  const result = holdVote(s, bill, push, rng);

  if (result.passed) {
    bill.status = "passed";
    applyEffects(s, bill.onPass);
    s.counters.billsPassed = (s.counters.billsPassed ?? 0) + 1;
    s.counters.legislatedSpending = (s.counters.legislatedSpending ?? 0) + bill.cost;
    s.log.unshift({ month: s.month, text: `${bill.title} signed into law.`, kind: "policy" });
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
    s.log.unshift({ month: s.month, text: `${bill.title} failed on the floor.`, kind: "policy" });
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
  return {
    title: result.passed ? `${bill.title} — PASSED` : `${bill.title} — FAILED`,
    text: result.narrative,
    effects: describeEffects(shown),
    tone: result.passed ? "good" : "bad",
  };
}

// ---------------------------------------------------------------- budget

export function signBudget(
  s: GameState,
  budget: Record<BudgetKey, number>,
  taxRate: number,
): Outcome | null {
  if (s.ap < 1) return null;

  const oldTax = s.nation.taxRate;
  const taxDelta = taxRate - oldTax;
  s.ap -= 1;
  s.budget = { ...budget };
  s.enacted = { ...budget };
  s.nation.taxRate = Math.min(45, Math.max(6, taxRate));
  s.flags[`budget${s.month}`] = true;
  // The Chief of Staff's list of outstanding obligations reads this.
  s.flags["budget:signed"] = true;

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

  s.log.unshift({
    month: s.month,
    text: `Signed the Year ${calendar(s.month).year} budget.`,
    kind: "policy",
  });
  return {
    title: `Year ${calendar(s.month).year} Budget Signed`,
    text:
      Math.abs(taxDelta) > 0.05
        ? `The appropriations are law, and the tax change is the lead paragraph in every story about them.`
        : `The appropriations are law. Nine agencies now know what they have to work with.`,
    effects: describeEffects(effects),
    tone: "neutral",
  };
}

// ---------------------------------------------------------------- crises

export function resolveCrisis(
  s: GameState,
  rng: Rng,
  crisis: Crisis,
  choiceId: string,
): { outcome: Outcome; startedThreads: string[] } | null {
  if (!s.pendingCrises.includes(crisis.id)) return null;
  const choice = crisis.choices.find((c) => c.id === choiceId);
  if (!choice) return null;
  if (!affordable(s, crisis, choice)) return null;

  // Capital clamps at zero, so an unaffordable last resort simply empties it.
  if (choice.capitalCost) applyEffects(s, { "politics.capital": -choice.capitalCost });

  // A department that knows its business shaves the odds of it going wrong.
  const competence = crisisCompetence(s, crisis.tags);
  const risk =
    choice.risk === undefined
      ? undefined
      : Math.max(0.02, Math.min(0.95, choice.risk * (1 - (competence - 60) * 0.007)));
  const failed = risk !== undefined && rng.chance(risk);
  const effects = failed && choice.onFail ? choice.onFail : choice.effects;
  applyEffects(s, effects);

  // What the decision sets in motion, which may differ when it goes wrong.
  const before = s.threads.map((t) => t.id);
  applyConsequence(s, failed && choice.failConsequence ? choice.failConsequence : choice.consequence);
  const startedThreads = s.threads.filter((t) => !before.includes(t.id)).map((t) => t.label);

  if (choice.modifier) {
    s.modifiers.push({
      id: choice.modifier.id ?? `${crisis.id}-${choiceId}`,
      label: choice.modifier.label,
      months: choice.modifier.months,
      perMonth: choice.modifier.perMonth,
    });
  }

  s.pendingCrises = s.pendingCrises.filter((id) => id !== crisis.id);
  s.crisisHistory[crisis.id] = s.month;
  s.counters.crisesHandled = (s.counters.crisesHandled ?? 0) + 1;
  s.log.unshift({ month: s.month, text: `${crisis.title}: ${choice.label}.`, kind: "crisis" });

  const shown = { ...effects };
  if (choice.capitalCost) {
    shown["politics.capital"] = (shown["politics.capital"] ?? 0) - choice.capitalCost;
  }
  return {
    outcome: {
      title: crisis.title,
      text: failed && choice.failText ? choice.failText : choice.resultText,
      effects: describeEffects(shown),
      tone: failed ? "bad" : "good",
    },
    startedThreads,
  };
}

/**
 * Whether a crisis option can be taken. The cheapest option in a crisis is
 * always available, whatever the treasury looks like: a president with no
 * capital left still has to answer the phone, and a crisis nobody can
 * resolve would stall the term for good.
 */
export function affordable(s: GameState, crisis: Crisis, choice: Choice): boolean {
  const cost = choice.capitalCost ?? 0;
  if (cost <= s.politics.capital) return true;
  const cheapest = Math.min(...crisis.choices.map((c) => c.capitalCost ?? 0));
  return cost === cheapest;
}
