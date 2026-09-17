extends SceneTree
## Drives the Oval Office headless, without a scene file.
##
##   godot --headless --path . --script godot/tests/oval_office_smoke.gd
##
## Pass --quit-after 900 when running it unattended. A check that errors rather
## than fails -- a get_node that misses -- aborts _run() where it stands, before
## it can reach quit(), and the run then sits there until something kills it.
##
## The room is assembled here in code rather than loaded from OvalOffice.tscn on
## purpose, for the same reason cabinet_room_smoke.gd does it: the scene is the
## thing being authored on the phone, and a test that needs a scene to exist
## first cannot run until the scene does.
##
## What it exercises is the chain a briefing actually takes: advisor_enters(role)
## plays walk, tweens the follower from 0.0 to 1.0 over walk_seconds, swaps to
## idle_stand on arrival, and opens the briefing card with the resolved person.

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
	# Written out rather than drawn, so the assertions are about the room and not
	# about which names a seed happens to produce.
	return [
		{"office": "chief", "title": "Chief of Staff", "name": "Ruth Ellery",
			"competence": 91.0, "loyalty": 88.0, "faction": "moderates",
			"temperament": "institutionalist", "months": 0},
		{"office": "treasury", "title": "Treasury Secretary", "name": "Margaret Halloran",
			"competence": 74.0, "loyalty": 66.0, "faction": "moderates",
			"temperament": "technocrat", "months": 0},
	]


func _build_room() -> OvalOffice:
	var room := OvalOffice.new()
	room.name = "OvalOffice"

	var path := Path3D.new()
	path.name = "AdvisorPath"
	room.add_child(path)
	var curve := Curve3D.new()
	curve.add_point(Vector3(0.0, 0.0, 4.0))
	curve.add_point(Vector3(0.0, 0.0, -2.0))
	path.curve = curve

	var follower := PathFollow3D.new()
	follower.name = "Advisor"
	path.add_child(follower)

	var model := Node3D.new()
	model.name = "AdvisorModel"
	follower.add_child(model)

	var body := MeshInstance3D.new()
	body.name = "Body"
	var box := BoxMesh.new()
	box.size = Vector3(0.5, 1.6, 0.3)
	body.mesh = box
	model.add_child(body)

	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"
	model.add_child(player)
	player.add_animation_library("", _library_with(["walk", "idle_stand"]))

	var card := DossierCard.new()
	card.name = "BriefingCard"
	room.add_child(card)

	room.set_state({"cabinet": _cabinet()})
	return room


## Two real clips with a real track each, so play() has something to run and
## current_animation reports them by name. The track drives the body's x
## position, which is what makes the clips visible to a headless player too.
func _library_with(names: Array) -> AnimationLibrary:
	var library := AnimationLibrary.new()
	for name in names:
		var clip := Animation.new()
		clip.length = 1.0
		clip.loop_mode = Animation.LOOP_LINEAR
		var track := clip.add_track(Animation.TYPE_VALUE)
		clip.track_set_path(track, "Body:position:x")
		clip.track_insert_key(track, 0.0, 0.0)
		clip.track_insert_key(track, 1.0, 0.0)
		library.add_animation(name, clip)
	return library


func _player_for(room: OvalOffice) -> AnimationPlayer:
	var model := room.advisor_model()
	return model.get_node("AnimationPlayer") as AnimationPlayer


func _run() -> void:
	print("oval office: advisor_enters resolves the role and starts the walk")

	var room := _build_room()
	root.add_child(room)
	room.walk_seconds = 0.05
	await process_frame
	await process_frame

	_check("walk path resolved as AdvisorPath",
		room.walk_path.name if room.walk_path != null else "", "AdvisorPath")
	_check("follower resolved as Advisor",
		room.follower.name if room.follower != null else "", "Advisor")
	_check("briefing card resolved",
		room.briefing_card.name if room.briefing_card != null else "", "BriefingCard")

	_check("role resolves before entering", room.advisor_role(), "")

	var entered: Array = []
	var arrived: Array = []
	var opened: Array = []
	room.advisor_entered.connect(func(_r: String, _p: Dictionary) -> void: entered.append(true))
	room.advisor_arrived.connect(func(_r: String, _p: Dictionary) -> void: arrived.append(true))
	room.briefing_opened.connect(func(_r: String, _p: Dictionary) -> void: opened.append(true))

	room.advisor_enters("chief")

	_check("role recorded", room.advisor_role(), "chief")
	_check("person resolved from cabinet", room.advisor_person().get("office", ""), "chief")
	_check("entered signal fired", entered.size(), 1)
	_check("rider starts at the door", room.progress(), 0.0)

	var player := _player_for(room)
	_check("walk clip is playing", player.current_animation, "walk")
	_check("walk clip loops", player.get_animation("walk").loop_mode, Animation.LOOP_LINEAR)

	# Wait for the walk to finish rather than counting frames: a fixed number of
	# frames is a bet on the headless frame rate, and a lost bet makes this
	# flaky. The tween is 0.05s, so this is over in a moment either way.
	for _i in 600:
		if arrived.size() > 0:
			break
		await process_frame

	_check("arrived signal fired", arrived.size(), 1)
	_check("rider reached the desk", room.progress(), 1.0)
	_check("idle_stand clip is playing", player.current_animation, "idle_stand")

	var card := room.get_node("BriefingCard") as DossierCard
	_check("briefing card opened", card.is_open(), true)
	_check("briefing card shows the advisor", card.person().get("name", ""), "Ruth Ellery")
	_check("briefing card shows a portrait", card.portrait() != null, true)
	_check("opened signal fired", opened.size(), 1)

	card.close_card()
	await process_frame

	print("oval office: the specials walk in without a cabinet entry")
	var ally_room := _build_room()
	root.add_child(ally_room)
	ally_room.walk_seconds = 0.05
	await process_frame
	await process_frame

	ally_room.advisor_enters("ally")
	_check("ally resolves to the prime minister", ally_room.advisor_person().get("name", ""), "The Prime Minister")
	var ally_player := _player_for(ally_room)
	_check("ally walks", ally_player.current_animation, "walk")
	var ally_card := ally_room.get_node("BriefingCard") as DossierCard
	for _i in 600:
		if ally_card.is_open():
			break
		await process_frame
	_check("ally briefing card opened", ally_card.person().get("name", ""), "The Prime Minister")

	print("oval office: a missing follower still opens the card")
	var bare := OvalOffice.new()
	bare.name = "BareOvalOffice"
	var bare_card := DossierCard.new()
	bare_card.name = "BriefingCard"
	bare.add_child(bare_card)
	bare.set_state({"cabinet": _cabinet()})
	root.add_child(bare)
	await process_frame
	await process_frame
	bare.advisor_enters("chief")
	_check("card opens with no path to walk",
		(bare.get_node("BriefingCard") as DossierCard).person().get("name", ""), "Ruth Ellery")

	if _failures == 0:
		print("\noval office: all checks passed")
	else:
		printerr("\noval office: %d FAILED" % _failures)
	quit(1 if _failures > 0 else 0)
