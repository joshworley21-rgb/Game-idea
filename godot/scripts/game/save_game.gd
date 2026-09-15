class_name SaveGame
extends RefCounted
## Saving and loading a run.
##
## Ported from src/game/save.ts, which uses localStorage. Godot's equivalent
## is a file under user://, which is per-user and survives an app update.
##
## Two things differ from the browser and both are about JSON, not about
## Godot. A round-trip through JSON turns every integer into a float, so
## restore() puts the handful of fields that are genuinely whole numbers back
## — month, ap, the seed, the danger streak — because they are compared and
## stored directly rather than always read through int(). And a saved bill
## carries only what changed about it, the same as the TypeScript: the
## catalogue is rebuilt from code on load, so a save cannot pin an old
## version of a bill's effects.

const PATH := "user://oval.save.v1.json"

## Fields that are whole numbers in the state and floats after a JSON
## round-trip. Everything else is read through int() or float() at the point
## of use, so it does not matter what JSON made of it.
const WHOLE := ["seed", "month", "ap", "apMax", "dangerStreak"]


## Bills carry a requirement id and a catalogue entry's worth of text, so only
## what a run can change about them is persisted.
static func serialize(state: Dictionary) -> Dictionary:
	var out := state.duplicate(true)
	var bills: Array = []
	for b in (state["bills"] as Array):
		var row := {"id": b["id"], "status": b.get("status", "open")}
		if b.has("failedMonth"):
			row["failedMonth"] = b["failedMonth"]
		bills.append(row)
	out["bills"] = bills
	return out


## Puts back what JSON flattened. See WHOLE.
static func restore(state: Dictionary) -> Dictionary:
	for key in WHOLE:
		if state.has(key) and state[key] != null:
			state[key] = int(state[key])
	var personal: Dictionary = state.get("personal", {})
	# age is a float on purpose -- it advances a twelfth at a time.
	if personal.has("age"):
		personal["age"] = float(personal["age"])
	return state


static func save_game(state: Dictionary) -> bool:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(serialize(state)))
	f.close()
	return true


## The saved state, or {} if there is none or it is not readable.
static func load_game() -> Dictionary:
	if not FileAccess.file_exists(PATH):
		return {}
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return {}
	var raw := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(raw)
	if not (parsed is Dictionary):
		return {}
	var state: Dictionary = parsed
	# The same two sanity checks the TypeScript makes: a save with no month or
	# no country in it is not a save, whatever else it has.
	if not state.has("month") or not (state["month"] is float or state["month"] is int):
		return {}
	if not state.has("nation") or not (state["nation"] is Dictionary):
		return {}
	return restore(state)


static func has_save() -> bool:
	return FileAccess.file_exists(PATH)


static func clear_save() -> void:
	if FileAccess.file_exists(PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(PATH))
