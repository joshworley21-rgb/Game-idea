class_name GameEngine
extends Node
## The engine: owns the state, and says what happened.
##
## Ported from src/game/engine.ts. The rules of each verb live in Verbs, the
## month in EngineMonth, and the arcs in ArcsData — this is the seam between
## them and the UI, and it is deliberately thin. If something here is more
## than a guard, a call and a signal, it is in the wrong file.
##
## Named GameEngine rather than Engine because Engine is one of Godot's own
## globals; a class_name of Engine would shadow it project-wide.
##
## The TypeScript's Emitter becomes Godot signals, which is the one place the
## port is not a translation: an Emitter callback runs synchronously inside
## the call that fired it, and so does a Godot signal, so the ordering the UI
## sees is the same — but a listener that frees itself mid-emit is Godot's
## problem to handle, not this class's.

signal state_changed(state: Dictionary)
signal outcome_shown(outcome: Dictionary)
signal crisis_arrived(crisis: Dictionary)
signal arc_arrived(arc: Dictionary)
signal month_reported(report: Dictionary)
signal term_ended(ending: Dictionary)
signal reelection_asked()

var state: Dictionary = {}
var _rng: Rng = null
var _ctx: Dictionary = {}
var _active_conversation: Dictionary = {}


func _init(party: String = "blue", president_name: String = "President Vance",
		seed: int = -1) -> void:
	new_game(party, president_name, seed)


## `seed` of -1 draws one, so an unseeded run is a different country each time.
func new_game(party: String, president_name: String, seed: int = -1) -> void:
	var chosen := seed
	if chosen < 0:
		chosen = randi() & 0x7FFFFFFF
	state = StateData.create_initial_state(party, president_name, chosen)
	_rng = Rng.new(int(state["seed"]))
	_ctx = Sim.create_sim_context(_rng)
	state["bills"] = BillsData.bill_catalog()
	state["cabinet"] = People.create_cabinet(_rng)
	state["family"] = People.create_family(_rng, float(state["personal"]["age"]))
	_active_conversation = {}
	_log("system", "You are sworn in as President of the United States.")
	var names: Array[String] = []
	for c in (state["cabinet"] as Array):
		names.append(str(c["name"]))
	_log("system", "Cabinet confirmed: %s." % ", ".join(names))
	NewsData.push_news(state, NewsData.generate_news(state, _rng))
	state_changed.emit(state)


## Restores a saved game. Bills are rehydrated from the catalogue by id,
## because a saved bill carries only what changed about it.
func load_from(saved: Dictionary) -> void:
	var catalog := BillsData.bill_catalog()
	var bills: Array = []
	for b in catalog:
		var restored: Dictionary = b
		for x in (saved.get("bills", []) as Array):
			if x.get("id", "") == b["id"]:
				restored = b.duplicate(true)
				restored["status"] = x.get("status", "open")
				if x.has("failedMonth"):
					restored["failedMonth"] = x["failedMonth"]
				break
		bills.append(restored)
	saved["bills"] = bills
	state = saved
	# A replay is drawn from a stream derived from where the save resumes, so
	# reloading does not replay the run's own sequence from the top.
	_rng = Rng.new(int(state["seed"]) ^ (int(state["month"]) * 2654435761))
	if (state.get("cabinet", []) as Array).is_empty():
		state["cabinet"] = People.create_cabinet(_rng)
	if (state.get("family", []) as Array).is_empty():
		state["family"] = People.create_family(_rng, float(state["personal"]["age"]))
	# A save written before the body had parts would otherwise arithmetic to NaN.
	if not state["personal"].has("sleepDebt"):
		state["personal"]["sleepDebt"] = 22.0
	if not state["personal"].has("fitness"):
		state["personal"]["fitness"] = 62.0
	# A save written before arcs existed has no field to read.
	if not state.has("pendingArc"):
		state["pendingArc"] = null
	_ctx = Sim.create_sim_context(_rng, int(state["month"]))
	_active_conversation = {}
	state_changed.emit(state)


## Folds the campaign's accumulated deltas into the freshly-sworn-in state, so
## the numbers the presidency opens with carry the reason for them. Call this
## once, right after new_game.
func apply_campaign_result(deltas: Dictionary, summary: String, path: Array = []) -> void:
	# What you said to win is a thing you said, and the country was listening.
	# Recording the path as flags is what lets an arc a year later be about
	# the promise rather than about the numbers it moved.
	for id in path:
		state["flags"]["campaign:%s" % id] = true
	for key in ["approval", "capital", "party", "media"]:
		if deltas.has(key) and float(deltas[key]) != 0.0:
			state["politics"][key] = clampf(
				float(state["politics"][key]) + float(deltas[key]), 0.0, 100.0)
	for key in (deltas.get("blocs", {}) as Dictionary):
		state["blocs"][key] = clampf(
			float(state["blocs"].get(key, 50.0)) + float(deltas["blocs"][key]), 0.0, 100.0)
	_log("system", summary)
	NewsData.push_news(state, [{"month": int(state["month"]), "headline": summary,
		"source": "Election Night Wire", "tone": "neutral"}])
	state_changed.emit(state)


# ---------------------------------------------------------------- helpers

func _log(kind: String, text: String) -> void:
	var lines: Array = state["log"]
	lines.push_front({"month": int(state["month"]), "text": text, "kind": kind})
	if lines.size() > 120:
		lines.resize(120)


func _outcome(o: Dictionary) -> void:
	outcome_shown.emit(o)
	state_changed.emit(state)


func _log_started(started: Array) -> void:
	for label in started:
		_log("crisis", "%s begins." % label)


## The crises waiting on the desk.
func pending_crises() -> Array:
	var out: Array = []
	for id in (state["pendingCrises"] as Array):
		var c := CrisesData.by_id(str(id))
		if not c.is_empty():
			out.append(c)
	return out


## The story arc waiting on an answer, if there is one.
func pending_arc() -> Dictionary:
	return ArcsData.pending_arc(state)


## Bills the player may bring to the floor right now.
func available_bills() -> Array:
	var out: Array = []
	for b in (state["bills"] as Array):
		if b.get("status", "") == "passed":
			continue
		if b.get("status", "") == "failed" and int(state["month"]) - int(b.get("failedMonth", 0)) < 6:
			continue
		if not BillsData.bill_requires(state, b):
			continue
		out.append(b)
	return out


func forecast(bill: Dictionary, push: float) -> Dictionary:
	return BillsData.forecast_vote(state, bill, push)


func months_left() -> int:
	return maxi(0, CoreData.TERM_MONTHS - int(state["month"]) + 1)


func is_election_year() -> bool:
	return int(state["month"]) >= CoreData.ELECTION_MONTH - 12


# ---------------------------------------------------------------- actions

func perform_action(action_id: String) -> bool:
	var result := Verbs.perform_action(state, _rng, action_id)
	if result.is_empty():
		return false
	_log_started(result["startedThreads"])
	_outcome(result["outcome"])
	return true


# ----------------------------------------------------------- conversations

## Meetings open at a station right now — availability, not cost.
func conversations_for(station: String) -> Array:
	return ConversationsData.conversations_for(state, station)


func conversation_cooldown_left(conversation: Dictionary) -> int:
	return ActionsData.action_cooldown_left(state, conversation)


## Options open to you at a beat, given how the conversation has gone so far.
func options_for(beat: Dictionary, path: Array) -> Array:
	if _active_conversation.is_empty():
		return beat["options"]
	return ConversationsData.options_for(
		str(_active_conversation["conversation"]["id"]), beat, path)


func conversation_option_affordable(option: Dictionary) -> bool:
	return float(option.get("capitalCost", 0.0)) <= float(state["politics"]["capital"])


## Starts a meeting, spending its entry cost, and returns its opening beat.
func start_conversation(id: String) -> Dictionary:
	var started := Verbs.start_conversation(state, id)
	if started.is_empty():
		return {}
	_active_conversation = Verbs.active_conversation(
		started["conversation"], started["beat"])
	state_changed.emit(state)
	return started


## Takes one line in the meeting under way. Returns the next beat, or a
## closing result once there is nowhere further for the conversation to go.
func choose_conversation_option(option_id: String) -> Dictionary:
	if _active_conversation.is_empty():
		return {}
	var active := _active_conversation
	var result := Verbs.choose_conversation_option(state, _rng, active, option_id)
	if result.is_empty():
		return {}
	_log_started(result["startedThreads"])

	if not (result["beat"] as Dictionary).is_empty():
		state_changed.emit(state)
		return {"beat": result["beat"], "path": result["path"], "failed": result["failed"],
			"text": "", "totalEffects": result["totalEffects"]}

	var station := str(active["conversation"]["station"])
	_log("personal" if station == "family" or station == "rest" else "policy",
		str(active["conversation"]["label"]))
	_active_conversation = {}
	if not (result["outcome"] as Dictionary).is_empty():
		_outcome(result["outcome"])
	return {"beat": {}, "path": result["path"], "failed": result["failed"],
		"text": result["text"], "totalEffects": result["totalEffects"]}


## Abandons a meeting early. Whatever was already said still happened.
func end_conversation() -> void:
	_active_conversation = {}


# ------------------------------------------------------------ legislation

## Brings a bill to a vote. `push` is extra capital spent whipping votes on
## top of the bill's entry cost.
func propose_bill(bill_id: String, push: float) -> bool:
	var outcome := Verbs.propose_bill(state, _rng, bill_id, push)
	if outcome.is_empty():
		return false
	_outcome(outcome)
	return true


# ---------------------------------------------------------------- budget

func budget_pending() -> bool:
	return EngineMonth.is_budget_pending(state)


## Signs the fiscal year's appropriations. Costs one action point.
func sign_budget(budget: Dictionary, tax_rate: float) -> bool:
	if not budget_pending():
		return false
	var outcome := Verbs.sign_budget(state, budget, tax_rate)
	if outcome.is_empty():
		return false
	_outcome(outcome)
	return true


# ---------------------------------------------------------------- crises

func resolve_crisis(crisis_id: String, choice_id: String) -> bool:
	var crisis := CrisesData.by_id(crisis_id)
	if crisis.is_empty():
		return false
	var result := Verbs.resolve_crisis(state, _rng, crisis, choice_id)
	if result.is_empty():
		return false
	_log_started(result["startedThreads"])
	_outcome(result["outcome"])
	return true


func affordable(crisis: Dictionary, choice: Dictionary) -> bool:
	return Verbs.affordable(state, crisis, choice)


# ------------------------------------------------------------------ arcs

## Answers the story arc on the desk.
func resolve_arc(arc_id: String, choice_id: String) -> bool:
	if state.get("pendingArc", null) != arc_id:
		return false
	var result := ArcsData.answer_arc(state, _rng, choice_id)
	if result.is_empty():
		return false
	_log("system", "%s: answered." % result["arc"]["title"])
	_outcome({
		"title": result["arc"]["title"],
		"text": result["text"],
		"effects": Effects.describe_effects(result["effects"]),
		"tone": "bad" if result["failed"] else "neutral",
	})
	return true


# ------------------------------------------------------------- month flow

## {ok, reason}. A crisis or an arc on the desk stops the month for the same
## reason: something has arrived and it wants a decision before you move on.
func can_end_month() -> Dictionary:
	if state["phase"] != "playing":
		return {"ok": false, "reason": "The term is over."}
	if not (state["pendingCrises"] as Array).is_empty():
		return {"ok": false, "reason": "There is a decision on your desk that cannot wait."}
	if ArcsData.arc_blocks_month(state):
		return {"ok": false, "reason": "Something you did has caught up with you."}
	return {"ok": true, "reason": ""}


func end_month() -> void:
	if not can_end_month()["ok"]:
		return
	var result := EngineMonth.end_month(state, _ctx, _rng)

	for o in (result["outcomes"] as Array):
		outcome_shown.emit(o)
	for crisis in (result["crises"] as Array):
		crisis_arrived.emit(crisis)
	if not (result["arc"] as Dictionary).is_empty():
		arc_arrived.emit(result["arc"])

	if not (result["ending"] as Dictionary).is_empty():
		term_ended.emit(result["ending"])
		month_reported.emit(result["report"])
		state_changed.emit(state)
		return

	if result["askReelection"]:
		reelection_asked.emit()

	month_reported.emit(result["report"])
	state_changed.emit(state)


func set_reelection(running: bool) -> void:
	state["runningForReelection"] = running
	_log("system", "You will seek a second term." if running
		else "You will not seek a second term.")
	if not running:
		Effects.apply_effects(state, {"politics.capital": 10.0, "personal.stress": -8.0,
			"politics.party": -10.0})
	state_changed.emit(state)
