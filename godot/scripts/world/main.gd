class_name Main
extends Node3D
## Main scene controller for the fixed-camera design.
##
## The player no longer walks around the room. They stand at designated
## camera positions (Marker3D nodes under CameraPositions) and look around
## from each one. Press Q/E to cycle positions, move the mouse to look,
## and Esc to release/recapture the mouse.

@export var camera: Camera3D
@export var positions_root: Node3D
@export var look_speed: float = 0.0022
@export var pitch_limit_deg: float = 80.0

var _positions: Array[Marker3D] = []
var _current_index: int = 0
var _yaw: float = 0.0
var _pitch: float = 0.0


func _ready() -> void:
	# Resolve the exported references by name if the scene did not supply them.
	#
	# A hand-written .tscn stores an exported Node reference as a NodePath, and
	# it does not reliably resolve on load the way an editor-authored scene
	# does. Both arrived null here, which fails silently in the worst way: the
	# marker list falls back to a single default, _snap_to_position() returns
	# at its own guard, and the camera simply sits wherever the scene file put
	# it, facing whatever way the scene file left it. Nothing errors.
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D
	if positions_root == null:
		positions_root = get_node_or_null("CameraPositions") as Node3D

	if positions_root != null:
		for child in positions_root.get_children():
			if child is Marker3D:
				_positions.append(child as Marker3D)

	# Fallback keeps the scene runnable even if no marker is authored.
	if _positions.is_empty():
		var fallback := Marker3D.new()
		fallback.name = "DefaultCameraPosition"
		add_child(fallback)
		fallback.global_position = Vector3(0.0, 1.5, 0.0)
		_positions.append(fallback)

	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	_snap_to_position()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * look_speed
		_pitch = clampf(
			_pitch - event.relative.y * look_speed,
			deg_to_rad(-pitch_limit_deg),
			deg_to_rad(pitch_limit_deg)
		)
		_apply_look()
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_Q:
				_cycle(-1)
			KEY_E:
				_cycle(1)
			KEY_ESCAPE:
				_toggle_mouse_capture()


func _cycle(delta: int) -> void:
	if _positions.is_empty():
		return
	_current_index = wrapi(_current_index + delta, 0, _positions.size())
	_snap_to_position()


func _toggle_mouse_capture() -> void:
	if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	else:
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _snap_to_position() -> void:
	if camera == null or _positions.is_empty():
		return
	var marker: Marker3D = _positions[_current_index]
	camera.global_transform = marker.global_transform

	# Re-derive yaw and pitch from the basis rather than reading the marker's
	# Euler angles.
	#
	# A half-turn about Y has two equally valid Euler decompositions --
	# (0, PI, 0) and (PI, 0, PI) -- and Godot returns the second. Taking .y
	# from it gives zero, so the marker that should put the president behind
	# the lectern facing the room instead faced them at the drape a metre
	# away, with the seal filling the screen.
	var forward := -camera.global_transform.basis.z
	_yaw = atan2(-forward.x, -forward.z)
	_pitch = asin(clampf(forward.y, -1.0, 1.0))
	_apply_look()


func _apply_look() -> void:
	if camera == null:
		return
	camera.rotation_degrees = Vector3(rad_to_deg(_pitch), rad_to_deg(_yaw), 0.0)
