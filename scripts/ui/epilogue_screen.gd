class_name EpilogueScreen
extends CanvasLayer
## End-of-run legacy screen.
##
## Built in code for the same reason as the HUD and CabinetDossier: the visual
## tree is a heading, a scroll of legacy sections and one button, so a script
## that repeats two label helpers is simpler than a hand-authored scene. The
## shipped .tscn is only a CanvasLayer with this script attached, exactly like
## hud.tscn and cabinet_dossier.tscn.

const GENERATOR := preload("res://scripts/core/epilogue_generator.gd")

const HEADING_COLOR := Color(0.94, 0.95, 0.97, 1.0)
const VERDICT_COLOR := Color(0.95, 0.84, 0.42, 1.0)
const BODY_COLOR := Color(0.82, 0.85, 0.91, 1.0)

## Resolved by path rather than the bare autoload name, matching the HUD and
## CabinetDossier. The shipped game supplies /root/GameState via project.godot.
var _state: Node = null
var _panel: PanelContainer
var _scroll: ScrollContainer
var _content: VBoxContainer
var _play_again: Button
var _legacy: Dictionary = {}


func _ready() -> void:
	layer = 30
	_state = get_node_or_null("/root/GameState")
	_build()
	_legacy = _generate()
	_populate()
	# Deferred so the ScrollContainer has measured its content before the reveal
	# tween reads the scrollbar's max value.
	call_deferred("_start_reveal")


func _generate() -> Dictionary:
	var generator := GENERATOR.new()
	if generator != null:
		return generator.generate_legacy()
	return {}


# ------------------------------------------------------------------ the build

func _build() -> void:
	var dim := ColorRect.new()
	dim.name = "Dim"
	dim.color = Color(0.01, 0.015, 0.025, 0.88)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	var centre := CenterContainer.new()
	centre.name = "Centre"
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.custom_minimum_size = Vector2(760.0, 560.0)
	centre.add_child(_panel)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.02, 0.03, 0.05, 0.96)
	style.border_color = Color(0.85, 0.88, 0.94, 0.18)
	style.set_border_width_all(1)
	style.set_corner_radius_all(14)
	style.content_margin_left = 26.0
	style.content_margin_right = 26.0
	style.content_margin_top = 24.0
	style.content_margin_bottom = 22.0
	_panel.add_theme_stylebox_override("panel", style)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 14)
	_panel.add_child(column)

	var heading := _make_label("The Legacy of Your Presidency", 28, HEADING_COLOR)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)

	_scroll = ScrollContainer.new()
	_scroll.name = "Scroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.custom_minimum_size = Vector2(0.0, 380.0)
	column.add_child(_scroll)

	_content = VBoxContainer.new()
	_content.name = "Content"
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 10)
	_scroll.add_child(_content)

	_play_again = Button.new()
	_play_again.name = "PlayAgain"
	_play_again.text = "Play Again"
	_play_again.pressed.connect(_on_play_again_pressed)
	column.add_child(_play_again)


# ------------------------------------------------------------------ the data

func _populate() -> void:
	_add_section(
		"Re-Election Verdict",
		str(_legacy.get("verdict", "Electoral Defeat")),
		VERDICT_COLOR,
		24
	)
	var detail := str(_legacy.get("verdict_detail", ""))
	if not detail.is_empty():
		_add_body(detail)

	var grade_text := "%s - %s" % [
		str(_legacy.get("grade", "F")),
		str(_legacy.get("grade_title", "Disgraced Footnote")),
	]
	_add_section("Historical Grade", grade_text, VERDICT_COLOR, 24)

	_add_section("Cabinet Fates", "", BODY_COLOR, 16)
	var fates: Array = []
	var raw_fates: Variant = _legacy.get("cabinet_fates", [])
	if raw_fates is Array:
		fates = raw_fates
	for line in fates:
		_add_body("• " + str(line))

	_add_section("Family Legacy", "", BODY_COLOR, 16)
	_add_body(str(_legacy.get("family_legacy", "")))


## Adds a heading plus (optionally) its value. Used for the four legacy sections.
func _add_section(title: String, value: String, color: Color, font_size: int) -> void:
	var heading := _make_label(title, 21, HEADING_COLOR)
	_content.add_child(heading)
	if not value.is_empty():
		var body := _make_label(value, font_size, color)
		_content.add_child(body)


func _add_body(text: String) -> void:
	var body := _make_label(text, 16, BODY_COLOR)
	_content.add_child(body)


func _make_label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label


# ------------------------------------------------------------------- reveal

## Fades the report in and gently scrolls it top-to-bottom when the content is
## taller than the viewport, so the four sections unroll rather than pop.
func _start_reveal() -> void:
	_content.modulate = Color(1.0, 1.0, 1.0, 0.0)
	var bar := _scroll.get_v_scroll_bar()
	var max_scroll := 0.0
	if bar != null:
		max_scroll = bar.max_value - bar.min_value

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(_content, "modulate:a", 1.0, 0.6)
	if max_scroll > 0.0:
		tween.tween_property(_scroll, "scroll_vertical", int(max_scroll), 6.0)


# ------------------------------------------------------------- play again

func _on_play_again_pressed() -> void:
	if _state != null and _state.has_method("start_new_run"):
		_state.call("start_new_run")
	else:
		push_warning("EpilogueScreen: no GameState autoload found; cannot start a new run")
		return
	visible = false
