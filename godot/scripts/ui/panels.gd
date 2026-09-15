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
signal meeting_chosen(conversation_id: String)
signal meeting_option(option_id: String)
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

	# A scrim, so the room recedes and the panel is obviously the thing to
	# deal with. It also swallows clicks that miss the panel.
	var scrim := ColorRect.new()
	scrim.set_anchors_preset(Control.PRESET_FULL_RECT)
	scrim.color = Color(0.020, 0.027, 0.039, 0.62)
	scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(scrim)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(centre)

	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", UiTheme.panel_style())
	_panel.custom_minimum_size = Vector2(PANEL_WIDTH, 0)
	centre.add_child(_panel)

	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panel.add_child(_scroll)
	# A margin inside the scroll, not outside it: the vertical scrollbar is
	# drawn over the scroll container's own rect, so without this the buttons
	# run underneath it on any panel long enough to scroll — which is most
	# meetings.
	var inset := MarginContainer.new()
	inset.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inset.add_theme_constant_override("margin_right", UiTheme.MD)
	_scroll.add_child(inset)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", UiTheme.SM)
	inset.add_child(_body)


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


## How much of the screen a panel may take before it starts scrolling. A
## fraction rather than a number of pixels, because the shipping target is a
## phone and 520px is most of a phone's short side.
const MAX_SCREEN_SHARE := 0.74


func _fit() -> void:
	var wanted := _body.get_combined_minimum_size().y
	var cap := float(_root.size.y) * MAX_SCREEN_SHARE
	_scroll.custom_minimum_size = Vector2(0, minf(wanted, cap))


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


## The panel's own width, and the width everything inside it wraps against.
## One number, so nothing has to guess.
const PANEL_WIDTH := 560
const CONTENT_WIDTH := PANEL_WIDTH - UiTheme.XL * 2


## Who this is from, and what it is. The eyebrow is the only accent in a
## panel, which is what makes it read as a label rather than as more text.
func _header(body: VBoxContainer, eyebrow: String, title: String) -> void:
	if not eyebrow.is_empty():
		body.add_child(UiTheme.eyebrow(eyebrow, UiTheme.ACCENT))
	body.add_child(UiTheme.prose(title, CONTENT_WIDTH, UiTheme.DISPLAY))


func _prose(body: VBoxContainer, text: String) -> void:
	if text.is_empty():
		return
	body.add_child(UiTheme.prose(text, CONTENT_WIDTH, UiTheme.BODY, UiTheme.DIM))


## A choice: its label, what it costs, and what it is. The whole row is the
## target, description included.
func _choice(body: VBoxContainer, label: String, detail: String, cost: String,
		enabled: bool, on_press: Callable) -> void:
	var b := UiTheme.choice(label, detail, cost, CONTENT_WIDTH)
	b.disabled = not enabled
	b.pressed.connect(on_press)
	body.add_child(b)


## The way out. Quiet, because leaving is never the interesting option on a
## panel that is asking something.
func _dismiss(body: VBoxContainer, label: String = "Close") -> void:
	body.add_child(UiTheme.gap(UiTheme.XS))
	var b := UiTheme.quiet_button(label)
	b.pressed.connect(close)
	body.add_child(b)


## The effects list a verb hands back, in its own colours.
func _effects(body: VBoxContainer, described: Array) -> void:
	if described.is_empty():
		return
	body.add_child(UiTheme.gap(UiTheme.XS))
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", UiTheme.MD)
	flow.add_theme_constant_override("v_separation", UiTheme.XS)
	flow.custom_minimum_size = Vector2(CONTENT_WIDTH, 0)
	for e in described:
		flow.add_child(UiTheme.label(str(e["text"]), UiTheme.CAPTION,
			UiTheme.GOOD if e["good"] else UiTheme.BAD))
	body.add_child(flow)


## A group of choices under a quiet label, so a panel that offers two kinds
## of thing says which is which.
func _group(body: VBoxContainer, label: String) -> void:
	body.add_child(UiTheme.gap(UiTheme.XS))
	body.add_child(UiTheme.eyebrow(label, UiTheme.FAINT))


# ------------------------------------------------------------------ panels

## What you can do at a station, and what it would cost.
##
## Meetings come first and are labelled as such. They are the things that
## take an hour and change what somebody thinks of you; the actions below
## them are the things you sign.
func station(state: Dictionary, station_id: String, actions: Array,
		meetings: Array = []) -> void:
	show_panel(func(body: VBoxContainer):
		var info: Dictionary = ActionsData.STATION_INFO.get(station_id, {})
		_header(body, "", str(info.get("name", station_id)))
		_prose(body, str(info.get("blurb", "")))
		if actions.is_empty() and meetings.is_empty():
			body.add_child(UiTheme.gap(UiTheme.SM))
			_prose(body, "There is nothing here that needs you this month.")
		if not meetings.is_empty():
			_group(body, "Meetings")
		for m in meetings:
			var cooldown := ActionsData.action_cooldown_left(state, m)
			var mid := str(m["id"])
			_choice(body, str(m["label"]), str(m.get("detail", "")),
				_cost(state, m, cooldown),
				cooldown == 0 and int(state["ap"]) >= int(m["ap"])
					and float(m.get("capitalCost", 0.0)) <= float(state["politics"]["capital"]),
				func(): meeting_chosen.emit(mid))
		if not actions.is_empty() and not meetings.is_empty():
			_group(body, "On your own")
		for a in actions:
			var cooldown := ActionsData.action_cooldown_left(state, a)
			var id := str(a["id"])
			_choice(body, str(a["label"]), str(a.get("detail", "")),
				_cost(state, a, cooldown),
				cooldown == 0 and ActionsData.can_afford(state, a),
				func(): action_chosen.emit(id))
		_dismiss(body, "Back to the room"))


## What a thing costs, or how long until it is available again. One or the
## other: a price you cannot pay yet is noise.
func _cost(_state: Dictionary, spec: Dictionary, cooldown: int) -> String:
	if cooldown > 0:
		return "%d month%s" % [cooldown, "" if cooldown == 1 else "s"]
	var bits: Array[String] = ["%d AP" % int(spec["ap"])]
	var capital := float(spec.get("capitalCost", 0.0))
	if capital > 0.0:
		bits.append("%d capital" % Effects.js_round(capital))
	return " · ".join(bits)


## One beat of a meeting: who is talking, what they said, and what you can say
## back.
##
## The speaker is resolved against the state rather than printed from the
## beat, so a meeting written once still names whoever holds the office now.
## There is no portrait yet — the web build draws one procedurally and that is
## 300 lines of canvas work — so the name, the office and how they are holding
## themselves carry it.
func meeting_beat(state: Dictionary, conv: Dictionary, beat: Dictionary,
		path: Array, first: bool) -> void:
	show_panel(func(body: VBoxContainer):
		var who := Speaker.resolve(beat.get("speaker", {}), state)
		_header(body, str(conv["label"]), str(who["name"]))
		var caption: Array[String] = []
		if not str(who["title"]).is_empty():
			caption.append(str(who["title"]))
		# The mood is in the caption because with no portrait it is the only
		# thing on screen saying how this is going.
		caption.append(str(who["mood"]))
		body.add_child(UiTheme.label(" · ".join(caption), UiTheme.CAPTION,
			UiTheme.FAINT))
		# The intro sets the room, and only belongs on the way in.
		if first and not str(conv.get("intro", "")).is_empty():
			_prose(body, str(conv["intro"]))
		body.add_child(UiTheme.prose(str(beat["prompt"]), CONTENT_WIDTH,
			UiTheme.BODY, UiTheme.INK))
		body.add_child(UiTheme.gap(UiTheme.XS))
		for o in ConversationsData.options_for(str(conv["id"]), beat, path):
			var cost := ""
			if float(o.get("capitalCost", 0.0)) > 0.0:
				cost = "%d capital" % Effects.js_round(float(o["capitalCost"]))
			var oid := str(o["id"])
			_choice(body, str(o["label"]), str(o.get("detail", "")), cost,
				float(o.get("capitalCost", 0.0)) <= float(state["politics"]["capital"]),
				func(): meeting_option.emit(oid))
		# Leaving early is a real option: whatever was already said still
		# happened, and the meeting does not un-spend its action point.
		_dismiss(body, "Let it end there"))


## Something on the desk that will not keep.
func crisis(state: Dictionary, c: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, str(c.get("source", "")), str(c["title"]))
		body.add_child(UiTheme.prose(CrisesData.brief_of(c, state), CONTENT_WIDTH))
		body.add_child(UiTheme.gap(UiTheme.XS))
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
		body.add_child(UiTheme.prose(ArcsData.brief_for(str(a["id"]), state),
			CONTENT_WIDTH))
		body.add_child(UiTheme.gap(UiTheme.XS))
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
##
## Three blocks in descending order of how much they are worth reading: what
## moved, what happened, and what the papers made of it. The deficit is a
## footnote because it is the same number most months.
func report(state: Dictionary, r: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, "The month in review",
			str(StateData.calendar(int(r["month"]))["label"]))

		var deltas: Array = r["deltas"]
		if deltas.is_empty():
			_prose(body, "Nothing moved far enough to be worth a line.")
		else:
			body.add_child(UiTheme.gap(UiTheme.XS))
			for d in deltas:
				var row := HBoxContainer.new()
				row.add_child(UiTheme.label(str(d["label"]), UiTheme.BODY, UiTheme.DIM))
				var spacer := Control.new()
				spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(spacer)
				row.add_child(UiTheme.label(Effects.js_fixed1(float(d["from"])),
					UiTheme.CAPTION, UiTheme.FAINT))
				row.add_child(UiTheme.label("  →  ", UiTheme.CAPTION, UiTheme.FAINT))
				row.add_child(UiTheme.label(Effects.js_fixed1(float(d["to"])),
					UiTheme.BODY, UiTheme.GOOD if d["good"] else UiTheme.BAD))
				body.add_child(row)

		var notes: Array = r["notes"]
		if not notes.is_empty():
			body.add_child(UiTheme.gap(UiTheme.SM))
			body.add_child(UiTheme.rule(CONTENT_WIDTH))
			body.add_child(UiTheme.gap(UiTheme.XS))
			for n in notes:
				body.add_child(UiTheme.prose(str(n), CONTENT_WIDTH))

		var news: Array = state["news"]
		if not news.is_empty():
			body.add_child(UiTheme.gap(UiTheme.SM))
			_group(body, "The papers")
			for i in mini(2, news.size()):
				body.add_child(UiTheme.prose(str(news[i]["headline"]),
					CONTENT_WIDTH, UiTheme.CAPTION, UiTheme.DIM))

		body.add_child(UiTheme.gap(UiTheme.XS))
		body.add_child(UiTheme.label("Deficit this year: %d bn" %
			Effects.js_round(float(r["deficit"])), UiTheme.CAPTION, UiTheme.FAINT))
		_dismiss(body, "Get on with it"))


## Four years, and what they were worth.
func ending(e: Dictionary) -> void:
	queue_panel(func(body: VBoxContainer):
		_header(body, "The term is over", str(e["title"]))
		body.add_child(UiTheme.prose(str(e["blurb"]), CONTENT_WIDTH))
		body.add_child(UiTheme.gap(UiTheme.SM))
		body.add_child(UiTheme.rule(CONTENT_WIDTH))
		body.add_child(UiTheme.gap(UiTheme.XS))
		var score := HBoxContainer.new()
		score.add_child(UiTheme.eyebrow("Legacy", UiTheme.FAINT))
		var spacer := Control.new()
		spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		score.add_child(spacer)
		score.add_child(UiTheme.label("%d" % int(e["legacy"]), UiTheme.BODY, UiTheme.DIM))
		score.add_child(UiTheme.label("   %s" % e["grade"], UiTheme.DISPLAY,
			UiTheme.ACCENT))
		body.add_child(score)
		_dismiss(body))
