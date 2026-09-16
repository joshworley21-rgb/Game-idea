extends SceneTree
## Drives the cabinet room headless, without a scene file.
##
##   godot --headless --path . --script godot/tests/cabinet_room_smoke.gd
##
## Pass --quit-after 900 when running it unattended. A check that errors rather
## than fails -- a get_node that misses -- aborts _run() where it stands, before
## it can reach quit(), and the run then sits there until something kills it.
##
## The room is assembled here in code rather than loaded from CabinetRoom.tscn
## on purpose. The scene is the thing being authored on the phone; this checks
## the script under it, and a test that needs a scene to exist first cannot run
## until the scene does.
##
## What it exercises is the chain a tap actually takes: a Marker3D per seat, the
## right body for each person's gender, an Area3D on every body, the tap filter,
## the camera tween, and the dossier opening with a real portrait. What it
## cannot exercise is Godot's own ray picking -- there is no pointer headless --
## so it fires the Area3D's input_event signal directly, which is the same
## signal the picker emits and the same bound handler the game uses.

var _failures := 0


func _check(what: String, got, want) -> void:
	if str(got) == str(want):
		print("  ok    %s" % what)
		return
	_failures += 1
	printerr("  FAIL  %s\n          got  %s\n          want %s" % [what, str(got), str(want)])


func _initialize() -> void:
	_run()


func _cabinet() -> Array:
	# Written out rather than drawn, so the assertions are about the room and
	# not about which names a seed happens to produce. Every name is from a pool
	# the portraits cover, and the two genders are both represented.
	return [
		{"office": "chief", "title": "Chief of Staff", "name": "Ruth Ellery",
			"competence": 91.0, "loyalty": 88.0, "faction": "moderates",
			"temperament": "institutionalist", "months": 0},
		{"office": "treasury", "title": "Treasury Secretary", "name": "Margaret Halloran",
			"competence": 74.0, "loyalty": 66.0, "faction": "moderates",
			"temperament": "technocrat", "months": 0},
		{"office": "state", "title": "Secretary of State", "name": "Daniel Osei",
			"competence": 69.0, "loyalty": 71.0, "faction": "liberals",
			"temperament": "operator", "months": 0},
		{"office": "defense", "title": "Defense Secretary", "name": "Marcus Petrov",
			"competence": 82.0, "loyalty": 55.0, "faction": "conservatives",
			"temperament": "rival", "months": 0},
		{"office": "justice", "title": "Attorney General", "name": "Eleanor Brennan",
			"competence": 77.0, "loyalty": 79.0, "faction": "liberals",
			"temperament": "institutionalist", "months": 0},
		{"office": "health", "title": "Health Secretary", "name": "Priya Nakamura",
			"competence": 63.0, "loyalty": 84.0, "faction": "progressives",
			"temperament": "friend", "months": 0},
	]


func _build_room() -> CabinetRoom:
	var room := CabinetRoom.new()
	room.name = "CabinetRoom"

	var camera := Camera3D.new()
	camera.name = "Camera3D"
	camera.position = Vector3(0.0, 2.0, 4.0)
	room.add_child(camera)

	var seats := Node3D.new()
	seats.name = "Seats"
	room.add_child(seats)
	for i in 6:
		var marker := Marker3D.new()
		marker.name = "Seat%d" % (i + 1)
		seats.add_child(marker)
		# Down one side of a 6.4 x 2.5 table, facing it, the way the web build
		# seats them: the marker's -Z points at the table, so the camera's
		# default focus stands between the two.
		var x := -2.55 + i * 1.02
		marker.look_at_from_position(Vector3(x, 0.0, -1.84), Vector3(x, 0.0, 0.0), Vector3.UP)

	var card := DossierCard.new()
	card.name = "DossierCard"
	room.add_child(card)

	var state := {"cabinet": _cabinet()}
	room.set_state(state)
	return room


func _run() -> void:
	print("cabinet room: one body per seat, by gender")

	var state := {"cabinet": _cabinet()}
	var room := _build_room()
	root.add_child(room)
	room.focus_seconds = 0.05
	await process_frame
	await process_frame

	_check("seats found", room.seat_count(), 6)

	var seats := room.get_node("Seats")
	var card := room.get_node("DossierCard") as DossierCard

	var bodies := 0
	var hitboxes := 0
	var placeholders := 0
	var female_bodies := 0
	var male_bodies := 0
	for i in 6:
		var seat := seats.get_child(i) as Marker3D
		_check("seat %d has one occupant" % (i + 1), seat.get_child_count(), 1)
		if seat.get_child_count() != 1:
			continue
		var body := room.body_at(i)
		_check("seat %d occupant is the tracked body" % (i + 1), body == seat.get_child(0), true)
		bodies += 1
		if body.get_node_or_null("Hitbox") != null:
			hitboxes += 1
		var person := room.person_at(i)
		var gender: String = Cast.gender_of(person)
		var want_female := gender == "female"
		# A stand-in is all there is until Suit_Male/Suit_Female land, and its
		# colour is the only thing that says which body the room chose for this
		# person. Once the real models are in, this check does not run and the
		# gender decision is the model itself.
		if room.is_placeholder(i):
			placeholders += 1
			var is_female_body := false
			var torso := body.get_node_or_null("Torso") as MeshInstance3D
			if torso != null and torso.material_override is StandardMaterial3D:
				is_female_body = (torso.material_override as StandardMaterial3D).albedo_color.r > 0.4
			_check("seat %d stand-in body reads as %s" % [i + 1, gender], is_female_body, want_female)
		else:
			# Which of the two models the room picked is the whole point of the
			# gender branch, and the colour sniff above cannot check it -- both
			# suits are dark. The instantiated root keeps the .glb it came from,
			# which names the model outright. Both genders must be represented
			# in this cabinet or this test proves nothing, so count them.
			var want_model := "Suit_Female.glb" if want_female else "Suit_Male.glb"
			_check("seat %d used %s" % [i + 1, want_model],
				body.scene_file_path.get_file(), want_model)
			if want_female:
				female_bodies += 1
			else:
				male_bodies += 1
		_check("seat %d portrait exists (%s)" % [i + 1, Cast.portrait_key(person)],
			Cast.portrait(person) != null, true)

	_check("bodies placed", bodies, 6)
	_check("hitboxes placed", hitboxes, 6)
	_check("no stand-in bodies left", placeholders, 0)
	# Four women and two men in _cabinet(). Asserting the split rather than
	# "some of each" catches a room that shows the right model to everybody.
	_check("female bodies", female_bodies, 4)
	_check("male bodies", male_bodies, 2)
	print("  note  %d of 6 bodies are the exported Suit_Male/Suit_Female models" % (6 - placeholders))

	# An occupant that stands still is the failure this room is most likely to
	# ship with: the bodies import fine and every other assertion still passes,
	# so the room looks correct in a still frame and only reads as broken once
	# somebody taps a seat. Check the clip by name and check it is running.
	print("cabinet room: every body plays idle_sit")
	var animating := 0
	for i in 6:
		var body := room.body_at(i)
		var player: AnimationPlayer = null
		for child in body.get_children():
			if child is AnimationPlayer:
				player = child as AnimationPlayer
				break
		if player == null:
			_check("seat %d body has an AnimationPlayer" % (i + 1), false, true)
			continue
		_check("seat %d body carries the idle_sit clip" % (i + 1),
			player.has_animation("idle_sit"), true)
		if not player.has_animation("idle_sit"):
			continue
		_check("seat %d is playing idle_sit" % (i + 1), player.current_animation, "idle_sit")
		_check("seat %d idle_sit is looping" % (i + 1),
			player.get_animation("idle_sit").loop_mode, Animation.LOOP_LINEAR)
		animating += 1
	_check("every body animates", animating, 6)

	print("cabinet room: portraits resolve by name")
	_check("chief  -> chief/ruth-ellery", Cast.portrait_key(_cabinet()[0]), "chief/ruth-ellery")
	_check("treasury -> cabinet/margaret", Cast.portrait_key(_cabinet()[1]), "cabinet/margaret")
	_check("family spouse -> family/elena",
		Cast.portrait_key({"kind": "spouse", "name": "Elena Vasquez"}), "family/elena")
	_check("press -> special/press",
		Cast.portrait_key({"role": "press"}), "special/press")
	_check("unknown name -> unspecified", Cast.gender_of({"name": "Zebediah Quill"}), "unspecified")

	print("cabinet room: tapping a character")
	var seat3 := seats.get_child(2) as Marker3D
	var hitbox := seat3.get_child(0).get_node("Hitbox") as Area3D

	# A released button, then a right click: neither is a tap, and either one
	# opening a dossier would mean every click in the room did.
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	hitbox.input_event.emit(null, release, Vector3.ZERO, Vector3.UP, 0)
	await process_frame
	_check("released click does nothing", room.focused_seat(), -1)

	var right := InputEventMouseButton.new()
	right.button_index = MOUSE_BUTTON_RIGHT
	right.pressed = true
	hitbox.input_event.emit(null, right, Vector3.ZERO, Vector3.UP, 0)
	await process_frame
	_check("right click does nothing", room.focused_seat(), -1)

	var before := (room.get_node("Camera3D") as Camera3D).global_position

	# The tap itself, as the picker would deliver it.
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	hitbox.input_event.emit(null, tap, Vector3.ZERO, Vector3.UP, 0)
	await process_frame
	_check("tap focuses seat 3", room.focused_seat(), 2)

	for _i in 40:
		await process_frame

	var camera := room.get_node("Camera3D") as Camera3D
	var head := seat3.global_position + Vector3(0.0, room.focus_height, 0.0)
	var forward := -seat3.global_transform.basis.z.normalized()
	var wanted := head + forward * room.focus_distance
	_check("camera arrived at the seat", camera.global_position.distance_to(wanted) < 0.02, true)
	_check("camera left where it was", camera.global_position.distance_to(before) > 0.5, true)
	var looking := -camera.global_transform.basis.z.normalized()
	_check("camera looks at the occupant", looking.dot((head - camera.global_position).normalized()) > 0.999, true)

	print("cabinet room: the dossier")
	_check("card is open", card.is_open(), true)
	_check("card shows the occupant", card.person().get("name", ""), "Daniel Osei")
	_check("card shows a portrait", card.portrait() != null, true)

	card.close_card()
	await process_frame
	_check("closing the card releases the camera", card.is_open(), false)
	for _i in 40:
		await process_frame
	_check("camera returned to where it stood", camera.global_position.distance_to(before) < 0.02, true)

	print("cabinet room: a tap opens the card with no camera in the scene")
	# The room has to survive a scene authored without a camera, which is the
	# state CabinetRoom.tscn will be in for a while yet.
	var headless_room := _build_room()
	var bare := headless_room.get_node("Camera3D")
	bare.queue_free()
	root.add_child(headless_room)
	await process_frame
	var bare_card := headless_room.get_node("DossierCard") as DossierCard
	headless_room.focus_seat(1)
	_check("card still opens", bare_card.is_open(), true)
	_check("card shows the right person", bare_card.person().get("name", ""), "Margaret Halloran")

	if _failures == 0:
		print("\ncabinet room: all checks passed")
	else:
		printerr("\ncabinet room: %d FAILED" % _failures)
	quit(1 if _failures > 0 else 0)
