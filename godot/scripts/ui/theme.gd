class_name UiTheme
extends RefCounted
## The look of the overlay, in one place.
##
## The first version of this file was a colour list and a rounded card, and
## the interface it produced was five bordered boxes competing for a screen
## that already had a room in it. This is a small design system instead:
##
##   One type scale. Four sizes, and each one means something — a display
##   line, body text, a caption, and a micro label. Nothing picks a size.
##
##   One spacing scale. Multiples of four, named, so margins agree without
##   anyone counting pixels.
##
##   Colour only where it carries meaning. Good, warning and bad say how a
##   number is doing; the accent marks one thing per region; everything else
##   is one of three greys. Nothing is coloured to be decorative.
##
##   Scrims instead of cards. A panel border is a box drawn around text that
##   was already readable. Text over the 3D scene gets a gradient that fades
##   to nothing, so the room stays visible and the overlay stops looking like
##   a form.

# ---------------------------------------------------------------- colour

const INK := Color(0.910, 0.929, 0.949)      ## Primary text.
const DIM := Color(0.541, 0.580, 0.651)      ## Labels, secondary text.
const FAINT := Color(0.353, 0.392, 0.451)    ## Dividers, disabled.
const GOOD := Color(0.435, 0.749, 0.451)
const WARN := Color(0.878, 0.706, 0.306)
const BAD := Color(0.878, 0.439, 0.373)
const ACCENT := Color(0.431, 0.608, 0.910)
const SURFACE := Color(0.047, 0.059, 0.078)  ## Panels, and the scrim's dark end.

# ------------------------------------------------------------------ type

const DISPLAY := 21   ## The one line per region that names it.
const BODY := 14      ## Prose and choices.
const CAPTION := 12   ## Supporting detail.
const MICRO := 10     ## Uppercase, letterspaced section labels.

# --------------------------------------------------------------- spacing

const XS := 4
const SM := 8
const MD := 12
const LG := 16
const XL := 24


static func label(text: String, size: int = BODY, colour: Color = INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", colour)
	l.add_theme_constant_override("line_spacing", LINE_SPACING)
	return l


## A paragraph. `width` is what it wraps against and must be given: a
## wrapping label inside an HBoxContainer has no width to wrap against and
## collapses to one character per line.
static func prose(text: String, width: int, size: int = BODY,
		colour: Color = INK) -> Label:
	var l := label(text, size, colour)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(width, 0)
	return l


## A section label: small, upper case, letterspaced. The only thing that
## marks a region, now that regions have no borders.
##
## The spacing is a FontVariation and not spaces pushed between the letters.
## The string stays the string, which matters more than it looks: padding it
## breaks every search over the interface, including the tests that check a
## panel says what it was handed, and it would be read out letter by letter
## by anything assistive.
static func eyebrow(text: String, colour: Color = DIM) -> Label:
	var l := label(text.to_upper(), MICRO, colour)
	l.add_theme_font_override("font", _letterspaced())
	return l


static func _letterspaced() -> FontVariation:
	var font := FontVariation.new()
	font.base_font = ThemeDB.fallback_font
	font.spacing_glyph = 1
	return font


## Makes a label readable over the room rather than over a panel.
##
## The overlay has no boxes behind it any more, so it has to hold up over
## whatever is there — and "whatever is there" ranges from the Oval Office's
## pale striped wall to the Situation Room's near-black panelling. A scrim
## alone cannot do it: strong enough to carry the light room, it curtains the
## dark one.
##
## A thin dark outline does. It costs nothing on the dark rooms, where it is
## invisible, and it is what keeps 12px grey text legible against sunlit
## wallpaper.
static func over_scene(l: Label) -> Label:
	l.add_theme_color_override("font_outline_color", Color(0.020, 0.027, 0.039, 0.78))
	l.add_theme_constant_override("outline_size", 5)
	return l


## Vertical space that does not need a named node.
static func gap(height: int = SM) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, height)
	return c


## A hairline. One pixel of FAINT at low alpha, which is all a divider needs
## once the boxes are gone.
static func rule(width: int = 0) -> Control:
	var r := ColorRect.new()
	r.color = Color(FAINT.r, FAINT.g, FAINT.b, 0.28)
	r.custom_minimum_size = Vector2(width, 1)
	r.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return r


## A gradient that fades the scene out behind an edge of the screen, so text
## reads without being boxed. `from_top` false fades upward from the bottom.
static func scrim(height: int, from_top: bool = true, strength: float = 0.72) -> TextureRect:
	var gradient := Gradient.new()
	gradient.set_color(0, Color(SURFACE.r, SURFACE.g, SURFACE.b, strength))
	gradient.set_color(1, Color(SURFACE.r, SURFACE.g, SURFACE.b, 0.0))
	# Ease the falloff so the edge of the scrim is not a visible line.
	gradient.set_offset(1, 1.0)
	var tex := GradientTexture2D.new()
	tex.gradient = gradient
	tex.width = 1
	tex.height = 256
	tex.fill_from = Vector2(0, 0 if from_top else 1)
	tex.fill_to = Vector2(0, 1 if from_top else 0)
	var rect := TextureRect.new()
	rect.texture = tex
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.custom_minimum_size = Vector2(0, height)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return rect


## The surface a modal sits on. One soft fill, no border: at this contrast a
## border is a line drawn around something already separated from the room.
static func panel_style() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(SURFACE.r, SURFACE.g, SURFACE.b, 0.985)
	box.set_corner_radius_all(14)
	box.content_margin_left = XL
	box.content_margin_right = XL
	box.content_margin_top = XL
	box.content_margin_bottom = XL
	box.shadow_color = Color(0, 0, 0, 0.45)
	box.shadow_size = 24
	return box


## A choice: the whole row is the target, including its description.
##
## Godot's Button is not a container, but it is a Control, so the layout goes
## in as a child that ignores the mouse. Before this the description was a
## sibling Label and tapping it did nothing — which on a phone means half of
## each choice was dead.
static func choice(title: String, detail: String, cost: String,
		width: int) -> Button:
	var b := Button.new()
	b.text = ""
	b.custom_minimum_size = Vector2(width, 0)
	b.add_theme_stylebox_override("normal", _choice_style(0.045))
	b.add_theme_stylebox_override("hover", _choice_style(0.085))
	b.add_theme_stylebox_override("pressed", _choice_style(0.130))
	b.add_theme_stylebox_override("focus", _choice_style(0.085))
	b.add_theme_stylebox_override("disabled", _choice_style(0.020))

	var inner := width - MD * 2

	var rows := VBoxContainer.new()
	rows.set_anchors_preset(Control.PRESET_FULL_RECT)
	rows.offset_left = MD
	rows.offset_right = -MD
	rows.offset_top = SM + 2
	rows.offset_bottom = -(SM + 2)
	rows.add_theme_constant_override("separation", XS)
	rows.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(rows)

	var head := HBoxContainer.new()
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_child(label(title, BODY))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_child(spacer)
	if not cost.is_empty():
		head.add_child(label(cost, CAPTION, DIM))
	rows.add_child(head)
	if not detail.is_empty():
		rows.add_child(prose(detail, inner, CAPTION, DIM))

	# The button has to be told how tall its own contents are, and asking the
	# contents does not work: a wrapping label does not know its own height
	# until it has been laid out at a real width, so the answer at
	# construction time is one line and every choice overlapped the next.
	#
	# Measuring the text against the width it will actually wrap to gives the
	# right answer before anything is in the tree.
	b.custom_minimum_size.y = maxf(46.0, (SM + 2) * 2 + XS
		+ text_height(title, BODY, inner)
		+ (text_height(detail, CAPTION, inner) + XS if not detail.is_empty() else 0.0))
	return b


## The gap a Label leaves between lines, on top of the font's own height.
##
## Godot's default is 3, and a Label reads it from its theme rather than from
## the font — so Font.get_multiline_string_size, which knows nothing about
## Labels, reports two lines of 12px text as 34px while the Label needs 40.
## Sized from the font alone, a two-line label shows one line and an ellipsis
## and nothing says why. Every label this file makes is pinned to this value
## so the arithmetic below is true rather than nearly true.
const LINE_SPACING := 3


## How many lines `text` takes once wrapped to `width`.
static func line_count(text: String, size: int, width: int) -> int:
	if text.is_empty():
		return 0
	var font := ThemeDB.fallback_font
	var box := font.get_multiline_string_size(
		text, HORIZONTAL_ALIGNMENT_LEFT, float(width), size)
	return maxi(1, int(round(box.y / maxf(1.0, font.get_height(size)))))


## How tall a Label holding `text` is once wrapped to `width`. The one
## reliable way to size something around a Label before Godot has laid it out.
static func text_height(text: String, size: int, width: int) -> float:
	return float(line_count(text, size, width)) * line_height(size)


## One line of a Label, spacing included.
static func line_height(size: int) -> float:
	return ThemeDB.fallback_font.get_height(size) + LINE_SPACING


static func _choice_style(alpha: float) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(1, 1, 1, alpha)
	box.set_corner_radius_all(8)
	return box


## The one action in a region that is not a choice between options.
static func primary_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", BODY)
	b.add_theme_color_override("font_color", Color(0.055, 0.075, 0.110))
	b.add_theme_color_override("font_hover_color", Color(0.055, 0.075, 0.110))
	b.add_theme_color_override("font_pressed_color", Color(0.055, 0.075, 0.110))
	b.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.35))
	b.add_theme_stylebox_override("normal", _filled_style(ACCENT))
	b.add_theme_stylebox_override("hover", _filled_style(ACCENT.lightened(0.10)))
	b.add_theme_stylebox_override("pressed", _filled_style(ACCENT.darkened(0.12)))
	b.add_theme_stylebox_override("focus", _filled_style(ACCENT.lightened(0.10)))
	b.add_theme_stylebox_override("disabled", _filled_style(Color(1, 1, 1, 0.07)))
	b.custom_minimum_size = Vector2(0, 44)
	return b


static func _filled_style(colour: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.set_corner_radius_all(8)
	box.content_margin_left = LG
	box.content_margin_right = LG
	return box


## A quiet button: the way out of a panel, and the station chips.
static func quiet_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", BODY)
	b.add_theme_color_override("font_color", DIM)
	b.add_theme_color_override("font_hover_color", INK)
	b.add_theme_color_override("font_pressed_color", INK)
	b.add_theme_stylebox_override("normal", _choice_style(0.045))
	b.add_theme_stylebox_override("hover", _choice_style(0.090))
	b.add_theme_stylebox_override("pressed", _choice_style(0.130))
	b.add_theme_stylebox_override("focus", _choice_style(0.090))
	b.custom_minimum_size = Vector2(0, 40)
	return b
