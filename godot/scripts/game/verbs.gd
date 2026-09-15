class_name Verbs
extends RefCounted
## The things a player does.
##
## Ported from src/game/verbs.ts. Every function here takes the state and
## mutates it, returning what to show. The month tick (EngineMonth) is what
## the country does to you; this is the other half — what you do back.
##
## Outcomes are Dictionaries of {title, text, effects, tone}, where `effects`
## is the already-described list Effects.describe_effects produces. A verb
## that could not be taken returns {} rather than half-applying itself, and
## every guard is checked before anything is spent.

const NOTHING := {}


# ---------------------------------------------------------------- actions

## Takes an action. Returns {outcome, startedThreads}, or {} if it could not
## be taken.
static func perform_action(s: Dictionary, rng: Rng, action_id: String) -> Dictionary:
	if s["phase"] != "playing":
		return NOTHING
	# Two stations generate their options from state rather than listing them:
	# the residence's evenings come from the family, and the Situation Room's
	# come from whatever is running. Neither is in the static catalogue, and a
	# lookup that only searched the catalogue and the residence meant every
	# button in the Situation Room silently did nothing — the panel stayed
	# open, no action point was spent, and the situation went on getting worse.
	var action := _find_action(s, action_id)
	if action.is_empty():
		return NOTHING
	if int(s["ap"]) < int(action["ap"]):
		return NOTHING
	if float(action.get("capitalCost", 0.0)) > float(s["politics"]["capital"]):
		return NOTHING
	if ActionsData.action_cooldown_left(s, action) > 0:
		return NOTHING

	s["ap"] = int(s["ap"]) - int(action["ap"])
	var capital_cost := float(action.get("capitalCost", 0.0))
	if capital_cost != 0.0:
		Effects.apply_effects(s, {"politics.capital": -capital_cost})

	# Same shape as a crisis choice: a chance this backfires, and what it sets
	# in motion either way — so a decision made here can still be paying (or
	# costing) something months from now, not just this month.
	var failed: bool = action.has("risk") and rng.chance(float(action["risk"]))
	var effects: Dictionary = action["onFail"] if (failed and action.has("onFail")) else action["effects"]
	Effects.apply_effects(s, effects)
	var before := _thread_ids(s)
	CrisesData.apply_consequence(s,
		action.get("failConsequence", {}) if (failed and action.has("failConsequence"))
		else action.get("consequence", {}))
	var started := _threads_started(s, before)

	# An hour given to one person lands on that person, not on an average; an
	# evening with all of them lands on all of them.
	_attend_target(s, action)
	s["actionHistory"][action["id"]] = int(s["month"])

	return {
		"outcome": {
			"title": action["label"],
			"text": action["failText"] if (failed and action.has("failText")) else action["resultText"],
			"effects": Effects.describe_effects(_with_capital(effects, capital_cost)),
			"tone": "bad" if failed else "neutral",
		},
		"startedThreads": started,
	}


static func _find_action(s: Dictionary, action_id: String) -> Dictionary:
	for a in ActionsData.ACTIONS:
		if a["id"] == action_id:
			return a
	for a in ActionsData.residence_actions(s):
		if a["id"] == action_id:
			return a
	for a in ActionsData.situation_actions(s):
		if a["id"] == action_id:
			return a
	return {}


static func _thread_ids(s: Dictionary) -> Array:
	var out: Array = []
	for t in (s["threads"] as Array):
		out.append(t["id"])
	return out


static func _threads_started(s: Dictionary, before: Array) -> Array:
	var out: Array = []
	for t in (s["threads"] as Array):
		if not before.has(t["id"]):
			out.append(str(t["label"]))
	return out


## `spec` is an action or a conversation option: both carry target/attention.
static func _attend_target(s: Dictionary, spec: Dictionary) -> void:
	if not spec.has("target") or not spec.has("attention"):
		return
	var weight := float(spec["attention"])
	if spec["target"] == "all":
		for member in (s["family"] as Array):
			People.attend(member, weight)
		return
	var member := People.member_by_id(s, str(spec["target"]))
	if not member.is_empty():
		People.attend(member, weight)


## The effects as shown to the player, which include the capital spent to get
## them — the TypeScript folds the cost into the same list rather than
## printing it separately.
static func _with_capital(effects: Dictionary, cost: float) -> Dictionary:
	var shown := effects.duplicate(true)
	if cost != 0.0:
		shown["politics.capital"] = float(shown.get("politics.capital", 0.0)) - cost
	return shown


# ----------------------------------------------------------- conversations

## The flags a finished meeting sets. A meeting that has happened is a fact
## about the term, and the Chief of Staff's list of outstanding obligations
## reads these to know what is still owed.
const CONVERSATION_FLAGS := {
	"first-cabinet": "met:cabinet",
	"address-house": "addressed:house",
}


## Starts a meeting, spending its entry cost. Returns {conversation, beat}.
static func start_conversation(s: Dictionary, id: String) -> Dictionary:
	if s["phase"] != "playing":
		return NOTHING
	var conv := ConversationsData.by_id(id)
	if conv.is_empty():
		return NOTHING
	if int(s["ap"]) < int(conv["ap"]):
		return NOTHING
	if float(conv.get("capitalCost", 0.0)) > float(s["politics"]["capital"]):
		return NOTHING
	if ActionsData.action_cooldown_left(s, conv) > 0:
		return NOTHING
	if not ConversationsData.available_for(id, s):
		return NOTHING

	s["ap"] = int(s["ap"]) - int(conv["ap"])
	var capital_cost := float(conv.get("capitalCost", 0.0))
	if capital_cost != 0.0:
		Effects.apply_effects(s, {"politics.capital": -capital_cost})
	s["actionHistory"][conv["id"]] = int(s["month"])
	return {"conversation": conv, "beat": conv["beats"][conv["startBeat"]]}


## An in-progress meeting: {conversation, beat, path, totalShown}.
static func active_conversation(conv: Dictionary, beat: Dictionary) -> Dictionary:
	return {"conversation": conv, "beat": beat, "path": [], "totalShown": {}}


## Takes one line in the meeting under way.
##
## Returns {beat, path, failed, text, totalEffects, outcome, startedThreads}.
## `beat` is {} once the meeting is over, and `outcome` is {} until then: the
## whole exchange resolves as one result, the way a crisis does, rather than
## as a running commentary.
static func choose_conversation_option(s: Dictionary, rng: Rng, active: Dictionary,
		option_id: String) -> Dictionary:
	var conv: Dictionary = active["conversation"]
	var conv_id := str(conv["id"])
	var option := {}
	for o in ConversationsData.options_for(conv_id, active["beat"], active["path"]):
		if o["id"] == option_id:
			option = o
			break
	if option.is_empty():
		return NOTHING
	var capital_cost := float(option.get("capitalCost", 0.0))
	if capital_cost > float(s["politics"]["capital"]):
		return NOTHING

	if capital_cost != 0.0:
		Effects.apply_effects(s, {"politics.capital": -capital_cost})
	var failed: bool = option.has("risk") and rng.chance(float(option["risk"]))
	var effects: Dictionary = option["onFail"] if (failed and option.has("onFail")) else option["effects"]
	Effects.apply_effects(s, effects)
	# An hour given to one person lands on that person; an evening with all of
	# them lands on all of them, the same as any other family action.
	_attend_target(s, option)
	var before := _thread_ids(s)
	CrisesData.apply_consequence(s,
		option.get("failConsequence", {}) if (failed and option.has("failConsequence"))
		else option.get("consequence", {}))
	var started := _threads_started(s, before)
	if option.has("modifier"):
		var mod: Dictionary = option["modifier"]
		s["modifiers"].append({
			"id": mod.get("id", "%s-%s" % [conv_id, option["id"]]),
			"label": mod["label"],
			"months": mod["months"],
			"perMonth": mod["perMonth"],
		})

	var shown := _with_capital(effects, capital_cost)
	var total: Dictionary = active["totalShown"]
	for path in shown:
		var delta: Variant = shown[path]
		if not (delta is float or delta is int):
			continue
		total[path] = float(total.get(path, 0.0)) + float(delta)
	active["path"].append(option["id"])

	var next_beat := {}
	if option.has("next") and (conv["beats"] as Dictionary).has(option["next"]):
		next_beat = conv["beats"][option["next"]]
	if not next_beat.is_empty():
		active["beat"] = next_beat
		return {
			"beat": next_beat,
			"path": (active["path"] as Array).duplicate(),
			"failed": failed,
			"text": "",
			"totalEffects": total,
			"outcome": NOTHING,
			"startedThreads": started,
		}

	# The meeting is over.
	if CONVERSATION_FLAGS.has(conv_id):
		s["flags"][CONVERSATION_FLAGS[conv_id]] = true

	var text: String = option["failText"] if (failed and option.has("failText")) else option["resultText"]
	return {
		"beat": NOTHING,
		"path": (active["path"] as Array).duplicate(),
		"failed": failed,
		"text": text,
		"totalEffects": total,
		"outcome": {
			"title": conv["label"],
			"text": text,
			"effects": Effects.describe_effects(total),
			"tone": "bad" if failed else "neutral",
		},
		"startedThreads": started,
	}


# ------------------------------------------------------------ legislation

## Brings a bill to a vote. `push` is extra capital spent whipping votes on
## top of the bill's entry cost.
static func propose_bill(s: Dictionary, rng: Rng, bill_id: String, push: float) -> Dictionary:
	if s["phase"] != "playing":
		return NOTHING
	var bill := {}
	for b in (s["bills"] as Array):
		if b["id"] == bill_id:
			bill = b
			break
	if bill.is_empty():
		return NOTHING
	var total := float(bill["capitalCost"]) + push
	if int(s["ap"]) < 1 or float(s["politics"]["capital"]) < total:
		return NOTHING

	s["ap"] = int(s["ap"]) - 1
	Effects.apply_effects(s, {"politics.capital": -total})
	var result := BillsData.hold_vote(s, bill, push, rng)

	if result["passed"]:
		bill["status"] = "passed"
		Effects.apply_effects(s, bill["onPass"])
		s["counters"]["billsPassed"] = int(s["counters"].get("billsPassed", 0)) + 1
		s["counters"]["legislatedSpending"] = (float(s["counters"].get("legislatedSpending", 0.0))
			+ float(bill["cost"]))
		_log(s, "policy", "%s signed into law." % bill["title"])
		NewsData.push_news(s, [{"month": int(s["month"]),
			"headline": "%s passes; president signs in the East Room" % bill["title"],
			"source": "Capitol Wire", "tone": "good"}])
	else:
		bill["status"] = "failed"
		bill["failedMonth"] = int(s["month"])
		s["counters"]["billsFailed"] = int(s["counters"].get("billsFailed", 0)) + 1
		_log(s, "policy", "%s failed on the floor." % bill["title"])
		NewsData.push_news(s, [{"month": int(s["month"]),
			"headline": "%s collapses on the floor; White House scrambles" % bill["title"],
			"source": "The Beacon", "tone": "bad"}])

	var after := BillsData.vote_aftermath(bill, result)
	Effects.apply_effects(s, after)
	BillsData.faction_aftermath(s, bill, result["passed"])

	var shown := {}
	if result["passed"]:
		shown = (bill["onPass"] as Dictionary).duplicate(true)
	for k in after:
		shown[k] = after[k]
	shown["politics.capital"] = float(shown.get("politics.capital", 0.0)) - total
	return {
		"title": "%s — %s" % [bill["title"], "PASSED" if result["passed"] else "FAILED"],
		"text": result["narrative"],
		"effects": Effects.describe_effects(shown),
		"tone": "good" if result["passed"] else "bad",
	}


# ---------------------------------------------------------------- budget

## Signs the fiscal year's appropriations. Costs one action point.
static func sign_budget(s: Dictionary, budget: Dictionary, tax_rate: float) -> Dictionary:
	if int(s["ap"]) < 1:
		return NOTHING

	var tax_delta := tax_rate - float(s["nation"]["taxRate"])
	s["ap"] = int(s["ap"]) - 1
	s["budget"] = budget.duplicate(true)
	s["enacted"] = budget.duplicate(true)
	s["nation"]["taxRate"] = clampf(tax_rate, 6.0, 45.0)
	s["flags"]["budget%d" % int(s["month"])] = true
	# The Chief of Staff's list of outstanding obligations reads this.
	s["flags"]["budget:signed"] = true

	var effects := {}
	# Raising taxes is unpopular; cutting them buys short-term goodwill.
	if absf(tax_delta) > 0.05:
		effects["politics.approval"] = -tax_delta * 2.2
		effects["politics.party"] = tax_delta * (2.0 if s["party"] == "blue" else -2.0)
		effects["nation.growth"] = -tax_delta * 0.12
		effects["nation.unrest"] = tax_delta * 1.2
	# A budget is a fight; passing one always costs something.
	effects["politics.capital"] = -6.0
	effects["personal.stress"] = 6.0
	Effects.apply_effects(s, effects)

	var year: int = StateData.calendar(int(s["month"]))["year"]
	_log(s, "policy", "Signed the Year %d budget." % year)
	return {
		"title": "Year %d Budget Signed" % year,
		"text": ("The appropriations are law, and the tax change is the lead paragraph in every story about them."
			if absf(tax_delta) > 0.05
			else "The appropriations are law. Nine agencies now know what they have to work with."),
		"effects": Effects.describe_effects(effects),
		"tone": "neutral",
	}


# ---------------------------------------------------------------- crises

## Answers a crisis on the desk. Returns {outcome, startedThreads}.
static func resolve_crisis(s: Dictionary, rng: Rng, crisis: Dictionary,
		choice_id: String) -> Dictionary:
	if not (s["pendingCrises"] as Array).has(crisis["id"]):
		return NOTHING
	var choice := {}
	for c in (crisis["choices"] as Array):
		if c["id"] == choice_id:
			choice = c
			break
	if choice.is_empty():
		return NOTHING
	if not affordable(s, crisis, choice):
		return NOTHING

	# Capital clamps at zero, so an unaffordable last resort simply empties it.
	var capital_cost := float(choice.get("capitalCost", 0.0))
	if capital_cost != 0.0:
		Effects.apply_effects(s, {"politics.capital": -capital_cost})

	# A department that knows its business shaves the odds of it going wrong.
	var competence := People.crisis_competence(s, crisis.get("tags", []))
	var failed := false
	if choice.has("risk"):
		var risk := clampf(float(choice["risk"]) * (1.0 - (competence - 60.0) * 0.007), 0.02, 0.95)
		failed = rng.chance(risk)
	var effects: Dictionary = choice["onFail"] if (failed and choice.has("onFail")) else choice["effects"]
	Effects.apply_effects(s, effects)

	# What the decision sets in motion, which may differ when it goes wrong.
	var before := _thread_ids(s)
	CrisesData.apply_consequence(s,
		choice.get("failConsequence", {}) if (failed and choice.has("failConsequence"))
		else choice.get("consequence", {}))
	var started := _threads_started(s, before)

	if choice.has("modifier"):
		var mod: Dictionary = choice["modifier"]
		s["modifiers"].append({
			"id": mod.get("id", "%s-%s" % [crisis["id"], choice_id]),
			"label": mod["label"],
			"months": mod["months"],
			"perMonth": mod["perMonth"],
		})

	var still_pending: Array = []
	for id in (s["pendingCrises"] as Array):
		if id != crisis["id"]:
			still_pending.append(id)
	s["pendingCrises"] = still_pending
	s["crisisHistory"][crisis["id"]] = int(s["month"])
	s["counters"]["crisesHandled"] = int(s["counters"].get("crisesHandled", 0)) + 1
	_log(s, "crisis", "%s: %s." % [crisis["title"], choice["label"]])

	return {
		"outcome": {
			"title": crisis["title"],
			"text": choice["failText"] if (failed and choice.has("failText")) else choice["resultText"],
			"effects": Effects.describe_effects(_with_capital(effects, capital_cost)),
			"tone": "bad" if failed else "good",
		},
		"startedThreads": started,
	}


## Whether a crisis option can be taken.
##
## The cheapest option in a crisis is always available, whatever the treasury
## looks like: a president with no capital left still has to answer the phone,
## and a crisis nobody can resolve would stall the term for good.
static func affordable(s: Dictionary, crisis: Dictionary, choice: Dictionary) -> bool:
	var cost := float(choice.get("capitalCost", 0.0))
	if cost <= float(s["politics"]["capital"]):
		return true
	var cheapest := INF
	for c in (crisis["choices"] as Array):
		cheapest = minf(cheapest, float(c.get("capitalCost", 0.0)))
	return cost == cheapest


## Writes a line to the log. No cap here on purpose: the TypeScript trims the
## log to 120 entries in the engine's own log() and nowhere else, so trimming
## it at the point of writing would quietly drop lines the engine keeps.
static func _log(s: Dictionary, kind: String, text: String) -> void:
	var lines: Array = s["log"]
	lines.push_front({"month": int(s["month"]), "text": text, "kind": kind})
