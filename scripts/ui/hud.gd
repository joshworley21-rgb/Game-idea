class_name HUD
extends CanvasLayer
## Minimal heads-up display for the fixed-camera rooms.
##
## The HUD is built in code for the same reason DossierCard is: the visual tree
## is a handful of bars and labels, and keeping it in one script makes the
## floating panel easy to restyle without hunting through scene-file boilerplate.
##
## It resolves the GameState autoload by path (/root/GameState) rather than the
## bare global name, so the same script can be exercised headless by adding a
## GameState node to the test tree. In the shipped game the autoload supplies
## that node exactly where this script looks for it.

const PANEL_WIDTH := 384.0

## The overlay the HUD's toggle button opens. Loaded lazily on first press so
## the HUD stays cheap while the dossier is not in use.
const DOSSIER_SCENE_PATH := "res://scenes/ui/cabinet_dossier.tscn"

const STAT_KEYS: Array[String] = ["approval", "budget", "tension", "loyalty"]

const STAT_TITLES := {
	"approval": "Approval",
	"budget": "Budget",
	"tension": "Tension",
	"loyalty": "Loyalty",
}

const STAT_COLORS := {
	"approval": Color(0.34, 0.78, 0.46, 1.0),
	"budget": Color(0.94, 0.76, 0.32, 1.0),
	"tension": Color(0.88, 0.38, 0.30, 1.0),
	"loyalty": Color(0.36, 0.62, 0.92, 1.0),
}

var _state: Node = null
var _panel: PanelContainer
var _date_label: Label
var _bars: Dictionary = {}
var _value_labels: Dictionary = {}
var _tweens: Dictionary = {}
var _dossier_button: Button
var _dossier_overlay: Node = null


func _ready() -> void:
	layer = 10
	_state = get_node_or_null("/root/GameState")
	_build()
	_refresh(true)

	if _state != null:
		if _state.has_signal("stats_changed"):
			_state.connect("stats_changed", Callable(self, "_on_stats_changed"))
		if _state.has_signal("calendar_changed"):
			_state.connect("calendar_changed", Callable(self, "_on_calendar_changed"))
	else:
		push_warning("HUD: no /root/GameState autoload found; displaying defaults")


# ------------------------------------------------------------------ the build

func _build() -> void:
	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	_panel.position = Vector2(18.0, 18.0)
	_panel.custom_minimum_size = Vector2(PANEL_WIDTH, 0.0)
	add_child(_panel)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.02, 0.03, 0.05, 0.68)
	style.border_color = Color(0.85, 0.88, 0.94, 0.16)
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	style.content_margin_left = 18.0
	style.content_margin_right = 18.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	_panel.add_theme_stylebox_override("panel", style)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 10)
	_panel.add_child(column)

	_date_label = Label.new()
	_date_label.name = "Date"
	_date_label.text = "Year 1 - Month 1, Week 1"
	_date_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_date_label.add_theme_font_size_override("font_size", 17)
	_date_label.add_theme_color_override("font_color", Color(0.88, 0.91, 0.96, 1.0))
	column.add_child(_date_label)

	_dossier_button = Button.new()
	_dossier_button.name = "DossierToggle"
	_dossier_button.text = "Cabinet Dossier"
	_dossier_button.pressed.connect(_on_dossier_button_pressed)
	column.add_child(_dossier_button)

	column.add_child(HSeparator.new())

	for key in STAT_KEYS:
		_build_stat_row(column, key)

	# Let the PanelContainer size itself to its content now that every child
	# exists. Anchors are top-left, so position stays put while size grows.
	_panel.size = Vector2(PANEL_WIDTH, _panel.get_combined_minimum_size().y)


func _build_stat_row(parent: VBoxContainer, key: String) -> void:
	var row := VBoxContainer.new()
	row.name = str(STAT_TITLES[key])
	row.add_theme_constant_override("separation", 3)
	parent.add_child(row)

	var header := HBoxContainer.new()
	header.name = "Header"
	row.add_child(header)

	var name_label := Label.new()
	name_label.name = "Name"
	name_label.text = str(STAT_TITLES[key])
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.add_theme_font_size_override("font_size", 14)
	name_label.add_theme_color_override("font_color", Color(0.80, 0.84, 0.90, 1.0))
	header.add_child(name_label)

	var value_label := Label.new()
	value_label.name = "Value"
	value_label.text = "50"
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	value_label.add_theme_font_size_override("font_size", 14)
	value_label.add_theme_color_override("font_color", Color(0.95, 0.96, 0.98, 1.0))
	header.add_child(value_label)
	_value_labels[key] = value_label

	var bar := ProgressBar.new()
	bar.name = "Bar"
	bar.min_value = 0.0
	bar.max_value = 100.0
	bar.step = 0.1
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0.0, 7.0)
	row.add_child(bar)

	var track := StyleBoxFlat.new()
	track.bg_color = Color(1.0, 1.0, 1.0, 0.08)
	track.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("background", track)

	var fill := StyleBoxFlat.new()
	fill.bg_color = STAT_COLORS[key]
	fill.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("fill", fill)

	_bars[key] = bar


# ------------------------------------------------------------------ the data

func _refresh(immediate: bool) -> void:
	_date_label.text = _date_from_state()
	for key in STAT_KEYS:
		var value := _stat_from_state(key)
		_set_stat(key, value, immediate)


func _set_stat(key: String, value: int, immediate: bool) -> void:
	var bar: ProgressBar = _bars[key]
	var label: Label = _value_labels[key]
	label.text = str(value)

	if immediate:
		bar.value = float(value)
		return

	# Kill the previous flight for this bar so two quick choices do not leave
	# two tweens writing the same property at once.
	if _tweens.has(key):
		var old: Tween = _tweens[key]
		if old != null and old.is_valid():
			old.kill()

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(bar, "value", float(value), 0.35)
	_tweens[key] = tween


func _stat_from_state(key: String) -> int:
	if _state == null:
		return 50
	return int(_state.get(key))


func _date_from_state() -> String:
	if _state == null:
		return "Year 1 - Month 1, Week 1"
	var y := int(_state.get("year"))
	var m := int(_state.get("month"))
	var w := int(_state.get("week"))
	return "Year %d - Month %d, Week %d" % [y, m, w]


# --------------------------------------------------------------- dossier toggle

func _on_dossier_button_pressed() -> void:
	var overlay := _ensure_dossier_overlay()
	if overlay == null:
		push_warning("HUD: CabinetDossier overlay is unavailable")
		return
	if overlay.has_method("toggle"):
		overlay.call("toggle")


## Returns the shared CabinetDossier instance, loading it on first use and
## adding it as a child of the HUD so it stays alive for the whole session.
func _ensure_dossier_overlay() -> Node:
	if _dossier_overlay != null and is_instance_valid(_dossier_overlay):
		return _dossier_overlay
	if not ResourceLoader.exists(DOSSIER_SCENE_PATH):
		push_warning("HUD: cannot find %s" % DOSSIER_SCENE_PATH)
		return null
	var packed: PackedScene = load(DOSSIER_SCENE_PATH) as PackedScene
	if packed == null:
		push_warning("HUD: cannot load %s" % DOSSIER_SCENE_PATH)
		return null
	_dossier_overlay = packed.instantiate()
	_dossier_overlay.name = "CabinetDossier"
	add_child(_dossier_overlay)
	return _dossier_overlay


# ------------------------------------------------------------------- signals

func _on_stats_changed() -> void:
	_refresh(false)


func _on_calendar_changed(y: int, m: int, w: int) -> void:
	_date_label.text = "Year %d - Month %d, Week %d" % [y, m, w]
