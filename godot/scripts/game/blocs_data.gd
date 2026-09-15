class_name BlocsData
extends RefCounted
## What the eight blocs of the electorate want, and how fast they move.
##
## Ported from src/game/blocs.ts. The bloc definitions themselves — weight,
## volatility, lean, the line about what each one cares about — already live in
## CoreData.BLOCS, but the part that makes them a simulation rather than a
## table did not survive the trip: each bloc in the TypeScript carries a
## `target(s)` function, and a GDScript Dictionary cannot hold one, so they
## were dropped.
##
## Without them driftBlocs has nothing to drift toward, and the whole chain
## from the economy to your approval rating is cut: unemployment rises and
## nobody minds. They are restored here as a match on the bloc key, which is
## the same eight expressions, in the same order, reading the same fields.
##
## Approval in this game is not a number you nudge. It is the weighted sum of
## eight groups, each of which wants something specific and different, and none
## of which can be satisfied at once — that is the whole design, and it lives
## in the arithmetic below.

## Added to every bloc's target. Without it the coalition settles a few points
## under water on an ordinary month, which reads as a country that dislikes you
## for no reason.
const CALIBRATION := 4.5


static func clamp100(v: float) -> float:
	return clampf(v, 0.0, 100.0)


## What `key` would sit at, given the country as it is now.
static func target_for(key: String, s: Dictionary) -> float:
	var n: Dictionary = s["nation"]
	var sec: Dictionary = n["sectors"]
	var growth: float = float(n["growth"])
	var unemployment: float = float(n["unemployment"])
	var inflation: float = float(n["inflation"])
	var tax: float = float(n["taxRate"])
	var unrest: float = float(n["unrest"])
	var security: float = float(n["security"])
	var debt: float = float(n["debtToGdp"])

	match key:
		"labour":
			return clamp100(
				52.0
				- (unemployment - 4.6) * 7.0
				- maxf(0.0, inflation - 2.5) * 4.0
				+ (float(sec["welfare"]) - 50.0) * 0.3
				+ (growth - 2.0) * 3.0)
		"business":
			return clamp100(
				50.0
				+ (growth - 2.0) * 9.0
				- (tax - 17.5) * 3.5
				- maxf(0.0, debt - 105.0) * 0.28
				- maxf(0.0, unrest - 45.0) * 0.35
				+ (float(sec["infrastructure"]) - 50.0) * 0.12)
		"seniors":
			return clamp100(
				52.0
				+ (float(sec["healthcare"]) - 50.0) * 0.4
				- maxf(0.0, inflation - 2.5) * 6.0
				- maxf(0.0, unrest - 40.0) * 0.3
				+ (security - 50.0) * 0.12)
		"young":
			return clamp100(
				48.0
				+ (float(sec["education"]) - 50.0) * 0.34
				+ (float(sec["environment"]) - 50.0) * 0.4
				- (unemployment - 4.6) * 4.0
				+ (float(sec["science"]) - 50.0) * 0.12)
		"rural":
			return clamp100(
				50.0
				+ (security - 50.0) * 0.3
				+ (float(sec["veterans"]) - 50.0) * 0.18
				- (tax - 17.5) * 2.0
				- (float(sec["environment"]) - 50.0) * 0.12
				+ (float(sec["infrastructure"]) - 50.0) * 0.14)
		"suburban":
			return clamp100(
				50.0
				+ (float(sec["education"]) - 50.0) * 0.22
				+ (float(sec["justice"]) - 50.0) * 0.22
				- maxf(0.0, unrest - 38.0) * 0.4
				- float(s["politics"]["scandal"]) * 0.28
				+ (growth - 2.0) * 3.5)
		"activists":
			return clamp100(
				46.0
				+ (float(sec["environment"]) - 50.0) * 0.5
				+ (float(sec["healthcare"]) - 50.0) * 0.3
				+ (tax - 17.5) * 2.5
				- (float(sec["defense"]) - 50.0) * 0.2)
		"traditionalists":
			return clamp100(
				46.0
				+ (float(sec["defense"]) - 50.0) * 0.42
				+ (float(sec["justice"]) - 50.0) * 0.26
				- (tax - 17.5) * 3.5
				- maxf(0.0, debt - 105.0) * 0.2)
	push_error("blocs: no target for \"%s\"" % key)
	return 50.0


## Approval is the coalition, weighted by size.
static func coalition_approval(s: Dictionary) -> float:
	var total := 0.0
	for def in CoreData.BLOCS:
		total += float(s["blocs"].get(def["key"], 50.0)) * float(def["weight"])
	return total


## Moves every bloc toward what it wants. Blocs that lean against your party
## never quite come home, and blocs that lean toward it forgive more.
static func drift_blocs(s: Dictionary) -> void:
	for def in CoreData.BLOCS:
		var key: String = def["key"]
		var lean: float = float(def["lean"][s["party"]])
		var target := clamp100(target_for(key, s) + lean + CALIBRATION)
		var current: float = float(s["blocs"].get(key, 50.0))
		s["blocs"][key] = clamp100(current + (target - current) * float(def["volatility"]))


## Who has left you, for the coalition board and the endings.
##
## Ties keep the order CoreData.BLOCS declares them in. JavaScript's sort has
## been required to be stable since ES2019 and the TypeScript relies on it;
## sort_custom is documented as unstable, so the declaration index is the
## tiebreak. Godot 4.3 happens to agree without it -- eight elements go
## through an insertion sort -- so this is defensive, not a fix. Two blocs
## sitting on exactly 50 is not a hypothetical: it is where a bloc that has
## never been touched sits.
static func weakest_blocs(s: Dictionary, count: int = 3) -> Array:
	var rows: Array = []
	for i in CoreData.BLOCS.size():
		rows.append({"i": i, "def": CoreData.BLOCS[i],
			"v": float(s["blocs"].get(CoreData.BLOCS[i]["key"], 50.0))})
	rows.sort_custom(func(a, b):
		if a["v"] == b["v"]:
			return int(a["i"]) < int(b["i"])
		return float(a["v"]) < float(b["v"]))
	var out: Array = []
	for r in rows.slice(0, count):
		out.append(r["def"])
	return out
