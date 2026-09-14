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

@onready var _sun: DirectionalLight3D = $DirectionalLight3D

var _positions: Array[Marker3D] = []
var _current_index: int = 0
var _yaw: float = 0.0
var _pitch: float = 0.0


func _ready() -> void:
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

	# Light the room from above so the imported model is readable.
	if _sun != null:
		_sun.rotation_degrees = Vector3(-50.0, -35.0, 0.0)

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
	camera.global_position = marker.global_position
	_yaw = marker.global_rotation.y
	_pitch = 0.0
	_apply_look()


func _apply_look() -> void:
	if camera == null:
		return
	camera.rotation_degrees = Vector3(rad_to_deg(_pitch), rad_to_deg(_yaw), 0.0)
