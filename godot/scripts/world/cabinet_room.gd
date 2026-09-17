class_name CabinetRoom
extends Node3D
## The Cabinet Room: one seat per office, and a camera that goes to whoever is
## tapped.
##
## The player does not walk in here. Each Marker3D under `seats_root` is a
## secretary's chair; tapping the person in it flies the Camera3D over to the
## chair and opens their dossier.
##
## The nodes this expects, all resolvable by name if the exports are left unset:
##
##   CabinetRoom              this script
##   |- Room                  the imported room model
##   |- Camera3D              the camera that flies
##   |- Seats
##   |   |- Seat1 .. Seat6    Marker3D, one per office, in CoreData.OFFICES order
##   |   `- Seat1/Focus       optional Marker3D, where the camera should sit
##   `- DossierCard           CanvasLayer running dossier_card.gd
##
## Seat order is the cabinet's own order -- chief, treasury, state, defense,
## justice, health -- because CoreData.OFFICES is what the simulation fills the
## cabinet from, so seat 1 is the chief and seat 6 is health without anyone
## having to keep a second list in step.


## The cast changed: someone is sitting in every seat.
signal cast_built(people: Array)
## A tap landed on a character, before the camera has moved.
signal character_tapped(index: int, person: Dictionary)
## The camera has been sent to a seat.
signal seat_focused(index: int, person: Dictionary)

@export var camera: Camera3D
@export var seats_root: Node3D
@export var dossier_card: Node
## The node that owns free look on the same camera, if there is one. Anything
## with a `set_camera_locked` method will do; main.gd has one.
@export var player_controller: Node

## The character models. Left unset, they are loaded from the paths below.
@export var male_model: PackedScene
@export var female_model: PackedScene

@export var focus_seconds: float = 0.55
## How far in front of a seated character the camera stands, and how high. Both
## are only used for seats with no authored Focus marker.
@export var focus_distance: float = 1.65
@export var focus_height: float = 1.30
## The seed the stand-in cabinet is built from when nothing hands the room a run.
@export var preview_seed: int = 2024

const MALE_MODEL_PATH := "res://public/models/Suit_Male.glb"
const FEMALE_MODEL_PATH := "res://public/models/Suit_Female.glb"
const IDLE_CLIP := "idle_sit"

var _state: Dictionary = {}
var _seats: Array[Marker3D] = []
var _characters: Array[Node3D] = []
var _focused: int = -1
var _rest_transform: Transform3D
var _tween: Tween
var _warned_missing_models := false


func _ready() -> void:
	_resolve_nodes()
	_collect_seats()
	_enable_picking()
	if _state.is_empty():
		_state = _preview_state()
	_populate()
	var card := _dossier()
	if card != null and card.has_signal("closed"):
		card.connect("closed", release_focus)


## Hand the room a run to show. Safe to call before the node enters the tree
## (the usual case, from whatever builds the scene) or on a live room, which
## rebuilds the cast in place.
func set_state(state: Dictionary) -> void:
	_state = state
	if is_inside_tree():
		_populate()


func current_state() -> Dictionary:
	return _state


## The person in a seat, or an empty Dictionary if there is nobody there.
func person_at(index: int) -> Dictionary:
	var cabinet := _cabinet()
	if index < 0 or index >= cabinet.size():
		return {}
	return cabinet[index]


func focused_seat() -> int:
	return _focused


func seat_count() -> int:
	return _seats.size()


## The node standing in a seat -- the instantiated character model, or the
## stand-in body when no model was available. Null if the seat is empty.
func body_at(index: int) -> Node3D:
	if index < 0 or index >= _characters.size():
		return null
	return _characters[index]


## True while a seat is filled by a stand-in rather than a character model. With
## the suit models in place this is the failure path, not the normal one: it
## means that seat's .glb did not load.
func is_placeholder(index: int) -> bool:
	var body := body_at(index)
	return body != null and body.has_meta("placeholder")


func _resolve_nodes() -> void:
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D
	if seats_root == null:
		seats_root = get_node_or_null("Seats") as Node3D
	if dossier_card == null:
		dossier_card = get_node_or_null("DossierCard")
	if player_controller == null:
		# The room is normally a child of the node that owns the camera, so
		# that is where free look lives unless the scene says otherwise.
		player_controller = get_parent()


func _collect_seats() -> void:
	_seats.clear()
	# Direct Marker3D children of `seats_root`, in tree order. Deliberately not
	# a recursive sweep: a Focus marker is also a Marker3D, and a sweep would
	# sit a cabinet secretary on one.
	var source: Node = seats_root if seats_root != null else self
	for child in source.get_children():
		if child is Marker3D:
			_seats.append(child as Marker3D)


func _enable_picking() -> void:
	# Area3D input_event never fires without this. Viewport.physics_object_picking
	# is off by default for 3D, so a tap on a character reaches nothing at all --
	# no error, no event, just an unresponsive room.
	var viewport := get_viewport()
	if viewport != null:
		viewport.physics_object_picking = true


func _preview_state() -> Dictionary:
	# Nothing hands this scene a run yet -- the port has no engine singleton to
	# own one -- so a room opened on its own builds a cabinet from the same
	# modules the game uses, off a fixed seed. The same people every time, which
	# is what makes the room a stable thing to author against.
	var state := StateData.create_initial_state("blue", "", preview_seed)
	var rng := Rng.new(preview_seed)
	state["cabinet"] = People.create_cabinet(rng)
	state["family"] = People.create_family(rng, float(state["personal"]["age"]))
	return state


func _cabinet() -> Array:
	var cabinet = _state.get("cabinet", [])
	return cabinet if cabinet is Array else []


func _populate() -> void:
	for old in _characters:
		if is_instance_valid(old):
			old.queue_free()
	_characters.clear()
	_focused = -1

	var cabinet := _cabinet()
	var count := mini(_seats.size(), cabinet.size())
	for i in count:
		_characters.append(_seat(i, _seats[i], cabinet[i]))
	cast_built.emit(cabinet.slice(0, count))
	if cabinet.size() > _seats.size():
		push_warning("CabinetRoom: %d people but %d seats; %d unseated." % [
			cabinet.size(), _seats.size(), cabinet.size() - _seats.size()
		])


func _seat(index: int, marker: Marker3D, person: Dictionary) -> Node3D:
	var body := _instance_body(person)
	body.name = "Seat%d_%s" % [index + 1, Cast.slug(str(person.get("name", "character")))]
	marker.add_child(body)
	# Turned to face the way the chair faces.
	#
	# build_suit_models.gd builds its figures facing +Z -- with a model at rest
	# the thighs and forearms both run that way, which is measurable rather
	# than a reading of the code: drop one at an identity marker and Knee_L
	# lands at z = +0.44. Godot's own forward is -Z, and a seat marker's -Z is
	# what this script treats as the direction the sitter faces: the focus
	# maths below stands the camera along it, "in front of the seat looking
	# back at it". Seat the body unturned and those two disagree by half a
	# turn, so every secretary has their back to the table and the camera
	# frames the back of their head.
	#
	# oval_office.tscn carries the same 180 degrees on the body inside its
	# PathFollow3D. The correction belongs wherever the body is placed, and
	# here that is this line rather than a scene file.
	body.rotate_y(PI)
	_play_idle_sit(body)
	_add_hitbox(body, index)
	return body


func _instance_body(person: Dictionary) -> Node3D:
	var scene := _body_scene(person)
	if scene != null:
		var node := scene.instantiate()
		if node is Node3D:
			return node
		# A PackedScene whose root is not spatial (an imported .glb wrapping the
		# mesh in something odd) is worth a word rather than a crash.
		push_warning("CabinetRoom: %s has a non-Node3D root; using a placeholder." % scene.resource_path)
		node.queue_free()
	return _placeholder_body(person)


func _body_scene(person: Dictionary) -> PackedScene:
	if Cast.gender_of(person) == "female":
		if female_model == null:
			female_model = _load_model(FEMALE_MODEL_PATH)
		return female_model
	if male_model == null:
		male_model = _load_model(MALE_MODEL_PATH)
	return male_model


func _load_model(path: String) -> PackedScene:
	# load(), not preload(). Suit_Male.glb and Suit_Female.glb are committed, but
	# on a fresh clone Godot has not imported them until the editor (or an import
	# pass) has run, and preloading a path that does not exist is a parse error --
	# it would take this whole script, and the scene with it, down at load time
	# instead of degrading to a placeholder body.
	if ResourceLoader.exists(path):
		return load(path) as PackedScene
	if not _warned_missing_models:
		_warned_missing_models = true
		push_warning("CabinetRoom: %s is missing, so the seats have placeholder bodies. Drop the model in at that path and it is picked up with no code change." % path)
	return null


func _placeholder_body(person: Dictionary) -> Node3D:
	# A seated figure's worth of volume, in the model's colours. Kept as the
	# fallback for a seat whose model failed to load, so the seat still holds a
	# tap target and the camera has something to frame.
	var body := Node3D.new()
	body.name = "Placeholder"
	# _seat() renames this node to the occupant, so the name cannot be what says
	# "there is no art here". Metadata survives the rename, and without it the
	# only way to tell a stand-in from a Suit_Male is to sniff its material.
	body.set_meta("placeholder", true)
	var female := Cast.gender_of(person) == "female"

	var torso := MeshInstance3D.new()
	torso.name = "Torso"
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.22
	capsule.height = 0.78
	torso.mesh = capsule
	torso.position = Vector3(0.0, 0.68, 0.0)

	var head := MeshInstance3D.new()
	head.name = "Head"
	var ball := SphereMesh.new()
	ball.radius = 0.115
	ball.height = 0.23
	head.mesh = ball
	head.position = Vector3(0.0, 1.22, 0.0)

	var cloth := StandardMaterial3D.new()
	cloth.albedo_color = Color(0.46, 0.37, 0.43) if female else Color(0.30, 0.35, 0.44)
	torso.material_override = cloth

	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.85, 0.71, 0.60)
	head.material_override = skin

	body.add_child(torso)
	body.add_child(head)
	return body


# ------------------------------------------------------------------- animation

func _play_idle_sit(root: Node) -> void:
	for player in _animation_players(root):
		var clip := _idle_clip(player)
		if clip == "":
			continue
		var animation := player.get_animation(clip)
		if animation != null:
			# A sit idle is a loop. Whatever the exporter wrote in the clip will
			# not do: a one-shot sit freezes the room solid a second in, and it
			# looks like a bug in the room rather than in the asset.
			animation.loop_mode = Animation.LOOP_LINEAR
		player.play(clip)
		return


func _animation_players(root: Node) -> Array[AnimationPlayer]:
	var out: Array[AnimationPlayer] = []
	for child in root.get_children():
		if child is AnimationPlayer:
			out.append(child as AnimationPlayer)
		out.append_array(_animation_players(child))
	return out


func _idle_clip(player: AnimationPlayer) -> String:
	var clips := player.get_animation_list()
	if clips.is_empty():
		return ""
	# Exact match first, then the closest thing. Suffixed clip names are normal
	# out of an exporter ("Armature|idle_sit", "idle_sit_01"), so a contains
	# check earns its keep -- but only after an exact match has had its turn, so
	# "idle_sit" cannot lose to "idle_sitting_sideways".
	for want in [IDLE_CLIP, "sit", "idle"]:
		for clip in clips:
			if str(clip).to_lower() == want:
				return str(clip)
		for clip in clips:
			if str(clip).to_lower().contains(want):
				return str(clip)
	return ""


# ----------------------------------------------------------------------- input

func _add_hitbox(body: Node3D, index: int) -> void:
	var box := _local_aabb(body)
	var capsule := CapsuleShape3D.new()
	capsule.radius = clampf(minf(box.size.x, box.size.z) * 0.5, 0.18, 0.45)
	# A capsule's height includes both caps, so it has to stay at least a
	# diameter and a hair or the shape is rejected.
	capsule.height = maxf(capsule.radius * 2.05, box.size.y)

	var shape := CollisionShape3D.new()
	shape.shape = capsule

	var area := Area3D.new()
	area.name = "Hitbox"
	area.add_child(shape)
	# Centred on the body rather than at its feet, so a tap on the head or on
	# the knees lands on the person and not on the chair behind them.
	area.position = box.get_center()
	area.input_ray_pickable = true
	area.input_event.connect(_on_character_input.bind(index))
	body.add_child(area)


func _local_aabb(root: Node3D) -> AABB:
	var to_local := root.global_transform.affine_inverse()
	var box := AABB()
	var found := false
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
			var here := to_local * (node as MeshInstance3D).global_transform * (node as MeshInstance3D).get_aabb()
			box = here if not found else box.merge(here)
			found = true
		for child in node.get_children():
			stack.append(child)
	if not found:
		# A body with no mesh -- an empty scene root, or a model that failed to
		# import -- still has to be tappable, so it gets a person-sized volume
		# rather than a degenerate one.
		return AABB(Vector3(-0.24, 0.0, -0.24), Vector3(0.48, 1.35, 0.48))
	return box


func _on_character_input(_viewport_camera: Node, event: InputEvent, _at: Vector3, _normal: Vector3, _shape: int, index: int) -> void:
	if not _is_tap(event):
		return
	character_tapped.emit(index, person_at(index))
	focus_seat(index)


func _is_tap(event: InputEvent) -> bool:
	if event is InputEventMouseButton:
		return event.button_index == MOUSE_BUTTON_LEFT and event.pressed
	# The tap that matters on the phone. A mouse click never arrives there, and
	# a screen touch never arrives on the desktop.
	if event is InputEventScreenTouch:
		return event.pressed
	return false


# ---------------------------------------------------------------------- camera

## Fly the camera to a seat and open that person's dossier when it arrives.
func focus_seat(index: int) -> void:
	if index < 0 or index >= _characters.size():
		return
	if _focused < 0:
		# Wherever the player was standing when they reached out, so closing the
		# dossier puts them back rather than stranding them at a chair.
		_rest_transform = camera.global_transform if camera != null else Transform3D.IDENTITY
	_focused = index
	_set_camera_locked(true)
	var person := person_at(index)
	seat_focused.emit(index, person)
	if camera == null:
		_show_dossier(index)
		return
	_fly_to(_focus_transform(_seats[index]), _on_focus_arrived.bind(index))


## Back to wherever the player was standing before the last tap.
func release_focus() -> void:
	if _focused < 0:
		return
	_focused = -1
	if camera == null:
		_set_camera_locked(false)
		return
	_fly_to(_rest_transform, _on_focus_released)


func _fly_to(target: Transform3D, on_arrival: Callable) -> void:
	_kill_tween()
	_tween = create_tween()
	_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_property(camera, "global_transform", target, focus_seconds)
	_tween.finished.connect(on_arrival, CONNECT_ONE_SHOT)


func _focus_transform(marker: Marker3D) -> Transform3D:
	# An authored Focus marker wins. The camera barely has to move in a room this
	# size, and the angle that frames a face without putting the table through it
	# is a judgement call, not something to compute.
	var authored := marker.get_node_or_null("Focus") as Marker3D
	if authored != null:
		return authored.global_transform

	# Otherwise stand in front of the seat, at the height of a seated head,
	# looking back at it. The marker faces the way its occupant does, so -Z runs
	# out of their chest.
	var forward := -marker.global_transform.basis.z.normalized()
	var head := marker.global_position + Vector3(0.0, focus_height, 0.0)
	var distance := maxf(focus_distance, 0.05)
	var eye := head + forward * distance
	var look := Transform3D(Basis.IDENTITY, eye)
	# looking_at is undefined when the direction is straight up the up-vector,
	# which only happens if a seat is authored lying on its back.
	if absf((head - eye).normalized().dot(Vector3.UP)) > 0.999:
		look = Transform3D(Basis.IDENTITY, eye)
	else:
		look = look.looking_at(head, Vector3.UP)
	return look


func _on_focus_arrived(index: int) -> void:
	if _focused != index:
		return
	_show_dossier(index)


func _on_focus_released() -> void:
	_set_camera_locked(false)


func _kill_tween() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()


func _set_camera_locked(locked: bool) -> void:
	# Whatever owns free look is on the same camera. Without telling it to stand
	# down, the mouse fights the tween for the camera and the flight to the seat
	# stutters the whole way.
	if player_controller != null and player_controller.has_method("set_camera_locked"):
		player_controller.call("set_camera_locked", locked)


# --------------------------------------------------------------------- dossier

func _show_dossier(index: int) -> void:
	var person := person_at(index)
	var card := _dossier()
	if person.is_empty() or card == null:
		return
	# call() rather than a typed reference: the card is a plain node in the
	# scene, and this room should not refuse to open for a card that is a
	# variant of the one shipped here.
	if card.has_method("open_card"):
		card.call("open_card", person, Cast.portrait(person))


func _dossier() -> Node:
	if dossier_card == null:
		dossier_card = get_node_or_null("DossierCard")
	return dossier_card
