class_name Hud
extends CanvasLayer
## The always-on overlay: the date, what you have left to spend, the country,
## and you.
##
## Built in code rather than as a .tscn on purpose. A hand-written scene file
## is how the camera markers ended up transposed — nine floats in the wrong
## order, silently — and a layout is far more numbers than a transform. Built
## here, it is reviewable as code and the anchors are named rather than
## implied.
##
## The HUD only reads state. Everything it can do to the game it does by
## emitting, so the screen never reaches into the engine.

signal station_chosen(station: String)
signal end_month_pressed()

## The country, with the thresholds the web build uses.
##
## A fixed midpoint of 50 does not work here: growth, unemployment, inflation
## and debt are not on a 0-100 scale, and the first version of this panel
## showed a healthy 2.8% growth in red because 2.8 is less than 50. Each row
## carries its own good and bad marks instead, and `higher_is_better` says
## which way round they run.
##
## [label, path, good, bad, higher_is_better, decimals]
const NATION_ROWS := [
	["Approval", "politics.approval", 50.0, 38.0, true, 0],
	["Growth", "nation.growth", 2.0, 0.8, true, 1],
	["Unemployment", "nation.unemployment", 5.0, 6.8, false, 1],
	["Inflation", "nation.inflation", 3.0, 4.5, false, 1],
	["Debt/GDP", "nation.debtToGdp", 105.0, 125.0, false, 0],
	["Unrest", "nation.unrest", 40.0, 60.0, false, 0],
]

## The person. These ARE all 0-100, and the web build bands them together at
## 62 and 38 — so stress and sleep debt are read inverted rather than given
## their own marks.
const SELF_ROWS := [
	["Health", "personal.health", false],
	["Stress", "personal.stress", true],
	["Sleep debt", "personal.sleepDebt", true],
	["Marriage", "personal.marriage", false],
	["Family", "personal.family", false],
]

var _date: Label
var _room: Label
var _power: Label
var _chief: Label
var _nation_box: VBoxContainer
var _self_box: VBoxContainer
var _situations: VBoxContainer
var _situations_card: PanelContainer
var _dock: HBoxContainer
var _end_button: Button


## Built in _init rather than _ready: none of this needs the node to be in the
## scene tree, and building here means the overlay can be constructed and
## inspected by a headless test, which cannot wait for a frame.
func _init() -> void:
	layer = 1
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# Top left: where you are in the term, and what you have left.
	var top := VBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_LEFT)
	top.offset_left = 16
	top.offset_top = 16
	top.custom_minimum_size = Vector2(300, 0)
	top.add_theme_constant_override("separation", 6)
	root.add_child(top)
	_date = UiTheme.label("", 19)
	_room = UiTheme.label("", 12, UiTheme.ACCENT)
	_power = UiTheme.label("", 14, UiTheme.DIM)
	top.add_child(_card([_room, _date, _power]))

	# Under it, the Chief of Staff, because her line is the one thing on
	# screen that tells you what to do about any of the rest.
	_chief = UiTheme.prose("", 272, 14, UiTheme.DIM)
	top.add_child(_card([UiTheme.label("RUTH ELLERY", 11, UiTheme.ACCENT), _chief]))

	# And the situations, which are hidden while the country is calm.
	_situations = VBoxContainer.new()
	_situations.add_theme_constant_override("separation", 4)
	_situations_card = _card([_situations])
	_situations_card.visible = false
	top.add_child(_situations_card)

	# Right: the country above, the person below.
	var right := VBoxContainer.new()
	right.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	right.offset_right = -16
	right.offset_top = 16
	right.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	right.custom_minimum_size = Vector2(230, 0)
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)
	_nation_box = VBoxContainer.new()
	_self_box = VBoxContainer.new()
	right.add_child(_card([UiTheme.label("THE COUNTRY", 11, UiTheme.ACCENT), _nation_box]))
	right.add_child(_card([UiTheme.label("YOU", 11, UiTheme.ACCENT), _self_box]))

	# Bottom: the stations, and the way out of the month.
	var bottom := HBoxContainer.new()
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 16
	bottom.offset_right = -16
	bottom.offset_top = -72
	bottom.offset_bottom = -16
	bottom.add_theme_constant_override("separation", 8)
	root.add_child(bottom)
	_dock = HBoxContainer.new()
	_dock.add_theme_constant_override("separation", 6)
	_dock.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom.add_child(_dock)
	_end_button = Button.new()
	_end_button.text = "End the month"
	_end_button.custom_minimum_size = Vector2(150, 44)
	_end_button.pressed.connect(func(): end_month_pressed.emit())
	bottom.add_child(_end_button)


func _card(children: Array) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiTheme.card())
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	panel.add_child(box)
	for c in children:
		box.add_child(c)
	return panel


## Empties a container. remove_child first so the node is out of the tree
## immediately; queue_free alone leaves it visible until the end of the frame,
## which shows as the old rows flashing under the new ones.
static func _clear(node: Node) -> void:
	for child in node.get_children():
		node.remove_child(child)
		child.queue_free()


## One "Label   value" row. Three tones, not two: the middle one is the point
## — a number can be drifting without being a problem yet, and a panel that
## only knows good and bad cannot say so.
func _row(label: String, value: String, tone: Color) -> Control:
	var row := HBoxContainer.new()
	row.add_child(UiTheme.label(label, 13, UiTheme.DIM))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	row.add_child(UiTheme.label(value, 13, tone))
	return row


static func _band(v: float, good: float, bad: float, higher_is_better: bool) -> Color:
	if higher_is_better:
		return UiTheme.GOOD if v >= good else (UiTheme.WARN if v >= bad else UiTheme.BAD)
	return UiTheme.GOOD if v <= good else (UiTheme.WARN if v <= bad else UiTheme.BAD)


## Says where the president is standing. The room is not part of the game
## state — it is where you happen to be — so it is set on its own rather than
## read out of render().
func set_room(room_name: String) -> void:
	_room.text = room_name.to_upper()


## Redraws everything from the state. Cheap enough to call on every change.
func render(state: Dictionary, chief_line: String, stations: Array) -> void:
	var cal := StateData.calendar(int(state["month"]))
	_date.text = cal["label"]
	var ap := int(state["ap"])
	_power.text = "%d of %d action%s left  ·  %d capital" % [
		ap, int(state["apMax"]), "" if int(state["apMax"]) == 1 else "s",
		Effects.js_round(float(state["politics"]["capital"]))]
	_chief.text = chief_line

	_clear(_nation_box)
	for row in NATION_ROWS:
		var v := Effects.read_path(state, row[1])
		var text := Effects.js_fixed1(v) if int(row[5]) == 1 else str(Effects.js_round(v))
		_nation_box.add_child(_row(row[0], text, _band(v, row[2], row[3], row[4])))
	_clear(_self_box)
	for row in SELF_ROWS:
		var v := Effects.read_path(state, row[1])
		# Inverted rows are read as "how much of this is left to lose".
		var good := 100.0 - v if row[2] else v
		_self_box.add_child(_row(row[0], str(Effects.js_round(v)),
			_band(good, 62.0, 38.0, true)))

	var threads: Array = state["threads"]
	_clear(_situations)
	for t in threads:
		_situations.add_child(UiTheme.prose("%s — %d" % [t["label"],
			Effects.js_round(float(t["intensity"]))], 272, 13, UiTheme.WARN))
	_situations_card.visible = not threads.is_empty()

	_clear(_dock)
	for station in stations:
		var b := Button.new()
		b.text = str(station["label"])
		b.custom_minimum_size = Vector2(0, 44)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var id := str(station["id"])
		b.pressed.connect(func(): station_chosen.emit(id))
		_dock.add_child(b)

	var can: bool = state["phase"] == "playing"
	_end_button.disabled = not can
