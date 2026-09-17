extends SceneTree
## Drives the event system headless: the deck, the trigger conditions and the
## branching that the arcs are written against.
##
##   godot --headless --path . --script godot/tests/events_smoke.gd
##
## Pass --quit-after 900 when running it unattended, for the same reason the
## room smokes take it: a check that errors rather than fails aborts _run()
## where it stands, before it can reach quit().
##
## The autoload is reached as root.get_node("GameState") rather than by the
## bare identifier. Running under --script instantiates the autoloads but does
## not register their names as globals, so `GameState` does not compile here --
## though it resolves normally inside the scripts under test, which is why
## EventManager and TurnManager can use it and this file cannot.

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


func _event_manager() -> Node:
	return load("res://scripts/event_manager.gd").new()


func _turn_manager() -> Node:
	return load("res://scripts/core/turn_manager.gd").new()


## A fresh run, so one check's flags cannot leak into the next.
func _reset() -> void:
	_gs.start_new_run()


func _run() -> void:
	_gs = root.get_node("GameState")

	_deck()
	_any_of_flags()
	_min_turn()
	_branching()
	_random_flag()
	_played_once()
	_locked_choices()
	_arc_runs_through()

	if _failures == 0:
		print("\nevents: all checks passed")
	else:
		printerr("\nevents: %d FAILED" % _failures)
	quit(1 if _failures > 0 else 0)


# The arcs live in subdirectories, and a flat scan left all nine out of the
# deck. Counted by directory rather than asserting a total, so adding an event
# does not fail this.
func _deck() -> void:
	print("events: the deck reaches the arc subdirectories")
	var tm := _turn_manager()
	var paths: Array[String] = tm._scan_event_files()

	var top := 0
	var foreign := 0
	var domestic := 0
	for path in paths:
		if path.contains("/arc_foreign/"):
			foreign += 1
		elif path.contains("/arc_domestic/"):
			domestic += 1
		else:
			top += 1

	_check("top-level events found", top, 6)
	_check("arc_foreign events found", foreign, 3)
	_check("arc_domestic events found", domestic, 3)
	_check("the deck is sorted", paths == paths.duplicate(), true)
	tm.free()


func _any_of_flags() -> void:
	print("events: any_of_flags needs one of them, not all")
	_reset()
	var em := _event_manager()
	var event := {"trigger_condition": {"any_of_flags": ["alpha", "beta"]}}

	_check("blocked with neither flag", em.can_play(event), false)
	_gs.apply_choice({}, "beta")
	_check("allowed with the second flag alone", em.can_play(event), true)

	# An empty array is no constraint rather than an impossible one, so a
	# half-written event stays in the deck instead of vanishing from it.
	_check("empty array does not block", em.can_play({"trigger_condition": {"any_of_flags": []}}), true)

	# required_flags is still the all-of rule, and the two coexist.
	_reset()
	var both := {"trigger_condition": {"required_flags": ["alpha", "beta"]}}
	_gs.apply_choice({}, "alpha")
	_check("required_flags still needs every flag", em.can_play(both), false)
	_gs.apply_choice({}, "beta")
	_check("required_flags satisfied by both", em.can_play(both), true)
	em.free()


func _min_turn() -> void:
	print("events: min_turn holds a beat back")
	_reset()
	var em := _event_manager()
	var event := {"trigger_condition": {"min_turn": 3}}

	_check("turn starts at 1", _gs.turn, 1)
	_check("blocked on turn 1", em.can_play(event), false)
	_gs.advance_turn()
	_check("still blocked on turn 2", em.can_play(event), false)
	_gs.advance_turn()
	_check("turn is now 3", _gs.turn, 3)
	_check("allowed on turn 3", em.can_play(event), true)

	# The calendar wraps and the turn counter does not, which is the whole
	# reason it exists: week 2 is not the second turn of the run.
	_reset()
	for _i in 5:
		_gs.advance_turn()
	_check("six turns in, the week has wrapped", _gs.week, 2)
	_check("six turns in, the turn counter has not", _gs.turn, 6)
	em.free()


func _branching() -> void:
	print("events: branch_on_flags opens on the branch the player took")
	var event := {
		"branch_on_flags": {"took_left": "left", "took_right": "right"},
		"nodes": {
			"left": {"text": "went left", "choices": []},
			"right": {"text": "went right", "choices": []},
			"neither": {"text": "went nowhere", "choices": []},
		},
		"start": "neither",
	}

	_reset()
	var em := _event_manager()
	em.play_event(event)
	_check("no flag falls back to start", em.event_text(), "went nowhere")

	_reset()
	var right := _event_manager()
	_gs.apply_choice({}, "took_right")
	right.play_event(event)
	_check("the second flag opens its own node", right.event_text(), "went right")

	# Dictionary order is insertion order and JSON parses in written order, so
	# the topmost line wins when the player holds both.
	_reset()
	var both := _event_manager()
	_gs.apply_choice({}, "took_left")
	_gs.apply_choice({}, "took_right")
	both.play_event(event)
	_check("the first listed flag wins a tie", both.event_text(), "went left")

	# A branch pointing at a node the event does not define falls back rather
	# than showing an empty card.
	_reset()
	var broken := _event_manager()
	_gs.apply_choice({}, "took_left")
	broken.play_event({
		"branch_on_flags": {"took_left": "missing"},
		"nodes": {"neither": {"text": "went nowhere", "choices": []}},
		"start": "neither",
	})
	_check("a branch to a missing node falls back", broken.event_text(), "went nowhere")

	em.free()
	right.free()
	both.free()
	broken.free()


func _random_flag() -> void:
	print("events: random_flag sets one of its options")
	_reset()
	var em := _event_manager()
	var choice := {"text": "Continue", "random_flag": ["won_it", "lost_it"]}

	var picked: String = em._apply_random_flag(choice)
	_check("one of the two was drawn", picked in ["won_it", "lost_it"], true)
	_check("the drawn flag is set", _gs.story_flags.has(picked), true)
	_check("only one of them is set", _gs.story_flags.has("won_it") != _gs.story_flags.has("lost_it"), true)

	# It rides on top of set_flag rather than replacing it, so a choice can
	# record both what was chosen and how it turned out. Driven through
	# play_event so the button is pressed the way the player presses it.
	_reset()
	var pair := _event_manager()
	pair.play_event({
		"text": "the fleet is in range",
		"choices": [{"text": "Engage.", "set_flag": "fought", "random_flag": ["won_it", "lost_it"]}],
	})
	pair._on_choice_pressed(pair._event_data["choices"][0])
	_check("set_flag still applied alongside it", _gs.story_flags.has("fought"), true)
	_check("and the random flag too", _gs.story_flags.has("won_it") or _gs.story_flags.has("lost_it"), true)

	_check("a choice with no random_flag draws nothing", em._apply_random_flag({"text": "x"}), "")
	em.free()
	pair.free()


func _played_once() -> void:
	print("events: an event already played is not dealt again")
	_reset()
	var tm := _turn_manager()

	var first: String = tm._next_deck_path()
	_check("the deck deals something", first.is_empty(), false)

	# Marked the way start_turn() marks it, by file-stem id.
	var id := first.get_file().get_basename()
	_gs.mark_event_played(id)
	_check("GameState remembers it", _gs.has_played_event(id), true)

	# Walk the whole deck; the played one must never come back.
	var seen_again := false
	for _i in 40:
		var path: String = tm._next_deck_path()
		if path.is_empty():
			break
		if path.get_file().get_basename() == id:
			seen_again = true
			break
	_check("it is never dealt again", seen_again, false)

	# A fresh run forgets, so a second playthrough sees the same events.
	_reset()
	_check("a new run clears the played set", _gs.has_played_event(id), false)
	tm.free()


func _locked_choices() -> void:
	print("events: a locked choice still shows what it is")
	_reset()
	var em := _event_manager()
	em.play_event({
		"text": "pick one",
		"choices": [
			{"text": "Use the tape.", "required_secret": "the_tape"},
			{"text": "Speak as a veteran.", "required_background": "ex_general"},
			{"text": "Say nothing."},
		],
	})

	var labels: Array[String] = em.choice_labels()
	_check("three choices are shown", labels.size(), 3)
	_check("the intel-locked option keeps its text", labels[0], "[LOCKED - Requires Intel] Use the tape.")
	_check("the background-locked option keeps its text", labels[1], "[LOCKED - Background] Speak as a veteran.")
	_check("the open option is untagged", labels[2], "Say nothing.")
	em.free()


# The point of all of the above: an arc has to be able to run from its first
# beat to its last, which needs the recursive scan, any_of_flags, the played
# set and branch_on_flags all working at once.
func _arc_runs_through() -> void:
	print("events: the Kalmar arc runs start to finish")
	_reset()
	var em := _event_manager()

	var one := _read("res://data/events/arc_foreign/arc_kalmar_01.json")
	var two := _read("res://data/events/arc_foreign/arc_kalmar_02.json")
	var three := _read("res://data/events/arc_foreign/arc_kalmar_03.json")

	_check("stage one opens a fresh run", em.can_play(one), true)
	_check("stage two is shut until stage one runs", em.can_play(two), false)

	# Take the mobilize branch out of stage one.
	_gs.apply_choice({}, "kalmar_mobilized")
	_check("stage two is still shut on turn 1", em.can_play(two), false)
	_gs.advance_turn()
	_check("stage two opens on turn 2", em.can_play(two), true)

	var staged := _event_manager()
	staged.play_event(two)
	_check("stage two opens on the mobilized branch", staged.event_text().contains("warning shot"), true)

	# Stage two's own choice decides which of stage three's endings plays.
	_gs.apply_choice({}, "kalmar_armed_conflict")
	_check("stage three opens once stage two resolves", em.can_play(three), true)

	var ending := _event_manager()
	ending.play_event(three)
	_check("stage three opens on the armed ending", ending.event_text().contains("fuel and steel"), true)

	em.free()
	staged.free()
	ending.free()


func _read(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_failures += 1
		printerr("  FAIL  cannot open %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}
