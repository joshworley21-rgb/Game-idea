class_name Panels
extends CanvasLayer
## The things that take over the screen: what you can do at a station, what is
## on the desk, what the month did, and how it ended.
##
## One host, one panel at a time. The web build queues modals so two events
## never stack on screen, and the same rule holds here: `show_panel` replaces
## whatever is up, and `queue_panel` waits its turn.
##
## Panels are built from a small vocabulary — a title, a body, and a list of
## choices — because every one of them is the same shape: here is what
## happened, here is what you can do about it.

signal action_chosen(action_id: String)
signal crisis_choice(crisis_id: String, choice_id: String)
signal arc_choice(arc_id: String, choice_id: String)
signal closed()

var _root: Control
var _panel: PanelContainer
var _scroll: ScrollContainer
var _body: VBoxContainer
var _queue: Array[Callable] = []
var _open := false


## Built in _init rather than _ready, for the same reason as the HUD: nothing
## here needs the scene tree, and a headless test has no frame to wait for.
func _init() -> void:
	layer = 2
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.visible = false
	add_child(_root)

	# A scrim, so the room dims and the panel is obviously the thing to deal
	# with. It also swallows clicks that miss the panel.
	var scrim := ColorRect.new()
	scrim.set_anchors_preset(Control.PRESET_FULL_RECT)
	scrim.color = Color(0, 0, 0, 0.55)
	scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(scrim)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(centre)

	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", UiTheme.card(0.97, 14))
	_panel.custom_minimum_size = Vector2(560, 0)
	centre.add_child(_panel)

	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panel.add_child(_scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 8)
	_scroll.add_child(_body)


func is_open() -> bool:
	return _open


## Shows `build` now, replacing anything up. `build` fills the body.
func show_panel(build: Callable) -> void:
	for child in _body.get_children():
		_body.remove_child(child)
		child.queue_free()
	build.call(_body)
	_root.visible = true
	_open = true
	# A ScrollContainer has no height of its own, so a panel put inside one
	# with nothing else to size it collapses to a sliver — which is exactly
	# what the first build of the station panel did. Size it to what is
	# actually in it, up to a cap, and let it scroll past that.
	_fit.call_deferred()


const MAX_HEIGHT := 520


func _fit() -> void:
	var wanted := _body.get_combined_minimum_size().y
	_scroll.custom_minimum_size = Vector2(0, minf(wanted, MAX_HEIGHT))


## Shows `build` when the screen is free, so two events never stack.
func queue_panel(build: Callable) -> void:
	if _open:
		_queue.append(build)
		return
	show_panel(build)


func close() -> void:
	_open = false
	_root.visible = false
	closed.emit()
	if not _queue.is_empty():
		var next: Callable = _queue.pop_front()
		show_panel(next)


func _header(body: VBoxContainer, eyebrow: String, title: String) -> void:
	if not eyebrow.is_empty():
		body.add_child(UiTheme.label(eyebrow.to_upper(), 11, UiTheme.ACCENT))
	body.add_child(UiTheme.prose(title, 520, 22))


func _prose(body: VBoxContainer, text: String) -> void:
	if text.is_empty():
		return
	body.add_child(UiTheme.gap(2))
	body.add_child(UiTheme.prose(text, 520, 15, UiTheme.DIM))


## A choice: its label, what it costs, and what it is. The detail line is what
## makes a choice a decision rather than a button.
func _choice(body: VBoxContainer, label: String, detail: String, cost: String,
		enabled: bool, on_press: Callable) -> void:
	var b := UiTheme.choice_button(label if cost.is_empty() else "%s   (%s)" % [label, cost])
	b.disabled = not enabled
	b.pressed.connect(on_press)
	body.add_child(b)
	if not detail.is_empty():
		body.add_child(UiTheme.prose(detail, 520, 12, UiTheme.DIM))
		body.add_child(UiTheme.gap(4))


func _dismiss(body: VBoxContainer, label: String = "Close") -> void:
	body.add_child(UiTheme.gap(6))
	var b := Button.new()
	b.text = label
	b.custom_minimum_size = Vector2(0, 40)
	b.pressed.connect(close)
	body.add_child(b)


## The effects list a verb hands back, in its own colours.
func _effects(body: VBoxContainer, described: Array) -> void:
	if described.is_empty():
		return
	body.add_child(UiTheme.gap(2))
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 10)
	for e in described:
		flow.add_child(UiTheme.label(str(e["text"]), 13,
			UiTheme.GOOD if e["good"] else UiTheme.BAD))
	body.add_child(flow)


# ------------------------------------------------------------------ panels

## What you can do at a station, and what it would cost.
func station(state: Dictionary, station_id: String, actions: Array) -> void:
	show_panel(func(body: VBoxContainer):
		var info: Dictionary = ActionsData.STATION_INFO.get(station_id, {})
		_header(body, "", str(info.get("name", station_id)))
		_prose(body, str(info.get("blurb", "")))
		body.add_child(UiTheme.gap(4))
		if actions.is_empty():
			_prose(body, "There is nothing here that needs you this month.")
		for a in actions:
			var cooldown := ActionsData.action_cooldown_left(state, a)
			var cost := "%d AP" % int(a["ap"])
			if float(a.get("capitalCost", 0.0)) > 0.0:
				cost += ", %d capital" % Effects.js_round(float(a["capitalCost"]))
			if cooldown > 0:
				cost = "%d month%s" % [cooldown, "" if cooldown == 1 else "s"]
			var id := str(a["id"])
			_choice(body, str(a["label"]), str(a.get("detail", "")), cost,
				cooldown == 0 and ActionsData.can_afford(state, a),
				func(): action_chosen.emit(id))
		_dismiss(body, "Back to the room"))


## Something on the desk that will not keep.
func crisis(state: Dictionary, c: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, str(c.get("source", "")), str(c["title"]))
		_prose(body, CrisesData.brief_of(c, state))
		body.add_child(UiTheme.gap(4))
		var cid := str(c["id"])
		for choice in (c["choices"] as Array):
			var cost := ""
			if float(choice.get("capitalCost", 0.0)) > 0.0:
				cost = "%d capital" % Effects.js_round(float(choice["capitalCost"]))
			var chid := str(choice["id"])
			_choice(body, str(choice["label"]), str(choice.get("detail", "")), cost,
				Verbs.affordable(state, c, choice),
				func(): crisis_choice.emit(cid, chid)))


## Something you did, arriving.
func arc(state: Dictionary, a: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, str(a.get("source", "")), str(a["title"]))
		_prose(body, ArcsData.brief_for(str(a["id"]), state))
		body.add_child(UiTheme.gap(4))
		var aid := str(a["id"])
		for choice in (a["choices"] as Array):
			var chid := str(choice["id"])
			_choice(body, str(choice["label"]), str(choice.get("detail", "")), "", true,
				func(): arc_choice.emit(aid, chid)))


## What just happened, after a verb.
func outcome(o: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, "", str(o["title"]))
		_prose(body, str(o["text"]))
		_effects(body, o["effects"])
		_dismiss(body))


## What the month did to the country, and what people are saying about it.
func report(state: Dictionary, r: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		var cal := StateData.calendar(int(r["month"]))
		_header(body, "The month in review", cal["label"])
		var deltas: Array = r["deltas"]
		if deltas.is_empty():
			_prose(body, "Nothing moved far enough to be worth a line.")
		else:
			body.add_child(UiTheme.gap(2))
			for d in deltas:
				var row := HBoxContainer.new()
				row.add_child(UiTheme.label(str(d["label"]), 14, UiTheme.DIM))
				var spacer := Control.new()
				spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(spacer)
				row.add_child(UiTheme.label("%s → %s" % [
					Effects.js_fixed1(float(d["from"])), Effects.js_fixed1(float(d["to"]))],
					14, UiTheme.GOOD if d["good"] else UiTheme.BAD))
				body.add_child(row)
		var notes: Array = r["notes"]
		if not notes.is_empty():
			body.add_child(UiTheme.gap(6))
			for n in notes:
				body.add_child(UiTheme.prose("·  " + str(n), 520, 14))
		body.add_child(UiTheme.gap(6))
		body.add_child(UiTheme.label("Deficit this year: %d bn" %
			Effects.js_round(float(r["deficit"])), 13, UiTheme.DIM))
		var news: Array = state["news"]
		if not news.is_empty():
			body.add_child(UiTheme.gap(6))
			body.add_child(UiTheme.label("THE PAPERS", 11, UiTheme.ACCENT))
			for i in mini(2, news.size()):
				body.add_child(UiTheme.prose("%s — %s" % [news[i]["source"],
					news[i]["headline"]], 520, 13, UiTheme.DIM))
		_dismiss(body, "Get on with it"))


## Four years, and what they were worth.
func ending(e: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, "The term is over", str(e["title"]))
		_prose(body, str(e["blurb"]))
		body.add_child(UiTheme.gap(6))
		body.add_child(UiTheme.label("Legacy: %d  ·  Grade %s" % [
			int(e["legacy"]), e["grade"]], 16, UiTheme.ACCENT))
		_dismiss(body))
