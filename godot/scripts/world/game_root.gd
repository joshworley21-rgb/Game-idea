class_name GameRoot
extends Node
## Binds the engine to the screen.
##
## The engine says what happened; the HUD shows the state; the panels handle
## anything that takes over. Nothing here knows any rules — if a decision is
## being made in this file, it belongs in Verbs or EngineMonth instead.
##
## The one piece of judgement that does live here is queueing. A month can end
## with a report, two crises and an arc all wanting the screen, and the web
## build learned the hard way that showing them at once reads as noise. They
## go through Panels' queue and arrive one at a time, in the order the month
## produced them.

## Which stations the dock offers. Not every station in the catalogue: `brief`
## and `watch` only exist when there is something to brief or watch, and they
## are folded in below rather than always shown.
const DOCK := ["desk", "budget", "staff", "floor", "phone", "press", "family", "rest"]

var engine: GameEngine
var hud: Hud
var panels: Panels


func _ready() -> void:
	engine = GameEngine.new("blue", "President Vance")
	add_child(engine)

	hud = Hud.new()
	add_child(hud)
	panels = Panels.new()
	add_child(panels)

	engine.state_changed.connect(_render)
	engine.outcome_shown.connect(func(o): panels.outcome(o))
	engine.crisis_arrived.connect(func(c): panels.crisis(engine.state, c))
	engine.arc_arrived.connect(func(a): panels.arc(engine.state, a))
	engine.month_reported.connect(func(r): panels.report(engine.state, r))
	engine.term_ended.connect(func(e): panels.ending(e))

	hud.station_chosen.connect(_open_station)
	hud.end_month_pressed.connect(_end_month)
	panels.action_chosen.connect(func(id):
		panels.close()
		engine.perform_action(id))
	panels.crisis_choice.connect(func(cid, chid):
		panels.close()
		engine.resolve_crisis(cid, chid))
	panels.arc_choice.connect(func(aid, chid):
		panels.close()
		engine.resolve_arc(aid, chid))

	_render(engine.state)
	# Anything already on the desk when the term opens.
	for c in engine.pending_crises():
		panels.crisis(engine.state, c)


func _stations() -> Array:
	var out: Array = []
	for id in DOCK:
		var info: Dictionary = ActionsData.STATION_INFO[id]
		out.append({"id": id, "label": info["name"]})
	# The Situation Table and the Watch Floor appear only when the country has
	# given you something to do there.
	if not ActionsData.situation_actions(engine.state).is_empty():
		for id in ["brief", "watch"]:
			if not ActionsData.actions_for(engine.state, id).is_empty():
				out.append({"id": id, "label": ActionsData.STATION_INFO[id]["name"]})
	return out


func _render(state: Dictionary) -> void:
	hud.render(state, Chief.morning_briefing(state)["text"], _stations())


func _open_station(station_id: String) -> void:
	panels.station(engine.state, station_id,
		ActionsData.actions_for(engine.state, station_id))


func _end_month() -> void:
	var can := engine.can_end_month()
	if not can["ok"]:
		panels.outcome({"title": "Not yet", "text": can["reason"], "effects": [],
			"tone": "neutral"})
		return
	engine.end_month()
