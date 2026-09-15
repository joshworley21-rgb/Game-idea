class_name World
extends Node3D
## The rooms, built from the table in Rooms.
##
## One room exists at a time. Loading a model takes long enough to be visible
## on a phone, so a room that has been visited is kept rather than freed — the
## Oval Office is 14 MB of mesh and the player goes back to it constantly.
##
## Nothing in here is authored as a transform. The seats are eye and look-at
## points and the camera is aimed with look_at, which is the one way to place
## a camera that cannot come out transposed.

signal room_entered(room_id: String, room_name: String)

var camera: Camera3D
var _environment: WorldEnvironment
var _rooms: Dictionary = {}
var _lights: Dictionary = {}
var _current := ""

## Where the current seat faces, and how far the player has turned from it.
## The seat is the anchor: looking around never walks the camera off it, and
## taking a seat resets the offset, so a station always opens on the view it
## was chosen for.
var _seat_basis := Basis()
var _yaw := 0.0
var _pitch := 0.0
var _dragging := false

## How far the head turns. A seat is a point of view, not a free camera, so
## the limits are generous rather than absent — you can look at the room you
## are in and not at the back of your own chair.
const YAW_LIMIT := deg_to_rad(75.0)
const PITCH_LIMIT := deg_to_rad(42.0)
const DRAG_SPEED := 0.006


func _init() -> void:
	camera = Camera3D.new()
	camera.fov = 72.0
	camera.current = true
	# Rooms are small and interiors have a lot of near geometry; 0.05 stops
	# the lectern clipping when you stand right at it.
	camera.near = 0.05
	camera.far = 200.0
	add_child(camera)

	_environment = WorldEnvironment.new()
	add_child(_environment)


## A transform at `eye` facing `target`, built rather than asked for.
##
## Node3D.look_at needs the node to be inside the scene tree and does nothing
## useful when it is not — it warns and leaves the basis alone. GameRoot seats
## the camera while it is still being constructed, so every call would have
## been one of those: the camera would sit at the right place facing whatever
## direction it started in, which is exactly the failure the hand-authored
## markers had, and exactly as quiet.
##
## A camera looks down its own -Z, so the basis' z axis is the reverse of the
## direction being faced.
static func looking_at(eye: Vector3, target: Vector3) -> Transform3D:
	var forward := (target - eye).normalized()
	if forward.is_zero_approx():
		forward = Vector3.FORWARD
	var z := -forward
	var up := Vector3.UP
	# Straight up or straight down has no unique roll; nudge the reference.
	if absf(z.dot(up)) > 0.999:
		up = Vector3.RIGHT
	var x := up.cross(z).normalized()
	var y := z.cross(x)
	return Transform3D(Basis(x, y, z), eye)


## Shows `room_id`, building it the first time it is asked for.
func enter_room(room_id: String) -> void:
	if not Rooms.ROOMS.has(room_id):
		push_error("world: no room \"%s\"" % room_id)
		return
	if room_id == _current:
		return
	for id in _rooms:
		(_rooms[id] as Node3D).visible = false
		(_lights[id] as Node3D).visible = false
	if not _rooms.has(room_id):
		_build(room_id)
	(_rooms[room_id] as Node3D).visible = true
	(_lights[room_id] as Node3D).visible = true
	_current = room_id
	_apply_environment(Rooms.ROOMS[room_id])
	room_entered.emit(room_id, str(Rooms.ROOMS[room_id]["name"]))


func current_room() -> String:
	return _current


## Puts the camera in a named seat of the current room. Falls back to the
## room's first seat, so a station whose seat is missing still looks at
## something rather than at the origin.
func take_seat(seat_id: String) -> void:
	if _current.is_empty():
		return
	var seats: Array = Rooms.ROOMS[_current]["seats"]
	var chosen: Dictionary = seats[0]
	for s in seats:
		if s["id"] == seat_id:
			chosen = s
			break
	var t := looking_at(chosen["eye"], chosen["look"])
	camera.transform = t
	_seat_basis = t.basis
	_yaw = 0.0
	_pitch = 0.0


func seats() -> Array:
	if _current.is_empty():
		return []
	return Rooms.ROOMS[_current]["seats"]


func _build(room_id: String) -> void:
	var def: Dictionary = Rooms.ROOMS[room_id]
	var packed: PackedScene = load(str(def["model"]))
	if packed == null:
		push_error("world: could not load %s" % def["model"])
		return
	var model := packed.instantiate()
	add_child(model)
	_rooms[room_id] = model

	var rig := Node3D.new()
	rig.name = "%s_lights" % room_id
	add_child(rig)
	for spec in (def["lights"] as Array):
		rig.add_child(_make_light(spec))
	_lights[room_id] = rig


func _make_light(spec: Dictionary) -> Node3D:
	match str(spec["kind"]):
		"sun":
			var sun := DirectionalLight3D.new()
			sun.light_color = spec["colour"]
			sun.light_energy = float(spec["energy"])
			sun.shadow_enabled = spec.get("shadow", false)
			sun.transform = looking_at(spec["from"], spec["to"])
			return sun
		"spot":
			var spot := SpotLight3D.new()
			spot.light_color = spec["colour"]
			spot.light_energy = float(spec["energy"])
			spot.shadow_enabled = spec.get("shadow", false)
			spot.spot_range = float(spec["range"])
			spot.spot_angle = float(spec["angle"])
			spot.spot_angle_attenuation = 0.5
			spot.transform = looking_at(spec["at"], spec["to"])
			return spot
		"omni":
			var omni := OmniLight3D.new()
			omni.light_color = spec["colour"]
			omni.light_energy = float(spec["energy"])
			omni.omni_range = float(spec["range"])
			omni.position = spec["at"]
			return omni
	push_error("world: no such light kind \"%s\"" % spec["kind"])
	return Node3D.new()


func _apply_environment(def: Dictionary) -> void:
	var env := Environment.new()
	# A flat colour behind the room rather than a sky. These are interiors:
	# the one window wall that matters is the Briefing Room's, and a full
	# outdoor hemisphere lighting a briefing room clipped its white plaster
	# to pure white the first time it was tried.
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.055, 0.063, 0.078)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = def["ambient"]
	env.ambient_light_energy = float(def["ambient_energy"])
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.72
	env.tonemap_white = 4.0
	_environment.environment = env


## Drag to look. Touch and mouse are the same gesture, which is what the
## phone needs; there is no pointer lock and nothing to press first.
##
## _unhandled_input rather than _input, so a drag that starts on a panel or a
## station button never turns the room: Control nodes consume the event before
## it reaches here.
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
		return
	if event is InputEventScreenTouch:
		_dragging = event.pressed
		return
	var motion := Vector2.ZERO
	if event is InputEventMouseMotion and _dragging:
		motion = (event as InputEventMouseMotion).relative
	elif event is InputEventScreenDrag:
		motion = (event as InputEventScreenDrag).relative
	if motion == Vector2.ZERO:
		return
	_yaw = clampf(_yaw - motion.x * DRAG_SPEED, -YAW_LIMIT, YAW_LIMIT)
	_pitch = clampf(_pitch - motion.y * DRAG_SPEED, -PITCH_LIMIT, PITCH_LIMIT)
	_apply_look()


func _apply_look() -> void:
	# Yaw about the world's up and pitch about the camera's own right, both
	# measured from the seat rather than accumulated onto the last frame —
	# accumulating drifts the roll over a long drag.
	var turned := Basis(Vector3.UP, _yaw) * _seat_basis
	camera.basis = turned.rotated(turned.x, _pitch)


## How far the player has turned from the seat, in degrees. For tests.
func look_offset() -> Vector2:
	return Vector2(rad_to_deg(_yaw), rad_to_deg(_pitch))
