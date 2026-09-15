class_name Portrait
extends Control
## A face for the person you are talking to.
##
## Drawn here rather than ported from the web build, which renders a real 3D
## head through three.js. That head is good work and it is the same geometry
## as the figure standing in the room — but as a portrait it fails at the one
## job a portrait has in this game, which is saying how the meeting is going.
## Its whole mood range is a 5-degree head turn and a quarter-radian eyelid,
## and at the size a panel shows a face those are invisible: all seven moods
## render as the same picture.
##
## So this is 2D, drawn at the size it is displayed, and its moods are
## exaggerated until they read. A portrait that has to be squinted at to tell
## hostile from warm is decoration; one that tells you across the room is
## information.
##
## Everything about a face is derived from its seed, so a secretary is the
## same person every time they appear, and appointing a new one gets you
## somebody who looks different.

const MOODS := ["neutral", "warm", "concerned", "hostile", "tired", "amused", "guarded"]

## How a mood is drawn. These are large on purpose — see the note above.
##
## brow_inner  raises (+) or lowers (-) the inner end of each brow. Inner up
##             reads as worried; inner down reads as angry. It is the single
##             most legible thing on a face at this size.
## brow_lift   moves both brows up or down together: surprise against glower.
## lid         how far the upper lid is dropped, 0 to 1 of the eye.
## mouth       the curve: +1 is a full smile, -1 a full frown.
## mouth_width narrows a tight mouth or widens an open one.
## tilt        head roll in degrees.
const MOOD_SHAPE := {
	"neutral":   {"brow_inner": 0.00, "brow_lift": 0.00, "lid": 0.08, "mouth": 0.00, "mouth_width": 1.00, "tilt": 0.0},
	"warm":      {"brow_inner": 0.10, "brow_lift": 0.10, "lid": 0.02, "mouth": 0.85, "mouth_width": 1.12, "tilt": 3.0},
	"concerned": {"brow_inner": 0.55, "brow_lift": 0.10, "lid": 0.05, "mouth": -0.40, "mouth_width": 0.92, "tilt": -3.0},
	"hostile":   {"brow_inner": -0.65, "brow_lift": -0.18, "lid": 0.30, "mouth": -0.55, "mouth_width": 0.88, "tilt": 0.0},
	"tired":     {"brow_inner": 0.05, "brow_lift": -0.22, "lid": 0.52, "mouth": -0.18, "mouth_width": 0.95, "tilt": -5.0},
	"amused":    {"brow_inner": -0.10, "brow_lift": 0.22, "lid": 0.10, "mouth": 0.95, "mouth_width": 1.05, "tilt": 5.0},
	"guarded":   {"brow_inner": -0.30, "brow_lift": -0.06, "lid": 0.22, "mouth": -0.10, "mouth_width": 0.80, "tilt": -2.0},
}

const SKINS := [
	Color(0.945, 0.816, 0.714), Color(0.902, 0.749, 0.616),
	Color(0.812, 0.639, 0.494), Color(0.643, 0.475, 0.353),
	Color(0.478, 0.333, 0.243), Color(0.337, 0.227, 0.169),
]

const HAIRS := [
	Color(0.106, 0.090, 0.082), Color(0.216, 0.153, 0.110),
	Color(0.353, 0.239, 0.157), Color(0.514, 0.373, 0.216),
	Color(0.643, 0.510, 0.345), Color(0.396, 0.216, 0.153),
]

## What a suit, a smart jacket and a jumper are, in that order. The player
## sees dress before they read the caption, so a child does not turn up in
## pinstripes.
const CLOTHES := {
	"suit": [Color(0.133, 0.153, 0.196), Color(0.176, 0.184, 0.220), Color(0.149, 0.169, 0.208)],
	"smart": [Color(0.267, 0.243, 0.290), Color(0.204, 0.239, 0.290), Color(0.290, 0.239, 0.243)],
	"casual": [Color(0.243, 0.353, 0.510), Color(0.290, 0.412, 0.353), Color(0.431, 0.322, 0.290)],
	"robe": [Color(0.106, 0.106, 0.122), Color(0.122, 0.106, 0.114), Color(0.098, 0.114, 0.110)],
}

const TIES := [
	Color(0.596, 0.180, 0.212), Color(0.176, 0.310, 0.541),
	Color(0.180, 0.404, 0.322), Color(0.502, 0.427, 0.157),
	Color(0.400, 0.243, 0.478),
]

var seed_text := "":
	set(value):
		seed_text = value
		_look = _read_look()
		queue_redraw()

var mood := "neutral":
	set(value):
		mood = value if MOOD_SHAPE.has(value) else "neutral"
		queue_redraw()

var age := -1:
	set(value):
		age = value
		_look = _read_look()
		queue_redraw()

var dress := "suit":
	set(value):
		dress = value if CLOTHES.has(value) else "suit"
		_look = _read_look()
		queue_redraw()

var _look := {}


func _init(who: String = "", who_mood: String = "neutral", who_age: int = -1,
		who_dress: String = "suit") -> void:
	custom_minimum_size = Vector2(64, 64)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# The shoulders are wider than the plate behind them on purpose; clipping
	# is what turns that into a portrait crop rather than an overflow.
	clip_contents = true
	age = who_age
	dress = who_dress
	mood = who_mood
	seed_text = who


## FNV-1a over the seed, so a name always draws the same person. The same
## digest the parity tests use, for the same reason: it is stable everywhere.
static func _digest(text: String) -> int:
	var h := 0x811c9dc5
	for byte in text.to_utf8_buffer():
		h ^= byte
		h = (h * 0x01000193) & 0xFFFFFFFF
	return h


## Everything the seed decides. Pulled once rather than per draw, because a
## portrait redraws on every mood change and none of this moves.
func _read_look() -> Dictionary:
	# Eight bytes, from two digests.
	#
	# One 32-bit digest is four bytes, and the first version of this asked it
	# for eight — shifting by 36, 40, 48 and 56. A 32-bit value shifted past
	# its own width is zero, so every one of those features came back as the
	# same constant: the whole cast wore the same red tie, had the same nose
	# and the same eye spacing, and it read as a rendering bug rather than as
	# what it was.
	var bytes: Array[int] = []
	for h in [_digest(seed_text), _digest(seed_text + "/second")]:
		for i in 4:
			bytes.append((h >> (i * 8)) & 0xFF)

	# Each feature takes its own byte, so changing one letter of a name
	# changes the whole face rather than sliding it along a scale.
	var pick := func(index: int, count: int) -> int:
		return bytes[index] % count
	var unit := func(index: int) -> float:
		return float(bytes[index]) / 255.0

	var years: int = age if age >= 0 else 30 + pick.call(7, 40)
	# Grey comes in from the mid-forties and is most of the head by seventy.
	var grey := clampf((float(years) - 44.0) / 26.0, 0.0, 0.85)
	var hair: Color = HAIRS[pick.call(1, HAIRS.size())].lerp(
		Color(0.788, 0.796, 0.812), grey)

	var palette: Array = CLOTHES[dress]
	return {
		"skin": SKINS[pick.call(0, SKINS.size())],
		"hair": hair,
		# Four silhouettes: swept, cropped, bob, and bald on top. A style is
		# more of what tells two people apart at this size than the face is.
		"style": pick.call(2, 4),
		# A child is not a small adult: the cranium is proportionally bigger,
		# the jaw rounder and the eyes sit lower and wider. Without this a
		# fourteen-year-old daughter turns up looking like a junior minister.
		"youth": clampf((20.0 - float(years)) / 9.0, 0.0, 1.0),
		"face": 0.86 + unit.call(3) * 0.28,      # width of the head
		"jaw": 0.30 + unit.call(4) * 0.45,       # square against round
		"brow_weight": 0.7 + unit.call(5) * 0.8,
		"nose": 0.8 + unit.call(6) * 0.5,
		"eye_gap": 0.88 + unit.call(7) * 0.24,
		"glasses": pick.call(5, 5) == 0,
		# Beards only on the older half of the cast, and never on a child.
		"beard": pick.call(6, 4) == 0 and years > 28,
		"cloth": palette[pick.call(4, palette.size())],
		"tie": TIES[pick.call(3, TIES.size())],
		# A tie belongs with a suit, not with a jumper.
		"has_tie": dress == "suit" or dress == "smart",
		"years": years,
	}


func _draw() -> void:
	if _look.is_empty():
		_look = _read_look()
	var box := size
	var unit := minf(box.x, box.y)
	var shape: Dictionary = MOOD_SHAPE[mood]

	# A soft plate behind the head, so a portrait reads as a portrait over
	# whatever is behind it rather than as a floating head.
	draw_circle(box * 0.5, unit * 0.5, Color(1, 1, 1, 0.045))

	# Everything below is in a space where the head is one unit tall and the
	# origin is the middle of the face, then rotated by the mood's tilt. It
	# keeps the arithmetic readable and makes the tilt one line.
	var centre := Vector2(box.x * 0.5, box.y * 0.47)
	draw_set_transform(centre, deg_to_rad(float(shape["tilt"])), Vector2(unit, unit))

	_draw_shoulders()
	_draw_head(shape)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_shoulders() -> void:
	var cloth: Color = _look["cloth"]
	# Shoulders as one rounded mass rather than two, which at this size is
	# the difference between a person and a coat hanger.
	var shoulder := PackedVector2Array([
		Vector2(-0.62, 0.62), Vector2(-0.46, 0.38), Vector2(-0.20, 0.28),
		Vector2(0.20, 0.28), Vector2(0.46, 0.38), Vector2(0.62, 0.62),
	])
	draw_colored_polygon(shoulder, cloth)

	if _look["has_tie"]:
		# A collar, and the wedge of shirt between its points.
		draw_colored_polygon(PackedVector2Array([
			Vector2(-0.13, 0.28), Vector2(0.13, 0.28),
			Vector2(0.07, 0.50), Vector2(-0.07, 0.50),
		]), Color(0.902, 0.910, 0.925))
		draw_colored_polygon(PackedVector2Array([
			Vector2(-0.045, 0.34), Vector2(0.045, 0.34),
			Vector2(0.035, 0.62), Vector2(-0.035, 0.62),
		]), _look["tie"])
	else:
		# A plain neckline for anyone not in a collar.
		draw_colored_polygon(PackedVector2Array([
			Vector2(-0.12, 0.28), Vector2(0.12, 0.28),
			Vector2(0.09, 0.36), Vector2(-0.09, 0.36),
		]), cloth.darkened(0.25))


func _draw_head(shape: Dictionary) -> void:
	var skin: Color = _look["skin"]
	var youth: float = _look["youth"]
	var w: float = float(_look["face"]) * 0.265 * (1.0 + youth * 0.07)
	# A round jaw whatever the seed said, once the face is young enough.
	var jaw: float = lerpf(float(_look["jaw"]), 0.05, youth)

	# The neck, before the head, so the jaw sits over it.
	draw_colored_polygon(PackedVector2Array([
		Vector2(-0.085, 0.10), Vector2(0.085, 0.10),
		Vector2(0.10, 0.32), Vector2(-0.10, 0.32),
	]), skin.darkened(0.18))

	# The head: an outline swept from the crown down to the chin, with the
	# jaw's squareness deciding how fast it narrows.
	var head := PackedVector2Array()
	var steps := 34
	for i in steps + 1:
		var t := float(i) / float(steps)
		var a := -PI * 0.5 + t * TAU
		var rx := w
		var ry := 0.395
		var p := Vector2(cos(a) * rx, sin(a) * ry)
		if p.y > 0.0:
			# Below the eyeline the sides draw in toward the chin; a square
			# jaw pulls in later and less.
			var k := p.y / ry
			p.x *= lerpf(1.0 - k * 0.42, 1.0 - k * 0.12, jaw)
			p.y *= 1.06
		head.append(p)
	draw_colored_polygon(head, skin)

	# Ears, behind the hair, and only where a style leaves them out.
	if int(_look["style"]) != 2:
		for side in [-1.0, 1.0]:
			draw_circle(Vector2(side * (w + 0.015), 0.01), 0.045, skin.darkened(0.08))

	# A shadow under the hairline, drawn before the hair so the hair covers
	# its top half and only the part that falls on the forehead shows. The
	# first version drew it afterwards at a fixed height, which put a hard
	# stripe across every forehead whatever the style's hairline actually
	# was, and read as a headband rather than as shading.
	var line_y := _hairline_y()
	if not is_nan(line_y):
		# Only as wide as the skull is at that height, or the ends stick out
		# past the temples as two little tabs.
		var half := w * sqrt(maxf(0.0, 1.0 - pow(line_y / 0.395, 2.0))) * 0.92
		draw_line(Vector2(-half, line_y), Vector2(half, line_y),
			skin.darkened(0.14), 0.055)
	_draw_hair(w)
	_draw_eyes(shape, w)
	_draw_brows(shape, w)
	_draw_nose()
	_draw_mouth(shape)
	if _look["beard"]:
		_draw_beard(w, jaw)
	if _look["glasses"]:
		_draw_glasses(w)


## How far the hairline has moved back, which is most of what says "older" at
## this size once the grey is in.
func _recede() -> float:
	var years := int(_look["years"])
	return 0.0 if years < 45 else clampf(float(years - 45) / 40.0, 0.0, 0.35)


## Where the front edge of the hair falls, so the shading under it can follow
## the style. NAN for a head with nothing at the front to cast one.
func _hairline_y() -> float:
	var recede := _recede()
	match int(_look["style"]):
		0: return -0.20 + recede * 0.15
		1: return -0.30 + recede * 0.12
		2: return -0.10
		_: return NAN


func _draw_hair(w: float) -> void:
	var hair: Color = _look["hair"]
	var style := int(_look["style"])
	var recede := _recede()

	match style:
		0:
			# Swept across, with a parting.
			var cap := PackedVector2Array([
				Vector2(-w - 0.02, 0.02), Vector2(-w - 0.03, -0.20),
				Vector2(-w * 0.55, -0.40 + recede * 0.10),
				Vector2(w * 0.30, -0.42 + recede * 0.10),
				Vector2(w + 0.03, -0.22), Vector2(w + 0.02, 0.04),
				Vector2(w * 0.72, -0.16 + recede * 0.14),
				Vector2(-w * 0.30, -0.24 + recede * 0.16),
				Vector2(-w * 0.86, -0.12),
			])
			draw_colored_polygon(cap, hair)
		1:
			# Cropped close: a thin shell that follows the skull.
			var cap := PackedVector2Array()
			for i in 21:
				var a := PI + float(i) / 20.0 * PI
				cap.append(Vector2(cos(a) * (w + 0.02), sin(a) * 0.38 + recede * 0.06))
			for i in 21:
				var a := TAU - float(i) / 20.0 * PI
				cap.append(Vector2(cos(a) * w * 0.94, sin(a) * 0.30 + recede * 0.12))
			draw_colored_polygon(cap, hair)
		2:
			# A bob, past the jaw, which also hides the ears.
			draw_colored_polygon(PackedVector2Array([
				Vector2(-w - 0.06, 0.26), Vector2(-w - 0.07, -0.18),
				Vector2(-w * 0.5, -0.42), Vector2(w * 0.5, -0.42),
				Vector2(w + 0.07, -0.18), Vector2(w + 0.06, 0.26),
				Vector2(w * 0.80, 0.20), Vector2(w * 0.86, -0.10),
				Vector2(-w * 0.86, -0.10), Vector2(-w * 0.80, 0.20),
			]), hair)
		_:
			# Bald on top, hair round the sides.
			draw_colored_polygon(PackedVector2Array([
				Vector2(-w - 0.02, 0.06), Vector2(-w - 0.03, -0.14),
				Vector2(-w * 0.78, -0.22), Vector2(-w * 0.80, 0.00),
				Vector2(-w * 0.86, 0.10),
			]), hair)
			draw_colored_polygon(PackedVector2Array([
				Vector2(w + 0.02, 0.06), Vector2(w + 0.03, -0.14),
				Vector2(w * 0.78, -0.22), Vector2(w * 0.80, 0.00),
				Vector2(w * 0.86, 0.10),
			]), hair)


func _eye_centres(w: float) -> Array:
	var youth: float = _look["youth"]
	var gap: float = float(_look["eye_gap"]) * w * (0.46 + youth * 0.04)
	var y := -0.04 + youth * 0.055
	return [Vector2(-gap, y), Vector2(gap, y)]


func _draw_eyes(shape: Dictionary, w: float) -> void:
	var skin: Color = _look["skin"]
	var lid: float = shape["lid"]
	# Small, and mostly iris.
	#
	# The first pass drew a wide white ellipse with a dot in it, which is how
	# a cartoon draws a startled animal: every one of these people looked
	# like they had just been caught at something. A real eye at this scale
	# is a dark almond with very little white showing, so the white is narrow,
	# the iris nearly fills it, and there is always a lid line above.
	var grow := 1.0 + float(_look["youth"]) * 0.18
	var rx := 0.041 * grow
	var open := 1.0 - lid * 0.88
	var ry := 0.027 * open * grow
	for c in _eye_centres(w):
		if ry < 0.007:
			draw_line(c + Vector2(-rx, 0), c + Vector2(rx, 0),
				skin.darkened(0.55), 0.013)
			continue
		_ellipse(c, Vector2(rx, ry), Color(0.925, 0.918, 0.906))
		var iris: Vector2 = c + Vector2(0.0, ry * 0.10)
		var r := minf(rx * 0.62, ry * 1.05)
		_ellipse(iris, Vector2(r, r), Color(0.227, 0.263, 0.302))
		_ellipse(iris, Vector2(r * 0.46, r * 0.46), Color(0.043, 0.051, 0.063))
		# The lid, always: it is what stops an eye reading as a hole, and how
		# far it has dropped is most of what "tired" looks like.
		draw_line(c + Vector2(-rx - 0.004, -ry), c + Vector2(rx + 0.004, -ry),
			skin.darkened(0.42), 0.011)


func _draw_brows(shape: Dictionary, w: float) -> void:
	var hair: Color = _look["hair"]
	# Lighter brows on a young face; a heavy brow is most of what ages one.
	var weight: float = float(_look["brow_weight"]) * 0.026 \
		* (1.0 - float(_look["youth"]) * 0.35)
	var inner: float = shape["brow_inner"]
	var lift: float = shape["brow_lift"]
	for i in 2:
		var c: Vector2 = _eye_centres(w)[i]
		var side := -1.0 if i == 0 else 1.0
		var base := c.y - 0.085 - lift * 0.045
		# The inner end is the one that moves. Up is worried, down is angry.
		var a := Vector2(c.x - side * 0.055, base - inner * 0.055)
		var b := Vector2(c.x + side * 0.055, base + inner * 0.012)
		draw_line(a, b, hair.darkened(0.15), weight)


func _draw_nose() -> void:
	var skin: Color = _look["skin"]
	var length: float = float(_look["nose"]) * 0.085 \
		* (1.0 - float(_look["youth"]) * 0.30)
	draw_line(Vector2(0.012, -0.02), Vector2(0.0, length),
		skin.darkened(0.22), 0.013)
	draw_line(Vector2(0.0, length), Vector2(-0.026, length - 0.006),
		skin.darkened(0.22), 0.013)


func _draw_mouth(shape: Dictionary) -> void:
	var skin: Color = _look["skin"]
	var curve: float = shape["mouth"]
	var half: float = 0.072 * float(shape["mouth_width"]) * float(_look["face"])
	var y := 0.175 + float(_look["youth"]) * 0.020
	# A quadratic through three points: the curve is the middle one, and it is
	# the second-most legible thing on the face after the brows.
	var a := Vector2(-half, y - curve * 0.020)
	var b := Vector2(0.0, y + curve * 0.055)
	var c := Vector2(half, y - curve * 0.020)
	var line := PackedVector2Array()
	for i in 13:
		var t := float(i) / 12.0
		line.append(a.lerp(b, t).lerp(b.lerp(c, t), t))
	draw_polyline(line, skin.darkened(0.48), 0.016)


func _draw_beard(w: float, jaw: float) -> void:
	var hair: Color = _look["hair"]
	# Follows the jaw it was drawn against rather than a fixed outline, so a
	# square-jawed face does not get a round beard.
	var edge: float = w * lerpf(0.72, 0.92, jaw)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-edge, 0.06), Vector2(-edge * 0.92, 0.26),
		Vector2(0.0, 0.36), Vector2(edge * 0.92, 0.26),
		Vector2(edge, 0.06), Vector2(edge * 0.80, 0.14),
		Vector2(0.0, 0.24), Vector2(-edge * 0.80, 0.14),
	]), Color(hair.r, hair.g, hair.b, 0.88))


func _draw_glasses(w: float) -> void:
	var frame := Color(0.180, 0.196, 0.220, 0.92)
	var centres := _eye_centres(w)
	for c in centres:
		_ring(c, Vector2(0.078, 0.062), frame, 0.011)
	draw_line(centres[0] + Vector2(0.078, 0.0), centres[1] - Vector2(0.078, 0.0),
		frame, 0.010)


## Godot's Control has draw_circle but no draw_ellipse, and a face is all
## ellipses.
func _ellipse(centre: Vector2, radii: Vector2, colour: Color) -> void:
	var points := PackedVector2Array()
	for i in 24:
		var a := float(i) / 24.0 * TAU
		points.append(centre + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	draw_colored_polygon(points, colour)


func _ring(centre: Vector2, radii: Vector2, colour: Color, width: float) -> void:
	var points := PackedVector2Array()
	for i in 25:
		var a := float(i) / 24.0 * TAU
		points.append(centre + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	draw_polyline(points, colour, width)
