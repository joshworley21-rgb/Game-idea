class_name TurnManager
extends Node
## The main gameplay turn controller.
##
## One turn is: pick an eligible event, stage it in the room it asks for,
## present it through EventManager, then resolve the choice and roll the
## calendar forward.
##
## Staging depends on the room. The Oval walks an advisor to the desk and holds
## there. The cabinet room flies the camera to the speaker's seat -- and keeps
## flying it, node by node, so an event that names a different secretary on each
## node plays as an argument across the table rather than as one person talking.
##
## The scene this is attached to is expected to hold an EventManager node and
## either or both rooms. References are exported so a .tscn can wire them
## explicitly, but every one of them also has a name-based fallback below, so
## the script keeps working in a scene that simply names its nodes the same way.

## Emitted when start_turn() has selected an event but before the 3D entry.
signal turn_started(event_id: String, speaker: String)
## Emitted when the event has been handed to EventManager to render.
signal turn_presented(event_id: String, speaker: String)
## Emitted when a choice resolves, with the choice Dictionary EventManager saw.
signal turn_resolved(choice: Dictionary)
## Emitted when a turn found no eligible event but the run is not over. Kept
## for a caller that wants to know a turn was quiet; the run ending on an empty
## deck is game_over("out_of_events"), not this.
signal turn_skipped
## Emitted when the run ends, for any reason:
##   "impeachment"    approval at or below 0
##   "collapse"       budget at or below -50
##   "term"           the term was served out, or turn_limit was reached
##   "out_of_events"  no eligible event is left to deal
## Carries the legacy report EpilogueGenerator produced for that run.
signal game_over(reason: String, legacy: Dictionary)
## Emitted after the player asks for another run and everything has been reset,
## so a scene can re-seed its rooms off the new cabinet.
signal run_restarted

@export var event_directory: String = "res://data/events/"
@export var event_manager: Node
@export var oval_office: Node
@export var cabinet_room: Node
@export var briefing_card: Node
@export var camera: Camera3D

## Cabinet seat order matches the cabinet's own role order, so seat 1 is chief
## and seat 6 is health.
const CABINET_ROLE_ORDER: Array[String] = [
	"chief", "treasury", "state", "defense", "justice", "health",
]

## How many turns a run lasts before the term is up. The fiction's term is four
## years, which at a week a turn is 192 of them -- far more content than exists,
## so this is sized to the content instead and the year check below is the one
## that matters once there is enough. Set to 0 to leave it to the calendar.
@export var turn_limit: int = 12
## The term in years, checked against GameState's calendar. A run that reaches
## the end of it ends whatever turn_limit says.
@export var term_years: int = 4

## The end-of-run screen. Left unset, the scene below is instantiated on demand.
@export var epilogue_screen: Node
@export var epilogue_scene: PackedScene = preload("res://scenes/ui/epilogue_screen.tscn")

@export var focus_seconds: float = 0.55
## Used only when a cabinet seat has no authored Focus marker.
@export var focus_distance: float = 1.65
@export var focus_height: float = 1.30

var _run_state: Dictionary = {}
var _event_paths: Array[String] = []
var _deck: Array[String] = []
var _deck_cursor: int = 0
var _deck_ready: bool = false
var _current_event_path: String = ""
var _current_event: Dictionary = {}
var _current_speaker: String = ""
var _current_person: Dictionary = {}
var _last_choice: Dictionary = {}
var _busy: bool = false
var _game_over: bool = false
var _entry_arrived: bool = false
var _entry_tween: Tween
## The room the current event is being staged in, so the card, the camera and
## the seat focus all act on the same one.
var _active_room: Node = null


func _ready() -> void:
	_resolve_nodes()
	_connect_event_signals()
	# Both room scenes declare their own camera current, so with two of them in
	# one scene whichever entered the tree last would win. Settling on one here
	# means the first frame is not a coin toss.
	_activate_room(_oval_office_node() if _oval_office_node() != null else _cabinet_room_node())


## Hand the turn system the full run state, when the main scene has one from
## StateData. Used to resolve a speaker to a real person (and therefore a real
## portrait); GameState is the fallback when no full state is supplied.
func set_state(state: Dictionary) -> void:
	_run_state = state


func current_state() -> Dictionary:
	return _run_state


## The id of the event currently being played, or "" between turns.
func current_event_id() -> String:
	return _current_event_path.get_file().get_basename() if not _current_event_path.is_empty() else ""


## The speaker of the event currently being played, or "" between turns.
func current_speaker() -> String:
	return _current_speaker


func is_busy() -> bool:
	return _busy


func is_game_over() -> bool:
	return _game_over


# ------------------------------------------------------------------- the turn

## Begin a turn. Selects an eligible event, identifies its speaker, performs the
## 3D entry (walk-in or seat focus), then calls present_event().
func start_turn() -> void:
	if _busy:
		push_warning("TurnManager: start_turn() called while a turn is already starting")
		return
	if _game_over:
		return
	_busy = true

	var path := _select_event_path()
	if path.is_empty():
		# The deck is spent. This used to emit turn_skipped and stop, which left
		# the player looking at a room that would never do anything again --
		# every event played, no ending, no way out. An exhausted deck is an end
		# to the run, so it ends it.
		_busy = false
		_trigger_game_over("out_of_events")
		return

	var data := _read_event(path)
	if data.is_empty():
		_busy = false
		return

	_current_event_path = path
	_current_event = data
	_current_speaker = _speaker_for_event(data)
	_current_person = _person_for_speaker(_current_speaker)
	_last_choice = {}
	# Marked on the way in, not on the way out: the 3D entry below awaits, and
	# an event still counts as played if the run ends part-way through it.
	GameState.mark_event_played(current_event_id())
	turn_started.emit(current_event_id(), _current_speaker)

	await _enter_speaker_3d(_current_speaker)
	_busy = false
	present_event()


## Once the camera/actor has arrived: load the speaker's portrait into the
## briefing card and hand the event to EventManager for text and choices.
func present_event() -> void:
	if _current_event.is_empty():
		push_error("TurnManager: present_event() called with no active event")
		return

	_load_portrait_into_card()

	var em := _event_manager_node()
	if em == null or not em.has_method("play_event"):
		push_error("TurnManager: no EventManager available to render the event")
		return
	if em.has_signal("event_finished"):
		if not em.is_connected("event_finished", Callable(self, "_on_event_finished")):
			em.connect("event_finished", Callable(self, "_on_event_finished"), CONNECT_ONE_SHOT)
	em.call("play_event", _current_event)
	turn_presented.emit(current_event_id(), _current_speaker)


## Resolve a turn after EventManager reports the event has finished.
##
## The choice consequences themselves were already applied by EventManager
## through GameState.apply_choice(); this is where the turn *after* that lives:
## win/loss checks, end-of-turn checks, the calendar advance, and the next turn.
func on_choice_resolved(choice: Dictionary = {}) -> void:
	if not choice.is_empty():
		_last_choice = choice
	_set_camera_locked(false)
	turn_resolved.emit(_last_choice)

	var end_reason := _end_condition()
	if not end_reason.is_empty():
		_trigger_game_over(end_reason)
		return

	# advance_turn() runs end_of_turn_checks() itself, by design -- "the turn
	# system gets both in one call". Calling it here as well ran the sweep
	# twice per turn.
	GameState.advance_turn()

	# Checked after the advance, so the turn the player just took counts towards
	# the term rather than the one they are about to be offered.
	if _term_is_over():
		_trigger_game_over("term")
		return

	start_turn()


## Whether the run has reached the end of its term.
##
## Either limit ends it, whichever comes first: turn_limit is the content's
## limit and the calendar is the fiction's. A turn_limit of 0 leaves it to the
## calendar alone.
func _term_is_over() -> bool:
	if turn_limit > 0 and int(GameState.turn) > turn_limit:
		return true
	return term_years > 0 and int(GameState.year) > term_years


# ------------------------------------------------------------- event selection

func _select_event_path() -> String:
	var pending := _pending_event_path()
	if not pending.is_empty():
		return pending
	return _next_deck_path()


## Pop the first pending event id and turn it into a playable path, if it
## exists and is eligible. A pending event that has no JSON file is dropped so
## the queue cannot stall the run.
func _pending_event_path() -> String:
	var pending: Array = GameState.pending_events
	if pending.is_empty():
		return ""
	var id := str(pending[0])
	pending.erase(id)
	var path := _path_for_pending_id(id)
	if path.is_empty():
		push_warning("TurnManager: pending event '%s' has no JSON file; dropping it" % id)
		return ""
	var data := _read_event(path)
	if data.is_empty() or not _is_eligible(data):
		push_warning("TurnManager: pending event '%s' is invalid or blocked; dropping it" % id)
		return ""
	return path


func _path_for_pending_id(id: String) -> String:
	if id.is_empty():
		return ""
	# A pending id may already be a full path, so honour that before treating it
	# as a bare file name in event_directory.
	if id.begins_with("res://") or id.begins_with("user://") or id.is_absolute_path():
		return id if FileAccess.file_exists(id) else ""
	var candidate := event_directory.path_join(id + ".json")
	if FileAccess.file_exists(candidate):
		return candidate
	# An id that already carries its extension still needs the directory prefix.
	if id.ends_with(".json"):
		var alternate := event_directory.path_join(id)
		if FileAccess.file_exists(alternate):
			return alternate
	return ""


## Draw the next eligible event from a shuffled deck of all JSON files in
## event_directory. Ineligible events are skipped but stay in the deck, so they
## can become eligible later once their story flags change.
##
## An event already played this run is skipped for good. Without that an arc
## cannot run: stage one sets the flag stage two waits on, and the deck would
## keep coming back round to stage one and setting it again, so the run would
## circle the opening beat instead of moving through the arc.
func _next_deck_path() -> String:
	_ensure_deck()
	if _deck.is_empty():
		return ""
	for _i in _deck.size():
		if _deck_cursor >= _deck.size():
			_deck_cursor = 0
		var path: String = _deck[_deck_cursor]
		_deck_cursor += 1
		if GameState.has_played_event(_event_id_for(path)):
			continue
		var data := _read_event(path)
		if not data.is_empty() and _is_eligible(data):
			return path
	return ""


## An event's id is its file name without the extension, so the same string
## identifies it whether it came from the deck or from pending_events.
func _event_id_for(path: String) -> String:
	return path.get_file().get_basename()


func _ensure_deck() -> void:
	if _deck_ready:
		return
	_deck_ready = true
	_deck = _scan_event_files()
	_deck.shuffle()
	_deck_cursor = 0


## Every .json under event_directory, including the arc subdirectories.
##
## This recurses because the arcs live in folders -- data/events/arc_foreign/,
## data/events/arc_domestic/ -- and a flat scan left all of them out of the
## deck, so the nine events in them could never be drawn.
func _scan_event_files() -> Array[String]:
	var paths: Array[String] = []
	_scan_into(event_directory, paths)
	paths.sort()
	return paths


func _scan_into(directory: String, paths: Array[String]) -> void:
	var dir := DirAccess.open(directory)
	if dir == null:
		push_error("TurnManager: cannot open event directory %s (error %d)" % [
			directory, DirAccess.get_open_error()
		])
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		var full := directory.path_join(file_name)
		if dir.current_is_dir():
			# list_dir_begin() already skips "." and "..", and skip_navigational
			# is not set, so the only guard needed is against a hidden folder.
			if not file_name.begins_with("."):
				_scan_into(full, paths)
		elif file_name.get_extension().to_lower() == "json":
			paths.append(full)
		file_name = dir.get_next()
	dir.list_dir_end()


func _read_event(path: String) -> Dictionary:
	if path.is_empty():
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("TurnManager: cannot open event %s (error %d)" % [
			path, FileAccess.get_open_error()
		])
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not (parsed is Dictionary):
		push_error("TurnManager: %s is not a JSON object" % path)
		return {}
	return parsed


## Whether an event is allowed to play right now, using EventManager's own
## trigger_condition/story_flags check when it is available.
func _is_eligible(data: Dictionary) -> bool:
	if data.is_empty():
		return false
	var em := _event_manager_node()
	if em != null and em.has_method("can_play"):
		return bool(em.call("can_play", data))
	return _local_can_play(data)


## The same trigger_condition rules EventManager.can_play() applies, kept here
## so the turn system can still filter events when no EventManager node exists.
func _local_can_play(data: Dictionary) -> bool:
	if not data.has("trigger_condition"):
		return true
	var trigger: Dictionary = data.get("trigger_condition", {})
	if trigger.is_empty():
		return true
	if trigger.has("required_flag"):
		if not GameState.story_flags.has(str(trigger["required_flag"])):
			return false
	if trigger.has("required_flags"):
		for flag in trigger["required_flags"]:
			if not GameState.story_flags.has(str(flag)):
				return false
	if trigger.has("any_of_flags"):
		var any_of: Array = trigger["any_of_flags"]
		if not any_of.is_empty():
			var matched := false
			for flag in any_of:
				if GameState.story_flags.has(str(flag)):
					matched = true
					break
			if not matched:
				return false
	if trigger.has("blocked_flags"):
		for flag in trigger["blocked_flags"]:
			if GameState.story_flags.has(str(flag)):
				return false
	if trigger.has("min_turn"):
		if GameState.turn < int(trigger["min_turn"]):
			return false
	return true


# ------------------------------------------------------------------- the 3D

## Stage the entry for this turn, in whichever room the event asks for.
##
## This used to be a fallback chain -- the Oval if there was one, the cabinet
## room only if there was not -- which meant that in a scene holding both, the
## cabinet room could never be reached and its seat focus was dead code. An
## event says where it happens now, and the room that is not in use goes dark.
func _enter_speaker_3d(speaker: String) -> void:
	var room := _room_for_event(_current_event)
	_activate_room(room)
	if room == null:
		return

	if room.has_method("advisor_enters"):
		await _await_oval_arrival(room, speaker)
		return
	await _focus_cabinet_seat(room, speaker)


## Which room an event is staged in.
##
## An event picks with `"room": "cabinet"` at its top level; anything else, or
## nothing at all, means the Oval. A named room that the scene does not hold
## falls back to the one it does, so an event written for the cabinet still
## plays in a scene that only has an Oval in it.
func _room_for_event(data: Dictionary) -> Node:
	var wanted := str(data.get("room", "")).strip_edges().to_lower()
	var oval := _oval_office_node()
	var cabinet := _cabinet_room_node()
	if wanted == "cabinet":
		return cabinet if cabinet != null else oval
	return oval if oval != null else cabinet


## Show one room and its camera, and put the other away.
##
## Both room scenes set their own Camera3D current, which is right when either
## is opened on its own and wrong the moment they share a scene. Making the
## active room's camera current is what actually switches the view; hiding the
## other stops it drawing through the walls of the one in use.
func _activate_room(room: Node) -> void:
	_active_room = room
	for candidate in [_oval_office_node(), _cabinet_room_node()]:
		if candidate == null:
			continue
		var active: bool = candidate == room
		if candidate is Node3D:
			(candidate as Node3D).visible = active
		var cam := _camera_for_room(candidate)
		if cam != null:
			cam.current = active


## A room's own camera: its export when it has one, else a Camera3D by name.
## Falls back to this node's camera export, which is what a scene with a single
## shared camera wires.
func _camera_for_room(room: Node) -> Camera3D:
	if room != null:
		var owned: Variant = room.get("camera")
		if owned is Camera3D:
			return owned
		var found := room.get_node_or_null("Camera3D") as Camera3D
		if found != null:
			return found
	return _camera_node()


## The card a room opens, so a briefing shows on the Oval's and a cabinet
## meeting on the cabinet room's rather than both going to whichever one the
## scene happened to wire.
func _card_for_room(room: Node) -> Node:
	if room != null:
		for card_name in ["BriefingCard", "DossierCard"]:
			var card := room.get_node_or_null(card_name)
			if card != null:
				return card
		var owned: Variant = room.get("dossier_card")
		if owned is Node:
			return owned
	return _briefing_card()


func _await_oval_arrival(room: Node, speaker: String) -> void:
	_entry_arrived = false
	if room.has_signal("advisor_arrived"):
		if not room.is_connected("advisor_arrived", Callable(self, "_on_oval_arrived")):
			room.connect("advisor_arrived", Callable(self, "_on_oval_arrived"), CONNECT_ONE_SHOT)
	room.call("advisor_enters", speaker)
	var timer := get_tree().create_timer(_entry_timeout(room))
	while not _entry_arrived and timer.time_left > 0.0:
		await get_tree().process_frame


func _on_oval_arrived(_role: String, _person: Dictionary) -> void:
	_entry_arrived = true


## How long to wait for a room's entry before giving up on its arrived signal.
##
## Asks the room how long its own entry takes: cut_seconds since the Oval cuts
## to the advisor rather than walking them in, and walk_seconds for a room that
## still travels. Two seconds of slack on top, and a two second floor, because
## the cut is 0.3 and a timeout that tight would race the tween.
func _entry_timeout(room: Node) -> float:
	var seconds := 3.0
	if room != null:
		for property in ["cut_seconds", "walk_seconds"]:
			var value: Variant = room.get(property)
			if value is float or value is int:
				seconds = float(value)
				break
	return maxf(seconds + 2.0, 2.0)


## Fly the camera to a speaker's cabinet seat. Deliberately does not call
## CabinetRoom.focus_seat(): that path opens the room's dossier card on arrival,
## which is the tap interaction, not the event flow. This tween owns only the
## camera move so the briefing card and EventManager can take over the UI.
func _focus_cabinet_seat(room: Node, speaker: String) -> void:
	var index := _role_index(speaker)
	var cam := _camera_for_room(room)
	var seats := _cabinet_seats(room)
	if index < 0 or cam == null or index >= seats.size():
		push_warning("TurnManager: cannot focus a cabinet seat for '%s'" % speaker)
		return
	_set_camera_locked(true)
	var target := _cabinet_focus_transform(seats[index])
	_kill_entry_tween()
	_entry_tween = create_tween()
	_entry_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_entry_tween.tween_property(cam, "global_transform", target, focus_seconds)
	await _entry_tween.finished


func _role_index(speaker: String) -> int:
	var key := speaker.strip_edges().to_lower()
	for i in CABINET_ROLE_ORDER.size():
		if CABINET_ROLE_ORDER[i] == key:
			return i
	return -1


func _cabinet_seats(room: Node) -> Array[Marker3D]:
	var out: Array[Marker3D] = []
	if room == null:
		return out
	var source: Node = room
	var seats_root := room.get_node_or_null("Seats") as Node3D
	if seats_root != null:
		source = seats_root
	for child in source.get_children():
		if child is Marker3D:
			out.append(child as Marker3D)
	return out


func _cabinet_focus_transform(marker: Marker3D) -> Transform3D:
	# An authored Focus marker wins; otherwise stand in front of the seat at
	# seated-head height looking back at it.
	var authored := marker.get_node_or_null("Focus") as Marker3D
	if authored != null:
		return authored.global_transform
	var forward := -marker.global_transform.basis.z.normalized()
	var head := marker.global_position + Vector3(0.0, focus_height, 0.0)
	var distance := maxf(focus_distance, 0.05)
	var eye := head + forward * distance
	var look := Transform3D(Basis.IDENTITY, eye)
	if absf((head - eye).normalized().dot(Vector3.UP)) > 0.999:
		look = Transform3D(Basis.IDENTITY, eye)
	else:
		look = look.looking_at(head, Vector3.UP)
	return look


func _kill_entry_tween() -> void:
	if _entry_tween != null and _entry_tween.is_valid():
		_entry_tween.kill()


# --------------------------------------------------------------- presentation

func _load_portrait_into_card() -> void:
	var card := _card_for_room(_active_room)
	if card == null:
		return
	var face := Cast.portrait(_current_person)
	if card.has_method("open_briefing"):
		card.call("open_briefing", _current_speaker, _current_person, face)
	elif card.has_method("open_card"):
		card.call("open_card", _current_person, face)
	else:
		push_warning("TurnManager: BriefingCard has neither open_briefing() nor open_card().")


func _on_event_finished() -> void:
	on_choice_resolved(_last_choice)


func _on_choice_made(choice: Dictionary) -> void:
	_last_choice = choice


## The dialogue moved to a node. In the cabinet room, put the camera on whoever
## is speaking it.
##
## This is what a room full of named people is for. An event with one speaker
## names them once and every node inherits it, so nothing moves and the shot
## holds. An argument names a different secretary on each node, and the camera
## goes back and forth across the table with it.
##
## Only the cabinet room does this: the Oval stages one advisor standing at the
## desk, and there is nowhere else to look.
func _on_node_shown(_node_id: String, speaker: String) -> void:
	if _active_room == null or _active_room.has_method("advisor_enters"):
		return
	if speaker.is_empty() or _role_index(speaker) < 0:
		return
	if speaker == _current_speaker and _entry_tween != null and _entry_tween.is_valid():
		# Already on the way there from the entry; let that finish.
		return
	_current_speaker = speaker
	_current_person = _person_for_speaker(speaker)
	_load_portrait_into_card()
	await _focus_cabinet_seat(_active_room, speaker)


# ------------------------------------------------------------ end-of-run logic

func _end_condition() -> String:
	if int(GameState.approval) <= 0:
		return "impeachment"
	if int(GameState.budget) <= -50:
		return "collapse"
	return ""


## End the run: read the legacy off the state that produced it, put the
## epilogue on screen, and stop dealing turns.
func _trigger_game_over(reason: String) -> void:
	if _game_over:
		return
	_game_over = true
	_busy = false
	_set_camera_locked(false)
	_hide_event_ui()

	# Generated here rather than by the screen, and generated now rather than in
	# the screen's _ready(): GameState stays live after the run, so anything
	# that reads it later is scoring a different moment.
	var legacy := EpilogueGenerator.new().generate_legacy()
	legacy["reason"] = reason

	_show_epilogue(legacy, reason)
	game_over.emit(reason, legacy)
	print("TurnManager: game over - %s (%s, %d/100)" % [
		reason, str(legacy.get("grade", "?")), int(legacy.get("score", 0))
	])


## The event card has to come down with the run. Left up, its buttons sit under
## the epilogue and are still live.
func _hide_event_ui() -> void:
	var em := _event_manager_node()
	if em != null and em is CanvasItem:
		(em as CanvasItem).visible = false
	var card := _briefing_card()
	if card != null and card.has_method("close_card"):
		card.call("close_card")


func _show_epilogue(legacy: Dictionary, reason: String) -> void:
	var screen := _epilogue_screen()
	if screen == null:
		push_warning("TurnManager: no epilogue screen, so the run ends with nothing on screen.")
		return
	if screen.has_method("show_legacy"):
		screen.call("show_legacy", legacy, reason)
	elif screen is CanvasItem:
		(screen as CanvasItem).visible = true


## The epilogue screen, instantiated on first use.
##
## Added as a child of this node so it goes away with the turn system, and
## connected here rather than in a scene file so a scene that never authors one
## still gets the ending.
func _epilogue_screen() -> Node:
	if epilogue_screen != null and is_instance_valid(epilogue_screen):
		return epilogue_screen
	if epilogue_screen == null:
		epilogue_screen = get_node_or_null("EpilogueScreen")
	if epilogue_screen == null and epilogue_scene != null:
		epilogue_screen = epilogue_scene.instantiate()
		epilogue_screen.name = "EpilogueScreen"
		add_child(epilogue_screen)
	if epilogue_screen != null and epilogue_screen.has_signal("play_again"):
		if not epilogue_screen.is_connected("play_again", Callable(self, "restart_run")):
			epilogue_screen.connect("play_again", Callable(self, "restart_run"))
	return epilogue_screen


# --------------------------------------------------------------- playing again

## Start a fresh run from a finished one.
##
## Everything that remembers the last run is reset in one place: GameState's
## numbers, flags and played set, and this node's deck and current turn. The
## screen used to reset GameState by itself, which left the turn system finished
## and holding a spent deck over a brand new run.
func restart_run() -> void:
	_game_over = false
	_busy = false
	_kill_entry_tween()
	_current_event_path = ""
	_current_event = {}
	_current_speaker = ""
	_current_person = {}
	_last_choice = {}
	_deck.clear()
	_deck_cursor = 0
	_deck_ready = false

	GameState.start_new_run()

	var screen := _epilogue_screen()
	if screen != null and screen is CanvasItem:
		(screen as CanvasItem).visible = false

	# The rooms are seeded off the cabinet, and the cabinet is new, so whoever
	# owns them gets told before the first turn of the new run is dealt.
	run_restarted.emit()
	start_turn()


# ------------------------------------------------------------------- speakers

func _speaker_for_event(data: Dictionary) -> String:
	var speaker := str(data.get("speaker", ""))
	if speaker.is_empty():
		var conditional: Variant = data.get("conditional_text", {})
		if conditional is Dictionary:
			speaker = str((conditional as Dictionary).get("speaker", ""))
	if speaker.is_empty():
		return "chief"
	return speaker.strip_edges().to_lower()


func _person_for_speaker(speaker: String) -> Dictionary:
	var key := speaker.strip_edges().to_lower()

	# A full run state, when supplied, has the complete person records the
	# rooms use, so it wins over the autoload's role -> first-name map.
	if not _run_state.is_empty():
		var cabinet: Variant = _run_state.get("cabinet", [])
		if cabinet is Array:
			for person in cabinet:
				if str(person.get("office", "")).to_lower() == key:
					return person
		var family: Variant = _run_state.get("family", [])
		if family is Array:
			for member in family:
				var id := str(member.get("id", "")).to_lower()
				var kind := str(member.get("kind", "")).to_lower()
				if id == key or kind == key:
					return member

	# The cabinet is cast once in GameState, so the office is enough to name
	# whoever holds it and to title them.
	if GameState.cabinet_roles.has(key):
		return {
			"office": key,
			"name": GameState.cabinet_name(key),
			"title": GameState.cabinet_title(key),
		}

	match key:
		"press":
			return {"role": "press", "name": "The correspondent", "title": "Political correspondent"}
		"ally":
			return {"role": "ally", "name": "The Prime Minister", "title": "Head of government"}
		"spouse":
			return {"kind": "spouse"}
	return {}


# ------------------------------------------------------------------ node setup

func _resolve_nodes() -> void:
	if event_manager == null:
		event_manager = get_node_or_null("EventManager")
	if oval_office == null:
		oval_office = get_node_or_null("OvalOffice")
	if cabinet_room == null:
		cabinet_room = get_node_or_null("CabinetRoom")
	if briefing_card == null:
		briefing_card = get_node_or_null("BriefingCard")
		if briefing_card == null and oval_office != null:
			briefing_card = oval_office.get_node_or_null("BriefingCard")
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D


func _connect_event_signals() -> void:
	var em := _event_manager_node()
	if em == null:
		return
	if em.has_signal("choice_made"):
		if not em.is_connected("choice_made", Callable(self, "_on_choice_made")):
			em.connect("choice_made", Callable(self, "_on_choice_made"))
	if em.has_signal("node_shown"):
		if not em.is_connected("node_shown", Callable(self, "_on_node_shown")):
			em.connect("node_shown", Callable(self, "_on_node_shown"))


func _event_manager_node() -> Node:
	if event_manager == null:
		event_manager = get_node_or_null("EventManager")
	if event_manager == null:
		var created := EventManager.new()
		created.name = "EventManager"
		add_child(created)
		event_manager = created
	return event_manager


func _oval_office_node() -> Node:
	if oval_office == null:
		oval_office = get_node_or_null("OvalOffice")
	return oval_office


func _cabinet_room_node() -> Node:
	if cabinet_room == null:
		cabinet_room = get_node_or_null("CabinetRoom")
	return cabinet_room


func _briefing_card() -> Node:
	if briefing_card == null:
		briefing_card = get_node_or_null("BriefingCard")
		if briefing_card == null:
			var oval := _oval_office_node()
			if oval != null:
				briefing_card = oval.get_node_or_null("BriefingCard")
	return briefing_card


func _camera_node() -> Camera3D:
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D
	return camera


func _set_camera_locked(locked: bool) -> void:
	var controller := _player_controller()
	if controller != null and controller.has_method("set_camera_locked"):
		controller.call("set_camera_locked", locked)


func _player_controller() -> Node:
	var room := _cabinet_room_node()
	if room != null:
		var pc: Variant = room.get("player_controller")
		if pc is Node:
			return pc
	return get_parent()
