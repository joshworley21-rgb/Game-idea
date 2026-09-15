class_name Hud
extends CanvasLayer
## The always-on overlay: where you are, what you have left, how the country
## and the president are doing, and where you can go.
##
## The rule this layout follows is that the room is the picture and the
## overlay is a caption on it. So it lives on the four edges, over gradients
## rather than inside boxes, and the middle of the screen stays empty until
## something needs a decision.
##
## Three things carry the hierarchy, and nothing else is allowed to:
##
##   The date is the only display-sized text, so the eye lands there first.
##   Ending the month is the only filled button, so there is never a question
##   about what the main action is.
##   Colour appears only on numbers that are doing badly or well.
##
## The HUD only reads state. Everything it can do to the game it does by
## emitting, so the screen never reaches into the engine.

signal station_chosen(station: String)
signal end_month_pressed()

## The country, with the thresholds the web build uses.
##
## A fixed midpoint of 50 does not work here: growth, unemployment, inflation
## and debt are not on a 0-100 scale, and an early version showed a healthy
## 2.8% growth in red because 2.8 is less than 50. Each row carries its own
## good and bad marks, and `higher_is_better` says which way they run.
##
## [label, path, good, bad, higher_is_better, decimals]
const NATION_ROWS := [
	["Approval", "politics.approval", 50.0, 38.0, true, 0],
	["Growth", "nation.growth", 2.0, 0.8, true, 1],
	["Unemployment", "nation.unemployment", 5.0, 6.8, false, 1],
	["Inflation", "nation.inflation", 3.0, 4.5, false, 1],
	["Debt / GDP", "nation.debtToGdp", 105.0, 125.0, false, 0],
	["Unrest", "nation.unrest", 40.0, 60.0, false, 0],
]

## The president. These ARE all 0-100 and the web build bands them together
## at 62 and 38, so stress and sleep debt are read inverted rather than given
## their own marks.
const SELF_ROWS := [
	["Health", "personal.health", false],
	["Stress", "personal.stress", true],
	["Sleep debt", "personal.sleepDebt", true],
	["Marriage", "personal.marriage", false],
	["Family", "personal.family", false],
]

const STATS_WIDTH := 186
const CHIEF_WIDTH := 720
## How much of her the room is worth. The rest is in the morning brief.
const CHIEF_LINES := 2

var _room: Label
var _date: Label
var _ap: Label
var _capital: Label
var _chief: Label
var _nation_box: VBoxContainer
var _self_box: VBoxContainer
var _situations: VBoxContainer
var _situations_block: VBoxContainer
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

	_build_scrims(root)
	_build_heading(root)
	_build_stats(root)
	_build_dock(root)


## The overlay reads over whatever the room happens to be, which for the Oval
## Office is a pale wall and for the Situation Room is nearly black. The
## gradients are what make one set of colours work over both.
func _build_scrims(root: Control) -> void:
	var top := UiTheme.scrim(300, true, 0.58)
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_bottom = 300
	root.add_child(top)

	var bottom := UiTheme.scrim(190, false, 0.80)
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_top = -190
	root.add_child(bottom)


func _build_heading(root: Control) -> void:
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_TOP_LEFT)
	col.offset_left = UiTheme.XL
	col.offset_top = UiTheme.LG
	col.add_theme_constant_override("separation", 2)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(col)

	_room = UiTheme.over_scene(UiTheme.eyebrow("", UiTheme.ACCENT))
	col.add_child(_room)
	_date = UiTheme.over_scene(UiTheme.label("", UiTheme.DISPLAY))
	col.add_child(_date)

	# What you have left to spend, as one quiet line under the date. Action
	# points are pips because three of something is a thing you count at a
	# glance and "3 of 3 actions left" is a thing you read.
	var spend := HBoxContainer.new()
	spend.add_theme_constant_override("separation", UiTheme.SM)
	spend.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(spend)
	_ap = UiTheme.over_scene(UiTheme.label("", UiTheme.BODY, UiTheme.ACCENT))
	spend.add_child(_ap)
	_capital = UiTheme.over_scene(UiTheme.label("", UiTheme.CAPTION, UiTheme.DIM))
	spend.add_child(_capital)


func _build_stats(root: Control) -> void:
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	col.offset_right = -UiTheme.XL
	col.offset_top = UiTheme.LG
	col.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	col.custom_minimum_size = Vector2(STATS_WIDTH, 0)
	col.add_theme_constant_override("separation", UiTheme.MD)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(col)

	col.add_child(UiTheme.over_scene(UiTheme.eyebrow("The country")))
	_nation_box = VBoxContainer.new()
	_nation_box.add_theme_constant_override("separation", 1)
	_nation_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(_nation_box)

	col.add_child(UiTheme.over_scene(UiTheme.eyebrow("You")))
	_self_box = VBoxContainer.new()
	_self_box.add_theme_constant_override("separation", 1)
	_self_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(_self_box)

	# Situations sit under the president because that is what they cost.
	# Hidden entirely while the country is calm, rather than shown empty.
	_situations_block = VBoxContainer.new()
	_situations_block.add_theme_constant_override("separation", UiTheme.XS)
	_situations_block.visible = false
	_situations_block.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(_situations_block)
	_situations_block.add_child(UiTheme.over_scene(UiTheme.eyebrow("Running", UiTheme.WARN)))
	_situations = VBoxContainer.new()
	_situations.add_theme_constant_override("separation", 1)
	_situations.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_situations_block.add_child(_situations)


func _build_dock(root: Control) -> void:
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	col.offset_left = UiTheme.XL
	col.offset_right = -UiTheme.XL
	# Tall enough for the block it holds, with room to spare. Measured, this
	# is her two lines plus her name plus the dock and the separation between
	# them — which came to exactly the height it had, so any rounding
	# squeezed her second line away and elided her mid-sentence.
	col.offset_top = -148
	col.offset_bottom = -UiTheme.LG
	col.add_theme_constant_override("separation", UiTheme.MD)
	root.add_child(col)

	# The Chief of Staff, as a line rather than a card. She is the one voice on
	# screen telling you what to do about everything else, so she sits
	# directly above the things you do it with, and her name is an eyebrow
	# over it — the same shape every other labelled region uses.
	# Held to a column rather than run to the screen edge. Full width it fits
	# her whole line on one row and elides the tail; at a readable measure it
	# wraps into the two lines it has, which is the difference between
	# reading her and reading most of her.
	var chief_row := HBoxContainer.new()
	chief_row.size_flags_vertical = Control.SIZE_SHRINK_END
	chief_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(chief_row)
	var chief_block := VBoxContainer.new()
	chief_block.add_theme_constant_override("separation", 2)
	chief_block.custom_minimum_size = Vector2(CHIEF_WIDTH, 0)
	chief_block.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	chief_block.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chief_row.add_child(chief_block)
	var rest := Control.new()
	rest.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chief_row.add_child(rest)
	chief_block.add_child(
		UiTheme.over_scene(UiTheme.eyebrow("Ruth Ellery", UiTheme.FAINT)))
	_chief = UiTheme.over_scene(
		UiTheme.prose("", CHIEF_WIDTH, UiTheme.CAPTION, UiTheme.DIM))
	# Two lines, and told what a Label thinks two lines are worth — which is
	# not what the font thinks. See UiTheme.LINE_SPACING: measured from the
	# font alone this came out a line short, showed one line and an ellipsis,
	# and gave no sign that anything was wrong.
	_chief.max_lines_visible = CHIEF_LINES
	_chief.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_chief.custom_minimum_size = Vector2(CHIEF_WIDTH,
		UiTheme.line_height(UiTheme.CAPTION) * CHIEF_LINES)
	chief_block.add_child(_chief)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", UiTheme.MD)
	col.add_child(row)

	# The stations scroll rather than squeezing: nine of them across a phone
	# gives nine unreadable buttons, and a scrolling row gives nine readable
	# ones and a gesture people already know.
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(0, 40)
	row.add_child(scroll)
	_dock = HBoxContainer.new()
	_dock.add_theme_constant_override("separation", UiTheme.SM)
	scroll.add_child(_dock)

	_end_button = UiTheme.primary_button("End the month")
	_end_button.pressed.connect(func(): end_month_pressed.emit())
	row.add_child(_end_button)


## Empties a container. remove_child first so the node is out of the tree
## immediately; queue_free alone leaves it visible until the end of the
## frame, which shows as the old rows flashing under the new ones.
static func _clear(node: Node) -> void:
	for child in node.get_children():
		node.remove_child(child)
		child.queue_free()


## One "label     value" row. Three tones, not two: the middle one is the
## point — a number can be drifting without being a problem yet, and a panel
## that only knows good and bad cannot say so.
func _row(text: String, value: String, tone: Color) -> Control:
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(UiTheme.over_scene(UiTheme.label(text, UiTheme.CAPTION, UiTheme.DIM)))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)
	row.add_child(UiTheme.over_scene(UiTheme.label(value, UiTheme.CAPTION, tone)))
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
	_date.text = StateData.calendar(int(state["month"]))["label"]

	var ap := int(state["ap"])
	var ap_max := int(state["apMax"])
	var pips := ""
	for i in ap_max:
		pips += "●" if i < ap else "○"
	_ap.text = pips
	_capital.text = "%d capital" % Effects.js_round(float(state["politics"]["capital"]))
	_chief.text = chief_line

	_clear(_nation_box)
	for row in NATION_ROWS:
		var v := Effects.read_path(state, row[1])
		var text := Effects.js_fixed1(v) if int(row[5]) == 1 else str(Effects.js_round(v))
		_nation_box.add_child(_row(row[0], text, _band(v, row[2], row[3], row[4])))

	_clear(_self_box)
	for row in SELF_ROWS:
		var v := Effects.read_path(state, row[1])
		# Inverted rows are read as how much of this is left to lose.
		var good := 100.0 - v if row[2] else v
		_self_box.add_child(_row(row[0], str(Effects.js_round(v)),
			_band(good, 62.0, 38.0, true)))

	var threads: Array = state["threads"]
	_clear(_situations)
	for t in threads:
		_situations.add_child(_row(str(t["label"]),
			str(Effects.js_round(float(t["intensity"]))),
			_band(float(t["intensity"]), 30.0, 60.0, false)))
	_situations_block.visible = not threads.is_empty()

	_clear(_dock)
	for station in stations:
		var b := UiTheme.quiet_button(str(station["label"]))
		var id := str(station["id"])
		b.pressed.connect(func(): station_chosen.emit(id))
		_dock.add_child(b)

	_end_button.disabled = state["phase"] != "playing"
