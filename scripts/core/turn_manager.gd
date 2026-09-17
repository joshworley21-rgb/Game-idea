class_name TurnManager
extends Node
## The main gameplay turn controller.
##
## One turn is: pick an eligible event, walk the speaker into the room (or fly
## the camera to their cabinet seat), present that event through EventManager,
## then resolve the choice and roll the calendar forward.
##
## The scene this is attached to is expected to hold an EventManager node and,
## depending on the room, an OvalOffice or a CabinetRoom. References are
## exported so a .tscn can wire them explicitly, but every one of them also has
## a name-based fallback below, so the script keeps working in a scene that
## simply names its nodes the same way.

## Emitted when start_turn() has selected an event but before the 3D entry.
signal turn_started(event_id: String, speaker: String)
## Emitted when the event has been handed to EventManager to render.
signal turn_presented(event_id: String, speaker: String)
## Emitted when a choice resolves, with the choice Dictionary EventManager saw.
signal turn_resolved(choice: Dictionary)
## Emitted when no eligible event could be found.
signal turn_skipped
## Emitted when a win/loss threshold ends the run. `reason` is "impeachment"
## (approval at or below 0) or "collapse" (budget at or below -50).
signal game_over(reason: String)

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


func _ready() -> void:
	_resolve_nodes()
	_connect_event_signals()


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
		_busy = false
		turn_skipped.emit()
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

	GameState.end_of_turn_checks()
	GameState.advance_turn()
	start_turn()


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
func _next_deck_path() -> String:
	_ensure_deck()
	if _deck.is_empty():
		return ""
	for _i in _deck.size():
		if _deck_cursor >= _deck.size():
			_deck_cursor = 0
		var path: String = _deck[_deck_cursor]
		_deck_cursor += 1
		var data := _read_event(path)
		if not data.is_empty() and _is_eligible(data):
			return path
	return ""


func _ensure_deck() -> void:
	if _deck_ready:
		return
	_deck_ready = true
	_deck = _scan_event_files()
	_deck.shuffle()
	_deck_cursor = 0


func _scan_event_files() -> Array[String]:
	var paths: Array[String] = []
	var dir := DirAccess.open(event_directory)
	if dir == null:
		push_error("TurnManager: cannot open event directory %s (error %d)" % [
			event_directory, DirAccess.get_open_error()
		])
		return paths
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.get_extension().to_lower() == "json":
			paths.append(event_directory.path_join(file_name))
		file_name = dir.get_next()
	dir.list_dir_end()
	paths.sort()
	return paths


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
	if trigger.has("blocked_flags"):
		for flag in trigger["blocked_flags"]:
			if GameState.story_flags.has(str(flag)):
				return false
	return true


# ------------------------------------------------------------------- the 3D

func _enter_speaker_3d(speaker: String) -> void:
	var oval := _oval_office_node()
	if oval != null and oval.has_method("advisor_enters"):
		await _await_oval_arrival(oval, speaker)
		return
	var room := _cabinet_room_node()
	if room != null:
		await _focus_cabinet_seat(room, speaker)


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


func _entry_timeout(room: Node) -> float:
	var seconds := 3.0
	if room != null:
		var value: Variant = room.get("walk_seconds")
		if value is float or value is int:
			seconds = float(value)
	return maxf(seconds + 2.0, 2.0)


## Fly the camera to a speaker's cabinet seat. Deliberately does not call
## CabinetRoom.focus_seat(): that path opens the room's dossier card on arrival,
## which is the tap interaction, not the event flow. This tween owns only the
## camera move so the briefing card and EventManager can take over the UI.
func _focus_cabinet_seat(room: Node, speaker: String) -> void:
	var index := _role_index(speaker)
	var cam := _camera_node()
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
	var card := _briefing_card()
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


# ------------------------------------------------------------ end-of-run logic

func _end_condition() -> String:
	if int(GameState.approval) <= 0:
		return "impeachment"
	if int(GameState.budget) <= -50:
		return "collapse"
	return ""


func _trigger_game_over(reason: String) -> void:
	if _game_over:
		return
	_game_over = true
	_set_camera_locked(false)
	game_over.emit(reason)
	print("TurnManager: game over - %s" % reason)


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

	# GameState's simple map is enough for the cabinet roles. The chief needs
	# the full name because the chief portrait is stored as chief/ruth-ellery.
	if GameState.cabinet_roles.has(key):
		var first := str(GameState.cabinet_roles[key])
		if key == "chief" and first.to_lower() == "ruth":
			return {"office": "chief", "title": "Chief of Staff", "name": "Ruth Ellery"}
		return {"office": key, "name": first}

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
