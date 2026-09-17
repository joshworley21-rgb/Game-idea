extends Node
## Singleton run state for the Godot port.
##
## Holds the four headline numbers the cabinet room and UI read from, the
## decisions the player has made, and the current cabinet lineup. Registered
## as the `GameState` autoload in project.godot, so any scene can reach it as
## `GameState.approval`, `GameState.cabinet_roles`, and so on.

## The four headline numbers. Each opens at a neutral 50.
var approval: int = 50
var budget: int = 50
var tension: int = 50
var loyalty: int = 50

## Story beats the player has triggered, keyed by flag id.
var story_flags: Dictionary = {}

## Which cabinet member currently holds each office.
## Keys are the six role ids; values are first names from CABINET_NAMES.
var cabinet_roles: Dictionary = {}

## The 24 first names drawn into the cabinet at the start of a run.
const CABINET_NAMES: Array[String] = [
	"Margaret", "Daniel", "Ruth", "Marcus", "Eleanor", "Priya", "Thomas",
	"Grace", "Andre", "Helen", "Victor", "Naomi", "Charles", "Rosa",
	"Edward", "Fiona", "Malcolm", "Diane", "Samuel", "Yusuf", "Claire",
	"Nathan", "Imani", "Walter",
]

## The six offices filled from the shuffled pool, in seating order.
const CABINET_ROLES: Array[String] = [
	"chief", "treasury", "state", "defense", "justice", "health",
]


func _ready() -> void:
	# Autoloads call _ready() when the game boots; seed the global RNG so
	# each run draws a different cabinet.
	randomize()


## Starts a fresh run: resets the headline numbers and flags, then shuffles
## the 24 cabinet names and assigns one to each of the six roles.
##
## [param names] is optional. When omitted (the normal case) it uses the
## built-in CABINET_NAMES pool; a caller may pass its own list of 6+ names.
func start_new_run(names: Array = []) -> void:
	approval = 50
	budget = 50
	tension = 50
	loyalty = 50
	story_flags.clear()
	cabinet_roles.clear()

	var pool: Array[String] = CABINET_NAMES.duplicate()
	if not names.is_empty() and names.size() >= CABINET_ROLES.size():
		pool = []
		for entry in names:
			pool.append(str(entry))
	pool.shuffle()

	for i in range(CABINET_ROLES.size()):
		cabinet_roles[CABINET_ROLES[i]] = pool[i]


## Applies a set of stat deltas to the headline numbers and, if [param new_flag]
## is non-empty, records that story flag as triggered.
##
## [param stat_changes] keys must be one of "approval", "budget", "tension",
## or "loyalty"; values are the integer amount to add (negative to subtract).
func apply_choice(stat_changes: Dictionary, new_flag: String = "") -> void:
	for stat_name in stat_changes:
		var delta := int(stat_changes[stat_name])
		match str(stat_name):
			"approval":
				approval += delta
			"budget":
				budget += delta
			"tension":
				tension += delta
			"loyalty":
				loyalty += delta
	if not new_flag.is_empty():
		story_flags[new_flag] = true
