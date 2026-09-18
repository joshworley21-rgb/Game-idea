extends SceneTree
## Drives a run to its end and checks it actually ends.
##
##   godot --headless --path . --quit-after 900 --script godot/tests/epilogue_smoke.gd
##
## The failure this exists to catch is a run that stops rather than finishes.
## An exhausted deck used to emit turn_skipped and leave the player in a room
## that would never do anything again: every event played, no verdict, no way
## to start another. So the checks here are about the run reaching an ending,
## the ending being read off the state that earned it, and Play Again getting
## back to a first turn.
##
## GameState is reached as root.get_node("GameState") rather than by the bare
## name, for the reason events_smoke.gd gives: --script instantiates the
## autoloads but does not register their names as globals.

var _failures := 0
var _gs: Node


func _check(what: String, got, want) -> void:
	if str(got) == str(want):
		print("  ok    %s" % what)
		return
	_failures += 1
	printerr("  FAIL  %s\n          got  %s\n          want %s" % [what, str(got), str(want)])


func _initialize() -> void:
	_run()


func _turns() -> Node:
	var node: Node = load("res://scripts/core/turn_manager.gd").new()
	node.name = "TurnManager"
	root.add_child(node)
	return node


func _generator() -> RefCounted:
	return load("res://scripts/core/epilogue_generator.gd").new()


func _run() -> void:
	_gs = root.get_node("GameState")

	_grades()
	_score()
	await _deck_runs_dry()
	await _term_ends()
	await _screen()
	await _play_again()

	if _failures == 0:
		print("\nepilogue: all checks passed")
	else:
		printerr("\nepilogue: %d FAILED" % _failures)
	quit(1 if _failures > 0 else 0)


# The bands are the web build's, from gradeFor() in src/game/endings.ts, so a
# B+ means the same thing in both versions. Checked on the boundaries, which is
# where an off-by-one would live.
func _grades() -> void:
	print("epilogue: the grade bands match the web build")
	var generator := _generator()
	var bands := {88: "A+", 80: "A", 72: "B+", 64: "B", 56: "C+", 48: "C", 40: "D", 39: "F", 0: "F"}
	for score in bands:
		_check("%d grades %s" % [score, bands[score]], generator.grade_for(score), bands[score])
	_check("just under an A is a B+", generator.grade_for(79), "B+")
	_check("100 is an A+", generator.grade_for(100), "A+")


func _score() -> void:
	print("epilogue: the score reads the run's own numbers")
	_gs.start_new_run()
	var generator := _generator()

	# The opening position is 50 across the board, which is a presidency that
	# changed nothing: it should land exactly mid-scale.
	var opening: Dictionary = generator.generate_legacy()
	_check("the opening position scores 50", opening.get("score", -1), 50)
	_check("and grades a C", opening.get("grade", ""), "C")
	_check("the breakdown names its four parts",
		(opening.get("breakdown", {}) as Dictionary).keys().size(), 4)

	# A good presidency outscores a bad one on the same four numbers.
	_gs.start_new_run()
	_gs.apply_choice({"approval": 40, "budget": 40, "tension": -40, "loyalty": 40})
	var good: int = generator.generate_legacy().get("score", 0)
	_gs.start_new_run()
	_gs.apply_choice({"approval": -40, "budget": -40, "tension": 40, "loyalty": -40})
	var bad: int = generator.generate_legacy().get("score", 0)
	_check("a good run outscores a bad one", good > bad, true)
	_check("a good run grades well", generator.grade_for(good) in ["A+", "A", "B+"], true)
	_check("a bad run grades badly", generator.grade_for(bad) in ["D", "F"], true)


func _deck_runs_dry() -> void:
	print("epilogue: an empty deck ends the run instead of freezing it")
	_gs.start_new_run()
	var turns := _turns()
	await process_frame

	var ended: Array = []
	turns.game_over.connect(func(reason: String, legacy: Dictionary) -> void: ended.append([reason, legacy]))

	# Burn the deck, the way a played-out run would.
	for _i in 40:
		var path: String = turns._next_deck_path()
		if path.is_empty():
			break
		_gs.mark_event_played(path.get_file().get_basename())

	turns.start_turn()
	await process_frame

	_check("the run ended", ended.size(), 1)
	_check("and said why", ended[0][0] if ended.size() > 0 else "", "out_of_events")
	_check("it is not left busy", turns.is_busy(), false)
	_check("it knows it is over", turns.is_game_over(), true)

	var legacy: Dictionary = ended[0][1] if ended.size() > 0 else {}
	_check("the ending carries a verdict", legacy.has("verdict"), true)
	_check("and a grade", legacy.has("grade"), true)
	_check("and the reason", legacy.get("reason", ""), "out_of_events")
	turns.queue_free()
	await process_frame


func _term_ends() -> void:
	print("epilogue: the term ends the run")
	_gs.start_new_run()
	var turns := _turns()
	turns.turn_limit = 3
	await process_frame

	var ended: Array = []
	turns.game_over.connect(func(reason: String, _l: Dictionary) -> void: ended.append(reason))

	# Resolve turns until the limit bites. on_choice_resolved advances the
	# calendar and deals the next one, which is the loop being tested.
	for _i in 10:
		if turns.is_game_over():
			break
		turns.on_choice_resolved({})
		await process_frame

	_check("the run ended", ended.size() > 0, true)
	_check("because the term was up", ended[0] if ended.size() > 0 else "", "term")
	_check("it ran the turns it was given", _gs.turn > 3, true)

	# A turn_limit of 0 leaves it to the calendar, so the term is four years.
	_gs.start_new_run()
	var calendar := _turns()
	calendar.turn_limit = 0
	await process_frame
	_check("year 1 is not the end of the term", calendar._term_is_over(), false)
	_gs.year = 5
	_check("year 5 is", calendar._term_is_over(), true)

	turns.queue_free()
	calendar.queue_free()
	await process_frame


func _screen() -> void:
	print("epilogue: the screen shows the run that just ended")
	_gs.start_new_run()
	# A presidency worth a verdict: high approval, low tension, a trusted chief
	# and a treasury secretary who will be writing a book.
	_gs.apply_choice({"approval": 20, "tension": -20})
	_gs.advisor_trust["chief"] = 90
	_gs.advisor_trust["treasury"] = 10

	var turns := _turns()
	await process_frame
	turns._trigger_game_over("term")
	await process_frame

	var screen: Node = turns.get_node_or_null("EpilogueScreen")
	_check("the screen was put up", screen != null, true)
	if screen == null:
		return
	_check("it is visible", screen.visible, true)

	var shown: Dictionary = screen.legacy()
	_check("it was handed the verdict", shown.get("verdict", ""), "Landslide Win")
	_check("and the grade", shown.get("grade", "").is_empty(), false)
	_check("and why the run ended", shown.get("reason", ""), "term")

	var fates: Array = shown.get("cabinet_fates", [])
	_check("both cabinet fates are listed", fates.size(), 2)
	_check("the ally is named", str(fates[0]).contains("lifelong political ally"), true)
	_check("so is the memoirist", str(fates[1]).contains("tell-all memoir"), true)

	# The numbers on screen are the ones that ended the run, not whatever
	# GameState drifts to afterwards.
	var grade_before: String = shown.get("grade", "")
	_gs.apply_choice({"approval": -60})
	_check("the report does not follow the state", screen.legacy().get("grade", ""), grade_before)

	turns.queue_free()
	await process_frame


func _play_again() -> void:
	print("epilogue: Play Again starts a fresh run")
	_gs.start_new_run()
	var turns := _turns()
	turns.turn_limit = 2
	await process_frame

	# Sour the run and spend some of the deck, so a reset is visible.
	_gs.apply_choice({"approval": -30}, "some_flag")
	var burned: String = turns._next_deck_path()
	_gs.mark_event_played(burned.get_file().get_basename())
	turns._trigger_game_over("term")
	await process_frame
	_check("the run is over", turns.is_game_over(), true)

	var restarted: Array = []
	turns.run_restarted.connect(func() -> void: restarted.append(true))

	var screen: Node = turns.get_node_or_null("EpilogueScreen")
	_check("the screen is up", screen != null and screen.visible, true)

	# Press the button the player presses, rather than calling restart_run().
	var button := _find_button(screen)
	_check("there is a Play Again button", button != null, true)
	if button == null:
		return
	button.pressed.emit()
	await process_frame

	_check("the screen came down", screen.visible, false)
	_check("the run is running again", turns.is_game_over(), false)
	_check("listeners were told", restarted.size(), 1)
	_check("the numbers were reset", _gs.approval, 50)
	_check("the flags were cleared", _gs.story_flags.has("some_flag"), false)
	_check("the calendar went back", _gs.turn, 1)
	_check("and a turn was dealt", turns.current_event_id().is_empty(), false)

	# The played set is the new run's alone.
	#
	# Not "the burned event is absent": restart_run() deals a turn as its last
	# act, off a freshly shuffled deck, and that turn is marked played before
	# anything here can look. Roughly one run in three it deals the very event
	# that was burned, so asserting its absence failed at random. What actually
	# has to hold is that nothing survived the reset except the turn just dealt.
	_check("the played set carries only the new turn", _gs.played_events.size(), 1)
	_check("and it is the turn that was dealt", _gs.has_played_event(turns.current_event_id()), true)

	turns.queue_free()
	await process_frame


## The Play Again button, wherever the screen built it.
func _find_button(node: Node) -> Button:
	if node == null:
		return null
	if node is Button and (node as Button).name == "PlayAgain":
		return node as Button
	for child in node.get_children():
		var hit := _find_button(child)
		if hit != null:
			return hit
	return null
