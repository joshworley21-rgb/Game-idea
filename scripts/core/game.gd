class_name Game
extends Node3D
## Starts a run and hands it to TurnManager.
##
## Everything the port had was written but never assembled: GameState held the
## numbers, TurnManager knew how to play a turn, the rooms knew how to stage
## one, and nothing put the three together, so no scene in the project ever
## drove a turn. This is that missing piece, and it is deliberately thin --
## start a run, start the first turn, and let TurnManager's own loop carry the
## rest, because on_choice_resolved() already advances the calendar and calls
## start_turn() again.
##
## The nodes it expects, all resolvable by name if the exports are left unset:
##
##   Game                    this script
##   |- OvalOffice           or any room TurnManager can stage an entry in
##   |- TurnManager
##   |   `- EventManager
##   `- HUD

## The run ended. Carries TurnManager's reason: "impeachment" or "collapse".
signal run_finished(reason: String)

@export var turn_manager: Node
## Cabinet names to run with. Left empty, GameState uses its own pool of 24.
@export var cabinet_names: Array[String] = []
## Whether to deal the first turn as soon as the scene is ready. A test that
## wants to drive the turns itself turns this off.
@export var autostart: bool = true

var _started := false


func _ready() -> void:
	if turn_manager == null:
		turn_manager = get_node_or_null("TurnManager")
	if turn_manager == null:
		push_error("Game: no TurnManager node found, so nothing will drive a turn.")
		return

	if turn_manager.has_signal("game_over"):
		turn_manager.connect("game_over", Callable(self, "_on_game_over"))
	# The turn system resets everything and deals the first turn of the new run
	# itself; this only has to put the new cabinet back in the rooms.
	if turn_manager.has_signal("run_restarted"):
		turn_manager.connect("run_restarted", Callable(self, "_on_run_restarted"))

	if autostart:
		start_run()


## Resets GameState and deals the first turn. Safe to call again on a finished
## run: it starts a fresh one.
func start_run() -> void:
	GameState.start_new_run(cabinet_names)
	_seed_rooms()

	_started = true
	if turn_manager != null and turn_manager.has_method("start_turn"):
		turn_manager.call("start_turn")


## Hand the rooms and the turn system the current cabinet.
##
## The rooms resolve a speaker to a person, and the full run state is what
## carries the portraits. GameState's own role -> first-name map is the
## fallback, so a room with no state still seats somebody.
func _seed_rooms() -> void:
	var state := {"cabinet": _cabinet_from_state()}
	for room in [get_node_or_null("OvalOffice"), get_node_or_null("CabinetRoom")]:
		if room != null and room.has_method("set_state"):
			room.call("set_state", state)
	if turn_manager != null and turn_manager.has_method("set_state"):
		turn_manager.call("set_state", state)


## A new run was started from the epilogue screen. GameState has already been
## reset by then, so the cabinet read here is the new one.
func _on_run_restarted() -> void:
	_started = true
	_seed_rooms()


func is_running() -> bool:
	return _started


## GameState stores the cabinet as role -> full name, which is all the
## simulation needs but not enough for a room: the rooms want a record per
## person, with the office and the title on it, so Cast can find a portrait and
## the dossier has something to put under it.
func _cabinet_from_state() -> Array:
	var people: Array = []
	for role in GameState.CABINET_ROLES:
		if not GameState.cabinet_roles.has(role):
			continue
		people.append({
			"office": role,
			"name": GameState.cabinet_name(role),
			"title": GameState.cabinet_title(role),
		})
	return people


func _on_game_over(reason: String, _legacy: Dictionary) -> void:
	_started = false
	print("Game: the run ended - %s" % reason)
	run_finished.emit(reason)
