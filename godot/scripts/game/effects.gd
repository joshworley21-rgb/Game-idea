class_name Effects
extends RefCounted
## The flat-bag path system: "politics.approval" etc., applied to the state Dictionary.

const DEFAULT_MIN := 0.0
const DEFAULT_MAX := 100.0

const BOUNDS := {
	"nation.growth": [-14.0, 14.0],
	"nation.unemployment": [1.2, 32.0],
	"nation.inflation": [-4.0, 40.0],
	"nation.debtToGdp": [0.0, 400.0],
	"nation.gdp": [1000.0, 10000000.0],
	"nation.taxRate": [6.0, 45.0],
	"personal.age": [30.0, 120.0],
}

const SOFT_CAPPED := ["personal.health", "personal.marriage", "personal.family"]

const LABELS := {
	"nation.growth": "Growth",
	"nation.unemployment": "Unemployment",
	"nation.inflation": "Inflation",
	"nation.debtToGdp": "Debt/GDP",
	"nation.taxRate": "Tax rate",
	"nation.unrest": "Unrest",
	"nation.standing": "Global standing",
	"nation.security": "Security",
	"politics.approval": "Approval",
	"politics.capital": "Political capital",
	"politics.house": "House support",
	"politics.senate": "Senate support",
	"politics.media": "Press relations",
	"politics.party": "Party backing",
	"politics.scandal": "Scandal",
	"personal.health": "Health",
	"personal.stress": "Stress",
	"personal.marriage": "Marriage",
	"personal.family": "Family",
	"personal.integrity": "Integrity",
	"personal.sleepDebt": "Sleep debt",
	"personal.fitness": "Fitness",
}

const INVERTED := [
	"nation.unemployment", "nation.inflation", "nation.debtToGdp", "nation.unrest",
	"personal.stress", "personal.sleepDebt", "politics.scandal",
]

const BLOC_LABELS := {
	"labour": "Labour", "business": "Business", "seniors": "Seniors", "young": "Young voters",
	"rural": "Rural", "suburban": "Suburban", "activists": "The left", "traditionalists": "The right",
}


static func clamp_path(path: String, value: float) -> float:
	if BOUNDS.has(path):
		var b: Array = BOUNDS[path]
		return clampf(value, b[0], b[1])
	return clampf(value, DEFAULT_MIN, DEFAULT_MAX)


static func read_path(s: Dictionary, path: String) -> float:
	var node: Variant = s
	for part in path.split("."):
		if node is Dictionary and (node as Dictionary).has(part):
			node = (node as Dictionary)[part]
		else:
			return 0.0
	return float(node) if (node is float or node is int) else 0.0


static func soften_gain(path: String, current: float, delta: float) -> float:
	if delta > 0.0 and path in SOFT_CAPPED:
		return delta * clampf((100.0 - current) / 35.0, 0.12, 1.0)
	if delta < 0.0 and path == "personal.stress":
		return delta * clampf(current / 45.0, 0.15, 1.0)
	return delta


static func _spouse_of(s: Dictionary):
	for m in (s.get("family", []) as Array):
		if m is Dictionary and m.get("kind", "") == "spouse":
			return m
	return {}


static func _children_of(s: Dictionary) -> Array:
	var out: Array = []
	for m in (s.get("family", []) as Array):
		if m is Dictionary and m.get("kind", "") == "child":
			out.append(m)
	return out


static func apply_to_people(s: Dictionary, path: String, delta: float) -> bool:
	if path == "personal.marriage":
		var spouse: Dictionary = _spouse_of(s)
		if spouse.is_empty():
			return false
		var bond: float = spouse.get("bond", 0.0)
		var next_bond: float = clamp_path(path, bond + soften_gain(path, bond, delta))
		spouse["bond"] = next_bond
		if delta > 0.0:
			spouse["since"] = maxi(0, int(spouse.get("since", 0)) - (2 if delta > 8.0 else 1))
		s["personal"]["marriage"] = next_bond
		return true
	if path == "personal.family":
		var kids: Array = _children_of(s)
		if kids.is_empty():
			return false
		var total := 0.0
		for kid in kids:
			var bond: float = kid.get("bond", 0.0)
			var next_bond: float = clamp_path(path, bond + soften_gain(path, bond, delta))
			kid["bond"] = next_bond
			if delta > 0.0:
				kid["since"] = maxi(0, int(kid.get("since", 0)) - (2 if delta > 8.0 else 1))
			total += next_bond
		s["personal"]["family"] = total / float(kids.size())
		return true
	return false


static func add_path(s: Dictionary, path: String, delta: float) -> void:
	if apply_to_people(s, path, delta):
		return
	var parts: PackedStringArray = path.split(".")
	var last: String = parts[parts.size() - 1]
	var node: Variant = s
	for i in range(parts.size() - 1):
		var p: String = parts[i]
		if node is Dictionary:
			node = (node as Dictionary)[p]
	var current := 0.0
	if node is Dictionary and (node as Dictionary).has(last):
		var raw = (node as Dictionary)[last]
		if raw is float or raw is int:
			current = float(raw)
	(node as Dictionary)[last] = clamp_path(path, current + soften_gain(path, current, delta))


static func apply_effects(s: Dictionary, effects: Dictionary, scale: float = 1.0) -> void:
	if effects.is_empty():
		return
	for path in effects.keys():
		var delta: Variant = effects[path]
		if delta is float or delta is int:
			add_path(s, str(path), float(delta) * scale)


static func effect_label(path: String) -> String:
	if path.begins_with("nation.sectors."):
		var key: String = path.split(".")[2]
		return key.capitalize()
	if path.begins_with("blocs."):
		var key: String = path.split(".")[1]
		return BLOC_LABELS.get(key, path)
	return LABELS.get(path, path)


static func is_good(path: String, delta: float) -> bool:
	return delta < 0.0 if path in INVERTED else delta > 0.0


static func describe_effects(effects: Dictionary) -> Array:
	var out: Array = []
	if effects.is_empty():
		return out
	for path in effects.keys():
		var v: Variant = effects[path]
		if not (v is float or v is int) or v == 0:
			continue
		var delta: float = float(v)
		var unit: String = "bn" if path == "nation.gdp" else ""
		var sign: String = "+" if delta > 0.0 else ""
		var rounded: String = ("%.1f" % delta) if absf(delta) < 1.0 else str(int(round(delta)))
		out.append({"text": "%s %s%s%s" % [effect_label(path), sign, rounded, unit], "good": is_good(path, delta)})
	return out
