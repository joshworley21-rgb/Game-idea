/**
 * Headless balance harness. Plays the term with a few crude strategies and
 * prints where the numbers end up. Run with: npm run balance
 */
import { Engine } from "../game/engine.ts";
import { scoreLegacy } from "../game/endings.ts";
import { Rng } from "../core/rng.ts";
import { ACTIONS, actionCooldownLeft } from "../game/actions.ts";
import { START_BUDGET, annualDeficit, annualRevenue } from "../game/state.ts";
import type { GameState } from "../game/types.ts";

type Strategy = "idle" | "workaholic" | "balanced" | "family-first";

function pickAction(s: GameState, strat: Strategy, rng: Rng): string | null {
  const prefer: Record<Strategy, string[]> = {
    idle: [],
    workaholic: ["cabinet", "whip", "address", "summit", "rally", "executive-order", "intel-brief"],
    balanced: ["cabinet", "family-dinner", "address", "sleep", "whip", "date-night", "exercise", "call-ally"],
    "family-first": ["family-dinner", "date-night", "camp-david", "sleep", "exercise", "kids-call", "cabinet"],
  };
  const list = prefer[strat];
  const usable = list
    .map((id) => ACTIONS.find((a) => a.id === id)!)
    .filter(
      (a) =>
        a.ap <= s.ap &&
        (a.capitalCost ?? 0) <= s.politics.capital &&
        actionCooldownLeft(s, a) === 0 &&
        (!a.available || a.available(s)),
    );
  if (usable.length === 0) return null;
  return rng.pick(usable).id;
}

function run(strat: Strategy, seed: number) {
  const engine = new Engine({ name: "Test", party: "blue", seed });
  const rng = new Rng(seed + 991);
  const s = engine.state;
  const seenThreads = new Set<string>();
  const gatedFired = new Set<string>();

  while (s.phase === "playing") {
    // Resolve every crisis with a random affordable option.
    for (const t of s.threads) seenThreads.add(t.id);
    for (const crisis of [...engine.pendingCrises]) {
      if (crisis.gated) gatedFired.add(crisis.id);
      const options = crisis.choices.filter((c) => engine.affordable(crisis, c));
      if (!options.length) throw new Error(`No resolvable option for crisis ${crisis.id}`);
      const choice = rng.pick(options);
      if (!engine.resolveCrisis(crisis.id, choice.id)) {
        throw new Error(`Could not resolve crisis ${crisis.id} with ${choice.id}`);
      }
    }
    if (engine.budgetPending() && strat !== "idle") {
      engine.signBudget({ ...s.budget }, s.nation.taxRate);
    }
    // Push one affordable bill a month when playing to govern.
    if (strat === "workaholic" || strat === "balanced") {
      const bill = engine
        .availableBills()
        .find((b) => b.capitalCost + 6 <= s.politics.capital && s.ap >= 1);
      if (bill && engine.forecast(bill, 6).odds > 0.45) engine.proposeBill(bill.id, 6);
    }
    let guard = 12;
    while (s.ap > 0 && guard-- > 0) {
      const id = pickAction(s, strat, rng);
      if (!id) break;
      engine.performAction(id);
    }
    engine.endMonth();
  }

  const legacy = scoreLegacy(s);
  return {
    threads: seenThreads.size,
    threadNames: [...seenThreads].join("|") || "-",
    gated: gatedFired.size,
    strat,
    seed,
    endMonth: s.month,
    ending: s.ending?.id ?? "?",
    grade: s.ending?.grade ?? "?",
    legacy: Math.round(legacy.total),
    approval: +s.politics.approval.toFixed(1),
    coalition: Object.entries(s.blocs)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k.slice(0, 4)}${Math.round(v)}`)
      .join(" "),
    growth: +s.nation.growth.toFixed(2),
    unemp: +s.nation.unemployment.toFixed(2),
    infl: +s.nation.inflation.toFixed(2),
    debt: Math.round(s.nation.debtToGdp),
    unrest: Math.round(s.nation.unrest),
    health: Math.round(s.personal.health),
    marriage: Math.round(s.personal.marriage),
    family: Math.round(s.personal.family),
    bills: s.counters.billsPassed ?? 0,
    crises: s.counters.crisesHandled ?? 0,
  };
}

const strategies: Strategy[] = ["idle", "workaholic", "balanced", "family-first"];
const rows: ReturnType<typeof run>[] = [];
for (const strat of strategies) {
  for (let seed = 1; seed <= 6; seed += 1) rows.push(run(strat, seed * 7919));
}
console.table(rows);

for (const strat of strategies) {
  const mine = rows.filter((r) => r.strat === strat);
  const avg = (f: (r: (typeof rows)[number]) => number) =>
    +(mine.reduce((a, r) => a + f(r), 0) / mine.length).toFixed(1);
  console.log(
    `${strat.padEnd(13)} legacy ${avg((r) => r.legacy)}  approval ${avg((r) => r.approval)}  debt ${avg((r) => r.debt)}  health ${avg((r) => r.health)}  marriage ${avg((r) => r.marriage)}  bills ${avg((r) => r.bills)}  earlyEnd ${mine.filter((r) => r.endMonth <= 48).length}/${mine.length}`,
  );
}

const s0 = new Engine({ name: "x", party: "blue", seed: 1 }).state;
console.log(
  `\nOpening books: revenue $${Math.round(annualRevenue(s0))}bn, discretionary $${Object.values(START_BUDGET).reduce((a, b) => a + b, 0)}bn, deficit $${Math.round(annualDeficit(s0))}bn`,
);
