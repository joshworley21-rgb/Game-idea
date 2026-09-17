extends SceneTree
## Loads the scene files and checks they are wired, which the room smokes
## cannot: they build their rooms in code precisely so they can run before a
## .tscn exists.
##
##   godot --headless --path . --quit-after 900 --script godot/tests/scenes_smoke.gd
##
## The failure this exists to catch is silent. An exported Node reference in a
## hand-written .tscn resolves only when the node header lists it in
## node_paths; write the `camera = NodePath("Camera3D")` line without it and
## the property arrives null, every script here falls back to a name lookup,
## and nothing errors. So each scene is checked for the exports actually
## arriving, not merely for the scene loading.

var _failures := 0


func _check(what: String, got, want) -> void:
	if str(got) == str(want):
		print("  ok    %s" % what)
		return
	_failures += 1
	printerr("  FAIL  %s\n          got  %s\n          want %s" % [what, str(got), str(want)])


func _initialize() -> void:
	_run()


## Instantiates a scene WITHOUT putting it in the tree, so its exports can be
## read as the scene file set them.
##
## This is the whole reason the export checks below are worth anything. Every
## script here resolves its neighbours by name in _ready() when the export is
## null, so once a scene is running there is no way to tell a wired export from
## a fallback -- drop the node_paths header and the property is still non-null
## by the time anyone can look. Before _ready(), it is not.
func _instance(path: String) -> Node:
	var packed := load(path) as PackedScene
	if packed == null:
		_failures += 1
		printerr("  FAIL  cannot load %s" % path)
		return null
	return packed.instantiate()


func _run() -> void:
	await _main()
	await _cabinet()
	await _oval()
	await _game()

	if _failures == 0:
		print("\nscenes: all checks passed")
	else:
		printerr("\nscenes: %d FAILED" % _failures)
	quit(1 if _failures > 0 else 0)


func _main() -> void:
	print("scenes: main.tscn")
	var main := _instance("res://godot/scenes/main.tscn")
	if main == null:
		return
	# Read before _ready(): these are the scene file's node_paths, not a fallback.
	_check("camera export wired", main.camera != null, true)
	_check("positions_root export wired", main.positions_root != null, true)
	root.add_child(main)
	await process_frame
	# Three vantage points, and the camera standing at the first of them.
	_check("three camera positions", main.positions_root.get_child_count(), 3)
	var podium := main.positions_root.get_node("Podium") as Marker3D
	_check("camera starts at the podium", main.camera.global_position.distance_to(podium.global_position) < 0.02, true)
	main.queue_free()
	await process_frame


func _cabinet() -> void:
	print("scenes: cabinet_room.tscn")
	var room := _instance("res://godot/scenes/cabinet_room.tscn")
	if room == null:
		return
	_check("camera export wired", room.camera != null, true)
	_check("seats_root export wired", room.seats_root != null, true)
	_check("dossier_card export wired", room.dossier_card != null, true)
	root.add_child(room)
	await process_frame
	_check("six seats", room.seats_root.get_child_count(), 6)

	# With no run handed in, _ready() seats a preview cabinet, so the scene
	# opens with somebody in every chair rather than six empty markers.
	var seated := 0
	for i in 6:
		if room.body_at(i) != null:
			seated += 1
	_check("every seat has a body", seated, 6)

	# Each marker's -Z points at the table, which is the convention
	# cabinet_room.gd's focus maths is written to.
	for i in 6:
		var seat := room.seats_root.get_child(i) as Marker3D
		var forward := -seat.global_transform.basis.z.normalized()
		if forward.dot(Vector3(0.0, 0.0, -1.0)) < 0.99:
			_failures += 1
			printerr("  FAIL  seat %d does not face the table" % (i + 1))
			break
	_check("every seat faces the table", true, true)

	# And the occupants face the same way the chairs do. The suit models are
	# built facing +Z, so a body seated unturned has its back to the table --
	# the room still passes every other check and only reads as wrong once
	# somebody looks at it. Measured off the knee, which is where the +Z is.
	var facing_wrong := -1
	for i in 6:
		var body := room.body_at(i) as Node3D
		var knee := _find(body, "Knee_L")
		if knee == null:
			continue
		# The table is at z = 0 and the seats at z = 1.84, so a knee in front
		# of its own seat is a knee at a smaller z than the seat.
		if knee.global_position.z > body.global_position.z:
			facing_wrong = i
			break
	_check("every occupant faces the table", facing_wrong, -1)

	# Tapping a seat flies the camera and opens the card, which is the whole
	# interaction the room exists for.
	var before: Vector3 = room.camera.global_position
	room.focus_seconds = 0.05
	room.focus_seat(2)
	await create_timer(0.2).timeout
	_check("the camera moved to the seat", room.camera.global_position.distance_to(before) > 0.5, true)
	_check("the dossier opened", room.dossier_card.is_open(), true)
	room.queue_free()
	await process_frame


func _oval() -> void:
	print("scenes: oval_office.tscn")
	var room := _instance("res://godot/scenes/oval_office.tscn")
	if room == null:
		return
	_check("walk_path export wired", room.walk_path != null, true)
	_check("follower export wired", room.follower != null, true)
	_check("briefing_card export wired", room.briefing_card != null, true)
	_check("camera export wired", room.camera != null, true)
	root.add_child(room)
	await process_frame
	_check("the follower carries a body", room.advisor_model() != null, true)

	# The path has to start at the door and end at the desk. The desk's near
	# edge is z = -2.40 in the imported model, so the last point stands in
	# front of it rather than inside it.
	var curve: Curve3D = room.walk_path.curve
	_check("the walk has three points", curve.point_count, 3)
	_check("it starts at the west door", curve.get_point_position(0).x < -4.0, true)
	var last := curve.get_point_position(curve.point_count - 1)
	_check("it ends in front of the desk", last.z > -2.4 and last.z < -1.0, true)

	# The suit models face +Z and PathFollow3D drives -Z along the path, so the
	# body is turned inside the follower. Without that the advisor moonwalks in.
	#
	# Checked on the local transform, not the global one: the follower itself
	# turns to follow the path, so the body's global basis says where it is
	# pointing this instant, while the local basis is the standing correction
	# this scene authors. Turned 180 degrees, the model's own +Z runs along the
	# follower's -Z, which is the way it travels.
	var body := room.advisor_model() as Node3D
	_check("the body is turned to face the way it walks", body.transform.basis.z.z < -0.99, true)

	# The follower is parked on the standing mark in the scene file, so the
	# advisor is at the desk before anything is called.
	_check("the advisor is parked at the desk", room.follower.progress_ratio, 1.0)

	room.set_state({"cabinet": [{"office": "chief", "title": "Chief of Staff", "name": "Ruth Ellery"}]})
	room.cut_seconds = 0.05
	var camera_before: Vector3 = room.camera.global_position
	room.advisor_enters("chief")
	await create_timer(0.3).timeout
	_check("the camera cut to the advisor", room.camera.global_position.distance_to(camera_before) > 0.3, true)
	_check("the briefing card opened", room.briefing_card.is_open(), true)

	# The real Suit_Male has no idle_stand, so this is the standing pose being
	# derived rather than played -- checked on the shipping model, not a rig.
	var hips := _find(body, "Hips")
	var knee := _find(body, "Knee_L")
	var foot := _find(body, "Foot_L")
	_check("the advisor is standing, not seated in mid-air",
		hips.global_position.y - knee.global_position.y > 0.35, true)
	_check("their feet are on the floor", absf(foot.global_position.y) < 0.02, true)
	room.queue_free()
	await process_frame


# The point of the other three: a scene that actually plays a turn.
func _game() -> void:
	print("scenes: game.tscn plays a turn")
	var game := _instance("res://godot/scenes/game.tscn")
	if game == null:
		return
	var turns: Node = game.get_node("TurnManager")
	_check("Game's turn_manager export wired", game.turn_manager != null, true)
	_check("TurnManager's room export wired", turns.oval_office != null, true)
	_check("TurnManager's EventManager export wired", turns.event_manager != null, true)
	_check("TurnManager's camera export wired", turns.camera != null, true)
	root.add_child(game)
	await process_frame
	_check("the run started", game.is_running(), true)
	_check("the HUD is in the scene", game.get_node_or_null("HUD") != null, true)

	# A turn was dealt on _ready: an event is selected and a speaker resolved
	# before the advisor has finished walking in.
	_check("a turn is in progress", turns.is_busy(), true)
	_check("an event was selected", turns.current_event_id().is_empty(), false)
	_check("it has a speaker", turns.current_speaker().is_empty(), false)
	_check("the event was marked played", GameStateRef().has_played_event(turns.current_event_id()), true)

	# Let the walk finish and the event reach the screen.
	var events: Node = turns.event_manager
	for _i in 600:
		await process_frame
		if events.is_playing():
			break
	_check("the event reached the screen", events.is_playing(), true)
	_check("it printed some text", events.event_text().is_empty(), false)
	_check("it offered at least one choice", events.choice_count() > 0, true)
	game.queue_free()
	await process_frame


## The autoload, which --script instantiates but does not register as a global.
func GameStateRef() -> Node:
	return root.get_node("GameState")


## First descendant with this name, or null. The suit models nest their joints
## a few levels down and the depth is the modeller's business, not this test's.
func _find(node: Node, wanted: String) -> Node3D:
	if node == null:
		return null
	if node is Node3D and node.name == wanted:
		return node as Node3D
	for child in node.get_children():
		var hit := _find(child, wanted)
		if hit != null:
			return hit
	return null
