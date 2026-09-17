class_name CabinetDossier
extends CanvasLayer
## Full-screen cabinet roster overlay.
##
## The cabinet is six fixed offices: Chief of Staff, Treasury, State, Defense,
## Justice and Health. GameState fills each office with a name, tracks how much
## that secretary trusts the player, and remembers any leverage strings the
## player has discovered. This overlay shows those six people together in one
## grid, so the player can glance at the whole cabinet mid-turn rather than
## opening one dossier card at a time.
##
## The overlay is built in code, like the HUD and DossierCard, because the
## visual tree is a grid of six identical slots. One script that repeats a
## slot builder six times is easier to keep in step with GameState than a
## hand-authored scene with six copies of the same node hierarchy.

const ROLE_IDS: Array[String] = [
	"chief", "treasury", "state", "defense", "justice", "health",
]

const ROLE_TITLES := {
	"chief": "Chief of Staff",
	"treasury": "Treasury",
	"state": "State",
	"defense": "Defense",
	"justice": "Justice",
	"health": "Health",
}

## Cabinet portraits are first-name files in the cabinet folder. The Chief of
## Staff also has a dedicated full-name portrait that should win whenever the
## chief drawn into the run is Ruth; everyone else uses the cabinet portrait
## for their first name.
const CABINET_PORTRAIT_ROOT := "res://godot/assets/portraits/cabinet"
const CHIEF_PORTRAIT_PATH := "res://godot/assets/portraits/chief/ruth-ellery.webp"

const SLOT_WIDTH := 330.0
const PORTRAIT_HEIGHT := 150.0

## Resolved by path rather than the bare autoload name, matching the HUD. The
## shipped game supplies /root/GameState through project.godot; resolving it
## this way also lets the overlay degrade to empty slots if the autoload is
## missing while a scene is being edited on its own.
var _state: Node = null

var _dim: ColorRect
var _panel: PanelContainer
var _grid: GridContainer
var _slots: Dictionary = {}


func _ready() -> void:
	layer = 20
	_state = get_node_or_null("/root/GameState")
	_build()
	_refresh()
	visible = false
	set_process_unhandled_input(false)

	if _state != null and _state.has_signal("stats_changed"):
		_state.connect("stats_changed", Callable(self, "_on_stats_changed"))


# ------------------------------------------------------------------ show/hide

func is_open() -> bool:
	return visible


func open() -> void:
	visible = true
	# Refresh on open so the grid is correct even if the overlay sat closed
	# through several choices (and therefore several signal-driven refreshes).
	_refresh()
	set_process_unhandled_input(true)


func close() -> void:
	if not visible:
		return
	visible = false
	set_process_unhandled_input(false)


func toggle() -> void:
	if visible:
		close()
	else:
		open()


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		close()
		get_viewport().set_input_as_handled()


# ------------------------------------------------------------------ the build

func _build() -> void:
	_dim = ColorRect.new()
	_dim.name = "Dim"
	_dim.color = Color(0.02, 0.03, 0.05, 0.72)
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)

	var centre := CenterContainer.new()
	centre.name = "Centre"
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.custom_minimum_size = Vector2(760.0, 0.0)
	centre.add_child(_panel)

	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.03, 0.04, 0.07, 0.94)
	panel_style.border_color = Color(0.85, 0.88, 0.94, 0.18)
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(12)
	panel_style.content_margin_left = 20.0
	panel_style.content_margin_right = 20.0
	panel_style.content_margin_top = 18.0
	panel_style.content_margin_bottom = 18.0
	_panel.add_theme_stylebox_override("panel", panel_style)

	var margin := MarginContainer.new()
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 6)
	_panel.add_child(margin)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	var heading := Label.new()
	heading.name = "Heading"
	heading.text = "Cabinet Dossier"
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 26)
	heading.add_theme_color_override("font_color", Color(0.94, 0.95, 0.97, 1.0))
	column.add_child(heading)

	_grid = GridContainer.new()
	_grid.name = "Grid"
	_grid.columns = 2
	_grid.add_theme_constant_override("h_separation", 14)
	_grid.add_theme_constant_override("v_separation", 14)
	column.add_child(_grid)

	for role_id in ROLE_IDS:
		_slots[role_id] = _build_slot(role_id)

	var close_button := Button.new()
	close_button.name = "Close"
	close_button.text = "Close"
	close_button.pressed.connect(close)
	column.add_child(close_button)


func _build_slot(role_id: String) -> Dictionary:
	var card := PanelContainer.new()
	card.name = role_id.capitalize()
	card.custom_minimum_size = Vector2(SLOT_WIDTH, 0.0)

	var card_style := StyleBoxFlat.new()
	card_style.bg_color = Color(1.0, 1.0, 1.0, 0.05)
	card_style.border_color = Color(1.0, 1.0, 1.0, 0.08)
	card_style.set_border_width_all(1)
	card_style.set_corner_radius_all(10)
	card_style.content_margin_left = 14.0
	card_style.content_margin_right = 14.0
	card_style.content_margin_top = 12.0
	card_style.content_margin_bottom = 12.0
	card.add_theme_stylebox_override("panel", card_style)

	var box := VBoxContainer.new()
	box.name = "Column"
	box.add_theme_constant_override("separation", 6)
	card.add_child(box)

	var role_label := Label.new()
	role_label.name = "Role"
	role_label.text = str(ROLE_TITLES.get(role_id, role_id))
	role_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	role_label.add_theme_font_size_override("font_size", 13)
	role_label.add_theme_color_override("font_color", Color(0.68, 0.73, 0.82, 1.0))
	box.add_child(role_label)

	var portrait := TextureRect.new()
	portrait.name = "Portrait"
	portrait.custom_minimum_size = Vector2(0.0, PORTRAIT_HEIGHT)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	box.add_child(portrait)

	var name_label := Label.new()
	name_label.name = "Name"
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.add_theme_font_size_override("font_size", 20)
	name_label.add_theme_color_override("font_color", Color(0.93, 0.94, 0.96, 1.0))
	box.add_child(name_label)

	var archetype_label := Label.new()
	archetype_label.name = "Archetype"
	archetype_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	archetype_label.add_theme_font_size_override("font_size", 14)
	archetype_label.add_theme_color_override("font_color", Color(0.76, 0.80, 0.88, 1.0))
	box.add_child(archetype_label)

	var trust_header := Label.new()
	trust_header.name = "TrustHeader"
	trust_header.text = "Trust"
	trust_header.add_theme_font_size_override("font_size", 13)
	trust_header.add_theme_color_override("font_color", Color(0.68, 0.73, 0.82, 1.0))
	box.add_child(trust_header)

	var trust_bar := ProgressBar.new()
	trust_bar.name = "Trust"
	trust_bar.min_value = 0.0
	trust_bar.max_value = 100.0
	trust_bar.step = 0.1
	trust_bar.show_percentage = true
	trust_bar.custom_minimum_size = Vector2(0.0, 8.0)
	box.add_child(trust_bar)

	var intel_label := Label.new()
	intel_label.name = "Intel"
	intel_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	intel_label.custom_minimum_size = Vector2(0.0, 52.0)
	intel_label.add_theme_font_size_override("font_size", 13)
	intel_label.add_theme_color_override("font_color", Color(0.72, 0.77, 0.86, 1.0))
	box.add_child(intel_label)

	_grid.add_child(card)

	return {
		"portrait": portrait,
		"name": name_label,
		"archetype": archetype_label,
		"trust": trust_bar,
		"intel": intel_label,
	}


# ------------------------------------------------------------------ the data

func _refresh() -> void:
	var roles := _state_dict("cabinet_roles")
	var trust := _state_dict("advisor_trust")

	for role_id in ROLE_IDS:
		if not _slots.has(role_id):
			continue
		var slot: Dictionary = _slots[role_id]
		var first := str(roles.get(role_id, ""))
		_set_text(slot.get("name") as Label, first if not first.is_empty() else "Vacant")
		_set_text(slot.get("archetype") as Label, _archetype_text(first))
		_set_portrait(slot.get("portrait") as TextureRect, role_id, first)

		var trust_value := int(trust.get(role_id, 50))
		var bar: ProgressBar = slot.get("trust") as ProgressBar
		if bar != null:
			bar.value = float(clampi(trust_value, 0, 100))

		_set_text(slot.get("intel") as Label, _intel_text(role_id))


func _state_dict(key: String) -> Dictionary:
	if _state == null:
		return {}
	var value: Variant = _state.get(key)
	if value is Dictionary:
		return value
	return {}


func _archetype_text(first: String) -> String:
	if first.is_empty():
		return "Awaiting appointment"
	if _state != null and _state.has_method("voice_archetype"):
		var archetype := str(_state.call("voice_archetype", first))
		if not archetype.is_empty():
			return archetype
	return "Undisclosed"


func _intel_text(role_id: String) -> String:
	var secrets: PackedStringArray = PackedStringArray()
	if _state != null:
		var raw: Variant = _state.get("known_secrets")
		if raw is Array:
			for entry in raw:
				var secret := str(entry)
				if secret.begins_with(role_id + "_"):
					secrets.append("• " + secret)
	if secrets.is_empty():
		return "No Intel"
	return "\n".join(secrets)


func _set_portrait(rect: TextureRect, role_id: String, first: String) -> void:
	if rect == null:
		return
	var path := _portrait_path(role_id, first)
	if path.is_empty() or not ResourceLoader.exists(path):
		rect.texture = null
		return
	rect.texture = load(path) as Texture2D


func _portrait_path(role_id: String, first: String) -> String:
	if first.is_empty():
		return ""
	# The Chief of Staff has a dedicated full-name portrait. It is used only
	# when the chief actually is Ruth; any other chief is a normal cabinet
	# draw and their first-name portrait lives with the rest of the cabinet.
	if role_id == "chief" and first.to_lower() == "ruth" and ResourceLoader.exists(CHIEF_PORTRAIT_PATH):
		return CHIEF_PORTRAIT_PATH
	return CABINET_PORTRAIT_ROOT + "/" + Cast.slug(first) + ".webp"


func _set_text(label: Label, text: String) -> void:
	if label != null:
		label.text = text


# ------------------------------------------------------------------- signals

func _on_stats_changed() -> void:
	if visible:
		_refresh()
