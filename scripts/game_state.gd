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

## How many turns have been played, counting the first as 1. The calendar above
## cannot answer this: it wraps, so "week 2" is the second turn of a month and
## not the second turn of the run. An event's `min_turn` is measured against
## this, so a beat can be held back until the player has some history.
var turn: int = 1

## Ids of events already played this run, so the deck does not deal one twice.
## An arc depends on it: stage one sets the flag stage two needs, and without
## this the deck would keep returning to stage one and setting it again.
var played_events: Dictionary = {}

## Story beats the player has triggered, keyed by flag id.
var story_flags: Dictionary = {}

## Which cabinet member currently holds each office.
## Keys are the six role ids; values are full names, from CABINET_CAST below.
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

## The six offices, in seating order.
const CABINET_ROLES: Array[String] = [
	"chief", "treasury", "state", "defense", "justice", "health",
]

## The cabinet, cast once rather than drawn.
##
## The six roles used to be dealt from a shuffled pool of the 24 names above, so
## a run's cabinet was different every time. That broke anything written about a
## particular person, and it broke it in three places at once: an event naming
## Margaret got whoever the shuffle had seated at Defense, the voice archetypes
## in character_profiles.json are keyed by *name* so they moved with the shuffle
## too, and once the camera started cutting to a speaker's seat it pointed at
## somebody the line had not been written for.
##
## So they are fixed here. Every first name is one the portraits cover (see
## godot/assets/portraits/cabinet/) and one character_profiles.json already
## carries an archetype for, which is what binds archetype to office: the
## archetype follows the name, and now the name never moves. The surnames are
## the ones the project already used for these people in its own test casts.
##
##   chief     Ruth Ellery        Operator
##   treasury  Priya Nakamura     Scholar
##   state     Daniel Osei        Scholar
##   defense   Margaret Halloran  Hawk
##   justice   Eleanor Brennan    Hawk
##   health    Marcus Petrov      Idealist
##
## The chief's full name matters twice over: Cast.portrait_key() files the chief
## under the whole name because "Ruth" is also a cabinet and a child name, so
## the portrait at chief/ruth-ellery.webp only resolves for a chief called
## exactly that.
const CABINET_CAST := {
	"chief": {"name": "Ruth Ellery", "title": "Chief of Staff"},
	"treasury": {"name": "Priya Nakamura", "title": "Treasury Secretary"},
	"state": {"name": "Daniel Osei", "title": "Secretary of State"},
	"defense": {"name": "Margaret Halloran", "title": "Defense Secretary"},
	"justice": {"name": "Eleanor Brennan", "title": "Attorney General"},
	"health": {"name": "Marcus Petrov", "title": "Health Secretary"},
}


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
	# The profiles are keyed by first name and the cabinet carries full ones, so
	# a miss is retried on the first word before giving up.
	var parts := character_name.strip_edges().split(" ", false)
	if parts.size() > 1:
		for group in character_profiles.values():
			if group is Dictionary and group.has(parts[0]):
				return str(group[parts[0]])
	return ""


# ------------------------------------------------------------------ the cabinet

## The full name of whoever holds [param role], or "" for an office nobody does.
func cabinet_name(role: String) -> String:
	return str(cabinet_roles.get(role, ""))


## Their first name, which is the key the portraits and the body models use.
func cabinet_first_name(role: String) -> String:
	var parts := cabinet_name(role).split(" ", false)
	return parts[0] if parts.size() > 0 else ""


## Their formal title -- "Defense Secretary", "Attorney General".
func cabinet_title(role: String) -> String:
	var cast_entry: Variant = CABINET_CAST.get(role, {})
	return str((cast_entry as Dictionary).get("title", "")) if cast_entry is Dictionary else ""


## Their voice archetype: "Hawk", "Scholar", "Operator", "Idealist".
func cabinet_archetype(role: String) -> String:
	return voice_archetype(cabinet_first_name(role))


## Starts a fresh run: resets the headline numbers and flags, then seats the
## cabinet.
##
## [param names] is optional and is an override, not the normal path. Left
## empty -- which is what every caller in the game does -- the six offices are
## filled from CABINET_CAST and are the same people in every run. Passing a
## list of six or more names goes back to drawing from that list at random,
## which is there for a caller that wants an arbitrary cabinet to test against.
func start_new_run(names: Array = []) -> void:
	approval = 50
	budget = 50
	tension = 50
	loyalty = 50
	year = 1
	month = 1
	week = 1
	turn = 1
	story_flags.clear()
	played_events.clear()
	cabinet_roles.clear()
	_reset_relationship_state()

	if names.is_empty() or names.size() < CABINET_ROLES.size():
		for role in CABINET_ROLES:
			cabinet_roles[role] = str((CABINET_CAST[role] as Dictionary)["name"])
	else:
		var pool: Array[String] = []
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
	turn += 1
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


## Records [param event_id] as played, so the deck stops offering it.
## The id is an event's file name without its extension, which is what
## TurnManager.current_event_id() returns.
func mark_event_played(event_id: String) -> void:
	if event_id.is_empty():
		return
	played_events[event_id] = true


func has_played_event(event_id: String) -> bool:
	return not event_id.is_empty() and played_events.has(event_id)


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
