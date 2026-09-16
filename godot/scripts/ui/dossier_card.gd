class_name DossierCard
extends CanvasLayer
## The dossier card: who this is, what they are worth, and their face.
##
## Built in code rather than authored as a .tscn. The card is one flat column of
## labels and two bars, so a scene file would be a hundred lines of node
## boilerplate to express what a dozen statements say, and every node path in it
## would be one more thing to break by renaming.
##
## Whoever owns the card calls open_card() and waits for `closed`; nothing here
## reaches back into the room it was opened from.


## Dismissed, by the button or by Escape. The room returns the camera on this.
signal closed

const CARD_WIDTH := 360.0
const PORTRAIT_HEIGHT := 300.0

var _person: Dictionary = {}
var _dim: ColorRect
var _portrait: TextureRect
var _name_label: Label
var _title_label: Label
var _detail_label: Label
var _competence: ProgressBar
var _loyalty: ProgressBar
## The mouse was captured for free look before the card opened, so it belongs to
## the player again when the card closes.
var _restore_capture := false


func _ready() -> void:
	layer = 10
	_build()
	visible = false
	set_process_unhandled_input(false)


func is_open() -> bool:
	return visible


## The person on the card. Empty when it is shut.
func person() -> Dictionary:
	return _person


## The portrait the card is showing, or null if the person has none. Read by the
## tests, so that a check on the card's face does not go through the node names
## of a card built in code -- the one thing in here free to be rearranged.
func portrait() -> Texture2D:
	return _portrait.texture if _portrait != null else null


# ------------------------------------------------------------------- the card

func open_card(who: Dictionary, portrait: Texture2D) -> void:
	_person = who
	_portrait.texture = portrait
	_portrait.visible = portrait != null
	_name_label.text = str(who.get("name", "Unknown"))
	_title_label.text = str(who.get("title", ""))
	_detail_label.text = _detail_for(who)
	_competence.value = float(who.get("competence", 0.0))
	_loyalty.value = float(who.get("loyalty", 0.0))
	visible = true
	set_process_unhandled_input(true)
	# Free look holds the mouse. A card the player cannot click is worse than a
	# card that costs them a click to get back.
	if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		_restore_capture = true
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)


func close_card() -> void:
	if not visible:
		return
	visible = false
	set_process_unhandled_input(false)
	_person = {}
	if _restore_capture:
		_restore_capture = false
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	closed.emit()


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		close_card()
		get_viewport().set_input_as_handled()


func _detail_for(who: Dictionary) -> String:
	var lines := PackedStringArray()
	# The temperament line is the one the simulation already writes for whoever
	# is in front of you, so the card and the monthly report read the same way
	# about the same person.
	if who.has("temperament") and who.has("name"):
		lines.append(People.temperament_line(who))
	var extras := PackedStringArray()
	if who.has("faction"):
		extras.append(str(who["faction"]).capitalize())
	if who.has("months"):
		var months := int(who["months"])
		extras.append("in post %d month%s" % [months, "" if months == 1 else "s"])
	if extras.size() > 0:
		lines.append(", ".join(extras))
	if who.has("doing"):
		lines.append(str(who["doing"]))
	if who.has("age"):
		lines.append("Age %d" % int(who["age"]))
	return "\n".join(lines)


# ------------------------------------------------------------------ the build

func _build() -> void:
	_dim = ColorRect.new()
	_dim.name = "Dim"
	_dim.color = Color(0.02, 0.03, 0.05, 0.55)
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# Swallows clicks so a tap meant for Close does not reach the room behind it
	# and open somebody else.
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)

	var centre := CenterContainer.new()
	centre.name = "Centre"
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(centre)

	var panel := PanelContainer.new()
	panel.name = "Panel"
	panel.custom_minimum_size = Vector2(CARD_WIDTH, 0.0)
	centre.add_child(panel)

	var margin := MarginContainer.new()
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 18)
	panel.add_child(margin)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 8)
	margin.add_child(column)

	_portrait = TextureRect.new()
	_portrait.name = "Portrait"
	_portrait.custom_minimum_size = Vector2(0.0, PORTRAIT_HEIGHT)
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	column.add_child(_portrait)

	_name_label = Label.new()
	_name_label.name = "Name"
	_name_label.add_theme_font_size_override("font_size", 28)
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_name_label)

	_title_label = Label.new()
	_title_label.name = "Title"
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_color_override("font_color", Color(0.71, 0.76, 0.85))
	column.add_child(_title_label)

	column.add_child(HSeparator.new())

	_competence = _stat(column, "Competence")
	_loyalty = _stat(column, "Loyalty")

	_detail_label = Label.new()
	_detail_label.name = "Detail"
	_detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail_label.custom_minimum_size = Vector2(0.0, 72.0)
	_detail_label.add_theme_color_override("font_color", Color(0.78, 0.80, 0.86))
	column.add_child(_detail_label)

	var close := Button.new()
	close.name = "Close"
	close.text = "Close"
	close.pressed.connect(close_card)
	column.add_child(close)


func _stat(parent: Node, title: String) -> ProgressBar:
	var row := VBoxContainer.new()
	row.name = title

	var label := Label.new()
	label.text = title
	label.add_theme_font_size_override("font_size", 14)
	row.add_child(label)

	var bar := ProgressBar.new()
	bar.max_value = 100.0
	bar.show_percentage = true
	row.add_child(bar)

	parent.add_child(row)
	return bar
