extends Node
## Singleton run state for the Godot port.
##
## Holds the four headline numbers the cabinet room and UI read from, the
## decisions the player has made, and the current cabinet lineup. Registered
## as the `GameState` autoload in project.godot, so any scene can reach it as
## `GameState.approval`, `GameState.cabinet_roles`, and so on.

## Emitted after [method apply_choice] changes one or more headline stats, so
## reactive UI (the HUD) can tween to the new values.
signal stats_changed

## Emitted after [method advance_turn] moves the in-game calendar. Carries the
## new year, month and week so listeners do not need to reach back into state.
signal calendar_changed(year: int, month: int, week: int)

## The four headline numbers. Each opens at a neutral 50.
var approval: int = 50
var budget: int = 50
var tension: int = 50
var loyalty: int = 50

## The in-game calendar, advanced once per turn by [method advance_turn].
## Stored separately rather than as one counter so the HUD can format it as
## "Year 1 - Month 1, Week 1" without parsing anything.
var year: int = 1
var month: int = 1
var week: int = 1

## Story beats the player has triggered, keyed by flag id.
var story_flags: Dictionary = {}

## Which cabinet member currently holds each office.
## Keys are the six role ids; values are first names from CABINET_NAMES.
var cabinet_roles: Dictionary = {}

## Relationship score (0-100) with each of the six active cabinet roles.
## Higher means more loyal to the player. Resets to a neutral 50 per role.
var advisor_trust: Dictionary = {}

## Discovered leverage strings, e.g. "treasury_offshore_accounts".
var known_secrets: Array[String] = []

## Event ids queued by end_of_turn_checks() to fire on the next turn.
var pending_events: Array[String] = []

## Voice archetype for every named character, loaded once at startup from
## res://data/character_profiles.json. Grouped by "cabinet", "spouses" and
## "children" because some first names (Marcus, Priya, Ruth, ...) appear in
## more than one group.
var character_profiles: Dictionary = {}

## The player's background id. Dialogue choices can be gated on this value;
## see EventManager's required_background choice field.
var player_background: String = "ex_military"

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
	# Personality data is read here so every run starts with the same,
	# complete character -> archetype map already in memory.
	_load_character_profiles()
	# Relationship and leverage state is also valid before the first
	# start_new_run(), so the UI can safely read it during boot.
	_reset_relationship_state()


## Reads res://data/character_profiles.json into [member character_profiles].
func _load_character_profiles() -> void:
	character_profiles.clear()
	var file := FileAccess.open("res://data/character_profiles.json", FileAccess.READ)
	if file == null:
		push_error("GameState: cannot open res://data/character_profiles.json (error %d)" % FileAccess.get_open_error())
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary:
		character_profiles = parsed
	else:
		push_error("GameState: character_profiles.json is not a JSON object")


## Returns the voice archetype for [param character_name] ("Hawk", "Scholar",
## "Strained Spouse", ...), searching the cabinet, spouses and children groups.
## Returns "" when the name is not in the profile data.
func voice_archetype(character_name: String) -> String:
	for group in character_profiles.values():
		if group is Dictionary and group.has(character_name):
			return str(group[character_name])
	return ""


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
	year = 1
	month = 1
	week = 1
	story_flags.clear()
	cabinet_roles.clear()
	_reset_relationship_state()

	var pool: Array[String] = CABINET_NAMES.duplicate()
	if not names.is_empty() and names.size() >= CABINET_ROLES.size():
		pool = []
		for entry in names:
			pool.append(str(entry))
	pool.shuffle()

	for i in range(CABINET_ROLES.size()):
		cabinet_roles[CABINET_ROLES[i]] = pool[i]

	stats_changed.emit()
	calendar_changed.emit(year, month, week)


## Applies a set of stat deltas to the headline numbers and, if [param new_flag]
## is non-empty, records that story flag as triggered.
##
## [param stat_changes] keys must be one of "approval", "budget", "tension",
## or "loyalty"; values are the integer amount to add (negative to subtract).
##
## [param trust_impact] is an optional role -> delta map ("chief", "treasury",
## ...). Those deltas are applied to [member advisor_trust] and clamped to the
## 0-100 range.
func apply_choice(stat_changes: Dictionary, new_flag: String = "", trust_impact: Dictionary = {}) -> void:
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
	for role in trust_impact:
		var role_id := str(role)
		if advisor_trust.has(role_id):
			var new_trust := int(advisor_trust[role_id]) + int(trust_impact[role])
			advisor_trust[role_id] = clampi(new_trust, 0, 100)
	stats_changed.emit()


## Re-seeds [member advisor_trust] to a neutral 50 for every active cabinet
## role and clears [member known_secrets] and [member pending_events].
func _reset_relationship_state() -> void:
	advisor_trust.clear()
	for role in CABINET_ROLES:
		advisor_trust[role] = 50
	known_secrets.clear()
	pending_events.clear()


## Advances the in-game calendar one week and emits [signal calendar_changed].
##
## The HUD listens for this rather than polling, so its date label updates the
## moment the turn system moves forward. The week wraps at four into the next
## month, and the month wraps at twelve into the next year.
func advance_turn() -> void:
	week += 1
	if week > 4:
		week = 1
		month += 1
		if month > 12:
			month = 1
			year += 1
	calendar_changed.emit(year, month, week)
	# Advancing a turn is exactly the moment resignations should surface, so the
	# turn system gets both in one call.
	end_of_turn_checks()


## The current date as the HUD prints it, e.g. "Year 1 - Month 1, Week 1".
func date_text() -> String:
	return "Year %d - Month %d, Week %d" % [year, month, week]


## End-of-turn sweep. Any active cabinet role whose trust has fallen below 20
## queues a "resignation_threat" event id in [member pending_events] (once),
## ready for the turn system to pop and play on the next turn.
func end_of_turn_checks() -> void:
	for role in CABINET_ROLES:
		if advisor_trust.has(role) and int(advisor_trust[role]) < 20:
			if not pending_events.has("resignation_threat"):
				pending_events.append("resignation_threat")
				print("GameState: %s trust is %d - queued resignation_threat" % [role, int(advisor_trust[role])])
