class_name EventManager
extends CanvasLayer
## Plays JSON dialogue events and turns their choices into clickable buttons.
##
## An event is a JSON file with the shape:
##
##   {
##     "trigger_condition": { "required_flags": ["met_chief"] },
##     "nodes": {
##       "start": {
##         "text": "Mr President, the markets are nervous.",
##         "choices": [
##           {
##             "text": "Reassure them.",
##             "stat_impact": { "approval": 3, "budget": -1 },
##             "set_flag": "reassured_markets",
##             "next": "calm"
##           }
##         ]
##       },
##       "calm": { "text": "The markets settle.", "choices": [] }
##     },
##     "start": "start"
##   }
##
## A flat single-node event is also accepted: put "text" and "choices" at the
## top level of the file and omit "nodes"/"start". Choices with no "next"
## value end the dialogue. Buttons are created in code so the tree of nodes
## can be swapped without touching a scene file.

## The event just ended (ran out of nodes, or the player reached a leaf).
signal event_finished

## A choice was selected. Emitted after GameState.apply_choice() runs.
signal choice_made(choice: Dictionary)

## Where load_event() looks for files. Relative paths are resolved against
## the Godot project root (res://), so callers usually pass
## "res://scripts/events/cabinet_intro.json" or just "scripts/events/...".
var base_path := "res://"

var _event_data: Dictionary = {}
var _ui_built := false
var _dim: ColorRect
var _panel: PanelContainer
var _text_label: Label
var _choices_box: VBoxContainer


func _ready() -> void:
	layer = 10
	_ensure_ui()
	visible = false


# ------------------------------------------------------------------- loading

## Reads [param path] as JSON and returns its Dictionary, or {} when the file
## cannot be read, is not valid JSON, or its trigger_condition is not met.
## Call this first; pass the returned Dictionary to play_event().
func load_event(path: String) -> Dictionary:
	var full_path := _resolve_path(path)
	var file := FileAccess.open(full_path, FileAccess.READ)
	if file == null:
		push_error("EventManager: cannot open %s (error %d)" % [full_path, FileAccess.get_open_error()])
		return {}
	var text := file.get_as_text()
	var parsed: Variant = JSON.parse_string(text)
	if parsed == null or not (parsed is Dictionary):
		push_error("EventManager: %s is not a JSON object" % full_path)
		return {}
	var data: Dictionary = parsed
	if not can_play(data):
		return {}
	return data


## Whether [param event_data] is allowed to play right now. An event with no
## trigger_condition block always plays. When the block is present:
##   required_flags  -> every flag in the array must already be in
##                      GameState.story_flags.
##   blocked_flags   -> if any flag in the array is present, the event cannot
##                      play.
func can_play(event_data: Dictionary) -> bool:
	if event_data.is_empty() or not event_data.has("trigger_condition"):
		return true
	var trigger: Dictionary = event_data.get("trigger_condition", {})
	if trigger.is_empty():
		return true

	# A single "required_flag" string is accepted as shorthand.
	if trigger.has("required_flag"):
		if not GameState.story_flags.has(str(trigger["required_flag"])):
			return false

	if trigger.has("required_flags"):
		for flag in trigger["required_flags"]:
			if not GameState.story_flags.has(str(flag)):
				return false

	if trigger.has("blocked_flags"):
		for flag in trigger["blocked_flags"]:
			if GameState.story_flags.has(str(flag)):
				return false

	return true


# ------------------------------------------------------------------ playback

## Starts [param event_data], prints its first node's text, and creates a
## Button for each choice. When a choice is pressed its stat_impact and
## set_flag are handed to GameState.apply_choice(), then the dialogue moves
## to the node named by that choice's "next" value.
func play_event(event_data: Dictionary) -> void:
	if event_data.is_empty():
		push_error("EventManager: play_event() called with an empty event")
		return
	if not can_play(event_data):
		push_error("EventManager: event is blocked by its trigger_condition")
		return

	_event_data = event_data
	_ensure_ui()
	visible = true

	var start_ref: Variant = event_data.get("start", event_data.get("start_node", ""))
	_show_node(start_ref)


## Returns the event currently being played, or {} when idle.
func active_event() -> Dictionary:
	return _event_data


func is_playing() -> bool:
	return not _event_data.is_empty()


## The text currently shown for the active node, or "" when idle.
func event_text() -> String:
	return _text_label.text if _text_label != null else ""


## How many choice buttons are currently on screen.
func choice_count() -> int:
	return _choices_box.get_child_count() if _choices_box != null else 0


## The label on every choice button currently on screen, in order.
func choice_labels() -> Array[String]:
	var labels: Array[String] = []
	if _choices_box == null:
		return labels
	for child in _choices_box.get_children():
		if child is Button:
			labels.append(child.text)
	return labels


# ------------------------------------------------------------------ dialogue

func _show_node(node_ref: Variant) -> void:
	var node := _resolve_node(node_ref)
	if node.is_empty():
		_finish()
		return

	var displayed_text := _resolve_node_text(node)
	_text_label.text = displayed_text
	# The console trace is part of the brief: print the event text as it is
	# shown, so headless runs and the editor output both read like a log.
	print(displayed_text)

	_clear_choices()
	for choice in node.get("choices", []):
		if choice is Dictionary:
			_add_choice_button(choice)


## Returns the text that should actually be shown for [param node].
##
## A node (or the event itself) may carry a `conditional_text` block:
##
##   {
##     "conditional_text": {
##       "speaker": "defense",
##       "threshold": 30,
##       "hostile_text": "You again. What do you want?"
##     }
##   }
##
## If the named speaker has a GameState.advisor_trust value below `threshold`
## (default 30), the hostile greeting is shown instead of the node's normal
## "text". Unknown speakers, missing trust entries, and events without a
## conditional_text block fall back to the normal text.
func _resolve_node_text(node: Dictionary) -> String:
	var default_text := str(node.get("text", ""))
	var conditional: Variant = node.get("conditional_text", _event_data.get("conditional_text", {}))
	if not (conditional is Dictionary) or (conditional as Dictionary).is_empty():
		return default_text
	var block: Dictionary = conditional

	var speaker := str(block.get("speaker", _event_data.get("speaker", node.get("speaker", ""))))
	if speaker.is_empty() or not GameState.advisor_trust.has(speaker):
		return default_text

	var threshold := int(block.get("threshold", 30))
	if int(GameState.advisor_trust[speaker]) < threshold:
		return str(block.get("hostile_text", default_text))
	return default_text


func _resolve_node(node_ref: Variant) -> Dictionary:
	# A Dictionary is an inline node, already in the shape we need.
	if node_ref is Dictionary:
		return node_ref

	# A String names a node inside event_data["nodes"] (or, as a fallback,
	# directly inside the event data).
	if node_ref is String and not str(node_ref).is_empty():
		var id := str(node_ref)
		var nodes: Dictionary = _event_data.get("nodes", {})
		if nodes.has(id):
			return nodes[id]
		if _event_data.has(id):
			return _event_data[id]
		return {}

	# Empty/omitted reference plus a flat event means the event data itself is
	# the node: { "text": "...", "choices": [...] }.
	if _event_data.has("text"):
		return _event_data

	return {}


func _add_choice_button(choice: Dictionary) -> void:
	var button := Button.new()
	button.name = "Choice"
	var original_text := str(choice.get("text", "Continue"))
	button.text = original_text
	var locked := false

	# A choice can require the player to have a specific background. When the
	# requirement exists and does not match GameState.player_background, the
	# choice is disabled and the lock tag is prepended so the original option
	# text stays visible.
	var required_background := str(choice.get("required_background", ""))
	if not required_background.is_empty() and str(GameState.player_background) != required_background:
		button.text = "[LOCKED - Background] " + original_text
		locked = true

	# Choices can also be gated on a piece of intel. When a required_secret is
	# present but not yet in GameState.known_secrets, the button is disabled
	# and relabelled so the player can see the option exists but is unavailable.
	var required_secret := str(choice.get("required_secret", ""))
	if not required_secret.is_empty() and not GameState.known_secrets.has(required_secret):
		if locked:
			button.text = "[LOCKED - Background] [LOCKED - Requires Intel] " + original_text
		else:
			button.text = "[LOCKED - Requires Intel]"
		locked = true

	button.disabled = locked
	button.pressed.connect(_on_choice_pressed.bind(choice))
	_choices_box.add_child(button)


func _on_choice_pressed(choice: Dictionary) -> void:
	var stat_impact: Dictionary = choice.get("stat_impact", {})
	var trust_impact: Dictionary = choice.get("trust_impact", {})
	var set_flag := str(choice.get("set_flag", ""))
	GameState.apply_choice(stat_impact, set_flag, trust_impact)
	choice_made.emit(choice)

	var next_ref: Variant = choice.get("next", "")
	_show_node(next_ref)


func _clear_choices() -> void:
	for child in _choices_box.get_children():
		child.queue_free()
	_choices_box.get_children().clear()


func _finish() -> void:
	_clear_choices()
	visible = false
	_event_data = {}
	event_finished.emit()


# ----------------------------------------------------------------------- UI

func _ensure_ui() -> void:
	if _ui_built:
		return
	_ui_built = true

	_dim = ColorRect.new()
	_dim.name = "Dim"
	_dim.color = Color(0.02, 0.03, 0.05, 0.55)
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)

	var centre := CenterContainer.new()
	centre.name = "Centre"
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.custom_minimum_size = Vector2(520.0, 0.0)
	centre.add_child(_panel)

	var margin := MarginContainer.new()
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 18)
	_panel.add_child(margin)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)

	_text_label = Label.new()
	_text_label.name = "EventText"
	_text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text_label.add_theme_font_size_override("font_size", 22)
	column.add_child(_text_label)

	_choices_box = VBoxContainer.new()
	_choices_box.name = "Choices"
	_choices_box.add_theme_constant_override("separation", 8)
	column.add_child(_choices_box)


func _resolve_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://") or path.is_absolute_path():
		return path
	return base_path.path_join(path)
