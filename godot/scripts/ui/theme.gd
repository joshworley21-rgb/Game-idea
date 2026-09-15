class_name UiTheme
extends RefCounted
## One place for the look of the overlay.
##
## The web build's styling lives in CSS; Godot has no equivalent, so the
## handful of colours and the panel background that every card shares are
## here rather than repeated at each construction site. Nothing in this file
## is a port of anything — it is the Godot half of what style.css does.

const INK := Color(0.918, 0.929, 0.949)
const DIM := Color(0.639, 0.678, 0.729)
const GOOD := Color(0.518, 0.800, 0.541)
const BAD := Color(0.902, 0.451, 0.427)
const WARN := Color(0.925, 0.741, 0.353)
const ACCENT := Color(0.451, 0.639, 0.902)

## A dark card with a hairline edge, which is what every panel sits on.
static func card(alpha: float = 0.86, radius: int = 10) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.055, 0.071, 0.094, alpha)
	box.border_color = Color(1, 1, 1, 0.10)
	box.set_border_width_all(1)
	box.set_corner_radius_all(radius)
	box.content_margin_left = 14
	box.content_margin_right = 14
	box.content_margin_top = 10
	box.content_margin_bottom = 10
	return box


## A line of text. Deliberately does NOT wrap by default: a wrapping label
## inside an HBoxContainer has no width to wrap against and collapses to one
## character per line, which is what the first render of the stat panel did.
## Prose asks for wrapping explicitly, and gets a width to do it in.
static func label(text: String, size: int = 15, colour: Color = INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", colour)
	return l


## A paragraph. `width` is what it wraps against, and it must be given —
## see label() for what happens without one.
static func prose(text: String, width: int, size: int = 15,
		colour: Color = INK) -> Label:
	var l := label(text, size, colour)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(width, 0)
	return l


## A button that reads as a choice rather than as a control.
static func choice_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_font_size_override("font_size", 15)
	b.custom_minimum_size = Vector2(0, 40)
	return b


## Vertical space that does not need a named node to exist.
static func gap(height: int = 8) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, height)
	return c
