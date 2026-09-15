class_name StateData
extends RefCounted
## The opening position: a new game's state Dictionary.
##
## Ported from src/game/state.ts createInitialState. This is the piece the
## rest of the port was missing — every other module here reads and writes a
## state Dictionary and none of them could build one, so nothing could be run
## at all.
##
## The draw order matters as much as the values. Every jitter below pulls from
## the same seeded Rng in the same sequence as the TypeScript, so the same seed
## produces the same opening position in both engines. Reordering these fields
## would silently give Godot a different game from the same seed.


## base +/- spread, clamped. The TypeScript defaults are +/-INF; GDScript has
## no default INF parameter worth writing, so the callers pass bounds.
static func _jitter(rng: Rng, base: float, spread: float,
		min_v: float = -1.0e30, max_v: float = 1.0e30) -> float:
	return clampf(base + rng.range_float(-spread, spread), min_v, max_v)


static func _mood(rng: Rng, seats: int, base: float, lo: float, hi: float) -> Dictionary:
	return {"seats": seats, "mood": _jitter(rng, base, 8.0, lo, hi)}


## `party` is "blue" or "red"; `president_name` may be empty for the default.
static func create_initial_state(party: String, president_name: String, seed: int) -> Dictionary:
	# The state's own seed is recorded, but the opening position is drawn from
	# a derived stream so that a run and its replay do not share a sequence.
	var rng := Rng.new(seed ^ 0x9e3779b9)

	var budget := {}
	for key in CoreData.BUDGET_KEYS:
		var base: float = CoreData.START_BUDGET[key]
		budget[key] = roundf(_jitter(rng, base, base * 0.08, 0.0))

	var name := president_name.strip_edges()
	if name.is_empty():
		name = "President Vance"

	var state := {
		"seed": seed,
		"month": 1,
		"ap": 3,
		"apMax": 3,
		"party": party,
		"presidentName": name,
		"nation": {
			"growth": _jitter(rng, 2.2, 0.7),
			"unemployment": _jitter(rng, 4.6, 0.6, 2.0),
			"inflation": _jitter(rng, 2.7, 0.5, 0.5),
			"debtToGdp": _jitter(rng, 98.0, 8.0, 60.0),
			"gdp": 28000.0,
			"taxRate": 17.5,
			"sectors": {
				"defense": _jitter(rng, 62.0, 7.0, 10.0, 90.0),
				"healthcare": _jitter(rng, 41.0, 7.0, 10.0, 90.0),
				"education": _jitter(rng, 47.0, 7.0, 10.0, 90.0),
				"infrastructure": _jitter(rng, 34.0, 7.0, 10.0, 90.0),
				"environment": _jitter(rng, 33.0, 7.0, 10.0, 90.0),
				"science": _jitter(rng, 55.0, 7.0, 10.0, 90.0),
				"welfare": _jitter(rng, 50.0, 7.0, 10.0, 90.0),
				"justice": _jitter(rng, 45.0, 7.0, 10.0, 90.0),
				"veterans": _jitter(rng, 44.0, 7.0, 10.0, 90.0),
			},
			"unrest": _jitter(rng, 34.0, 9.0, 5.0, 70.0),
			"standing": _jitter(rng, 58.0, 9.0, 20.0, 90.0),
			"security": _jitter(rng, 61.0, 9.0, 20.0, 90.0),
		},
		"politics": {
			"approval": _jitter(rng, 52.0, 6.0, 30.0, 70.0),
			"capital": _jitter(rng, 60.0, 9.0, 30.0, 90.0),
			"house": _jitter(rng, 52.0, 6.0, 25.0, 75.0),
			"senate": _jitter(rng, 51.0, 6.0, 25.0, 75.0),
			"media": _jitter(rng, 50.0, 8.0, 20.0, 80.0),
			"party": _jitter(rng, 66.0, 7.0, 40.0, 90.0),
			"scandal": _jitter(rng, 6.0, 5.0, 0.0, 25.0),
		},
		"personal": {
			"health": _jitter(rng, 78.0, 7.0, 40.0, 95.0),
			"stress": _jitter(rng, 30.0, 8.0, 5.0, 55.0),
			"marriage": _jitter(rng, 74.0, 8.0, 40.0, 95.0),
			"family": _jitter(rng, 70.0, 8.0, 40.0, 95.0),
			"integrity": _jitter(rng, 72.0, 7.0, 40.0, 95.0),
			"age": roundf(_jitter(rng, 56.0, 6.0, 42.0, 70.0)),
			"sleepDebt": _jitter(rng, 22.0, 7.0, 0.0, 45.0),
			"fitness": _jitter(rng, 62.0, 9.0, 25.0, 90.0),
		},
		"budget": budget,
		"enacted": budget.duplicate(),
		"bills": [],
		"modifiers": [],
		"news": [],
		"log": [],
		"pendingCrises": [],
		"pendingArc": null,
		"threads": [],
		"heat": {},
		# Everyone starts a little above water; the leans are applied on the
		# first tick.
		"blocs": {
			"labour": _jitter(rng, 54.0, 6.0, 30.0, 75.0),
			"business": _jitter(rng, 50.0, 6.0, 30.0, 75.0),
			"seniors": _jitter(rng, 53.0, 6.0, 30.0, 75.0),
			"young": _jitter(rng, 51.0, 6.0, 30.0, 75.0),
			"rural": _jitter(rng, 48.0, 6.0, 30.0, 75.0),
			"suburban": _jitter(rng, 52.0, 6.0, 30.0, 75.0),
			"activists": _jitter(rng, 50.0, 6.0, 30.0, 75.0),
			"traditionalists": _jitter(rng, 48.0, 6.0, 30.0, 75.0),
		},
		"cabinet": [],
		"family": [],
		"unlocked": [],
		"crisisHistory": {},
		"history": [],
		"actionHistory": {},
		"flags": {},
		"counters": {"billsPassed": 0, "billsFailed": 0, "crisesHandled": 0, "vetoes": 0},
		"phase": "playing",
		"ending": null,
		"dangerStreak": 0,
		"runningForReelection": true,
	}

	# A closely divided Congress with the moderates holding the balance. The
	# seats are a fixed, readable split; only how warm each faction starts
	# toward you moves, and which end of the chamber is warm depends on which
	# party you are.
	if party == "blue":
		state["factions"] = {
			"progressives": _mood(rng, 12, 58.0, 20.0, 85.0),
			"liberals": _mood(rng, 26, 60.0, 20.0, 85.0),
			"moderates": _mood(rng, 22, 52.0, 20.0, 85.0),
			"conservatives": _mood(rng, 25, 41.0, 15.0, 70.0),
			"hardliners": _mood(rng, 15, 30.0, 10.0, 60.0),
		}
	else:
		state["factions"] = {
			"progressives": _mood(rng, 12, 30.0, 10.0, 60.0),
			"liberals": _mood(rng, 26, 41.0, 15.0, 70.0),
			"moderates": _mood(rng, 22, 52.0, 20.0, 85.0),
			"conservatives": _mood(rng, 25, 60.0, 20.0, 85.0),
			"hardliners": _mood(rng, 15, 58.0, 20.0, 85.0),
		}

	return state


## Month 1 is January of the first year in office.
static func calendar(month: int) -> Dictionary:
	var index := (month - 1) % 12
	var year := (month - 1) / 12 + 1
	var month_name: String = CoreData.MONTH_NAMES[index]
	return {"year": year, "monthName": month_name, "label": "%s, Year %d" % [month_name, year]}
