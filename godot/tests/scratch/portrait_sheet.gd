extends Node
## Scratch: a contact sheet of the portraits, so they get looked at.

const CAST := [
	["Ruth Ellery", 58, "suit"], ["Helen Osei", 54, "suit"],
	["Samuel Dubois", 61, "suit"], ["Andre Sandoval", 49, "suit"],
	["Marcus Okonkwo", 52, "suit"], ["Charles Brennan", 46, "suit"],
	["Priya", 55, "smart"], ["Sofia", 23, "casual"], ["Nora", 14, "casual"],
]

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color(0.047, 0.059, 0.078))
	var page := VBoxContainer.new()
	page.set_anchors_preset(Control.PRESET_FULL_RECT)
	page.offset_left = 24
	page.offset_top = 20
	page.add_theme_constant_override("separation", 14)
	add_child(page)

	_section(page, "The cast, neutral", CAST.map(func(p):
		return {"seed": p[0], "label": p[0], "sub": "%d · %s" % [p[1], p[2]],
			"age": p[1], "dress": p[2], "mood": "neutral"}))
	_section(page, "One person, every mood — Helen Osei",
		Portrait.MOODS.map(func(m):
			return {"seed": "Helen Osei", "label": m, "sub": "54 · suit",
				"age": 54, "dress": "suit", "mood": m}))
	_section(page, "Same mood, different seeds — hostile",
		CAST.slice(0, 6).map(func(p):
			return {"seed": p[0], "label": p[0], "sub": "hostile",
				"age": p[1], "dress": p[2], "mood": "hostile"}))
	_section(page, "At the size a panel shows them", CAST.slice(0, 6).map(func(p):
		return {"seed": p[0], "label": "", "sub": "", "size": 56,
			"age": p[1], "dress": p[2], "mood": "neutral"}))

func _section(page: VBoxContainer, title: String, items: Array) -> void:
	page.add_child(UiTheme.eyebrow(title, UiTheme.ACCENT))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	page.add_child(row)
	for it in items:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 4)
		row.add_child(cell)
		var px: int = it.get("size", 132)
		var face := Portrait.new(it["seed"], it["mood"], it["age"], it["dress"])
		face.custom_minimum_size = Vector2(px, px)
		cell.add_child(face)
		if not str(it["label"]).is_empty():
			cell.add_child(UiTheme.label(str(it["label"]), UiTheme.CAPTION))
			cell.add_child(UiTheme.label(str(it["sub"]), UiTheme.MICRO, UiTheme.DIM))

func _process(_d: float) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(
		OS.get_environment("UI_SHOT_DIR") + "/portrait-sheet.png")
	get_tree().quit(0)
