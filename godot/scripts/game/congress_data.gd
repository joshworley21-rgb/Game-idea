class_name CongressData
extends RefCounted
## Congress factions and whip counts.

const FACTIONS := [
	{"key": "progressives", "name": "The Progressive Caucus", "short": "Progressives", "axis": -1.0, "party": "blue", "backing": "activists", "fiscal": false, "blurb": "Small, loud, and willing to sink your bill to make a point."},
	{"key": "liberals", "name": "The Liberal Bloc", "short": "Liberals", "axis": -0.5, "party": "blue", "backing": "labour", "fiscal": false, "blurb": "The mainstream of the blue party. Reliable until they are not."},
	{"key": "moderates", "name": "The Moderates", "short": "Moderates", "axis": 0.0, "party": null, "backing": "suburban", "fiscal": true, "blurb": "Cross-party, cautious, and the reason anything passes at all."},
	{"key": "conservatives", "name": "The Conservative Bloc", "short": "Conservatives", "axis": 0.5, "party": "red", "backing": "business", "fiscal": true, "blurb": "Business-minded, allergic to deficits, open to a deal on the right terms."},
	{"key": "hardliners", "name": "The Hardliners", "short": "Hardliners", "axis": 1.0, "party": "red", "backing": "traditionalists", "fiscal": true, "blurb": "They did not come here to compromise and they will tell you so."},
]


static func bill_axis(ideology: String) -> float:
	if ideology == "progressive":
		return -1.0
	if ideology == "conservative":
		return 1.0
	return 0.0


static func faction_score(s: Dictionary, bill: Dictionary, push: float, def: Dictionary) -> float:
	var distance: float = absf(bill_axis(bill["ideology"]) - def["axis"])
	var mood: float = (s["factions"].get(def["key"], {})).get("mood", 50.0)
	var alignment: int
	if def["party"] == null:
		alignment = 0
	elif def["party"] == s["party"]:
		alignment = 1
	else:
		alignment = -1
	var debt_sensitivity: float = 1.6 if s["nation"]["debtToGdp"] > 110.0 else 1.0
	var cost: float = 0.0
	if bill["cost"] > 0:
		cost = (float(bill["cost"]) / 85.0) * (1.9 if def["fiscal"] else 0.5) * debt_sensitivity
	var aisle: float
	if alignment == 1:
		aisle = 7.0
	elif alignment == 0:
		aisle = 2.0 + (22.0 - float(bill["partisanship"])) * 0.25
	else:
		aisle = -3.0 + (22.0 - float(bill["partisanship"])) * 0.4
	var home: float = 9.0 * maxf(0.0, 1.0 - distance)
	return 48.0 + (mood - 50.0) * 0.42 + home - pow(distance, 1.5) * 11.0 - bill["partisanship"] * 0.2 * distance + push * 0.42 + aisle - cost


static func whip_count(s: Dictionary, bill: Dictionary, push: float) -> Array:
	var out: Array = []
	for def in FACTIONS:
		var score := faction_score(s, bill, push, def)
		var seats: float = (s["factions"].get(def["key"], {})).get("seats", 20.0)
		var odds: float = clampf((score - 50.0) / 24.0 + 0.5, 0.0, 1.0)
		out.append({"def": def, "seats": seats, "odds": odds, "mood": (s["factions"].get(def["key"], {})).get("mood", 50.0)})
	return out


static func expected_votes(votes: Array) -> float:
	var sum: float = 0.0
	for v in votes:
		sum += v["seats"] * v["odds"]
	return sum


static func drift_factions(s: Dictionary, patronage: Dictionary = {}) -> void:
	for def in FACTIONS:
		if not s["factions"].has(def["key"]):
			continue
		var faction: Dictionary = s["factions"][def["key"]]
		var backing: float = s["blocs"].get(def["backing"], 50.0)
		var alignment: int
		if def["party"] == null:
			alignment = 0
		elif def["party"] == s["party"]:
			alignment = 1
		else:
			alignment = -1
		var alignment_term: float
		if alignment == 1:
			alignment_term = s["politics"]["party"] * 0.22
		elif alignment == -1:
			alignment_term = (100.0 - s["politics"]["party"]) * 0.1
		else:
			alignment_term = 8.0
		var target: float = 30.0 + backing * 0.42 + alignment_term + (s["politics"]["approval"] - 50.0) * (0.3 if alignment == 0 else 0.16) + patronage.get(def["key"], 0.0) * 2.4 + alignment * 6.0
		faction["mood"] = clampf(faction["mood"] + (target - faction["mood"]) * 0.2, 0.0, 100.0)


static func friendly_seats(s: Dictionary) -> float:
	var sum: float = 0.0
	for def in FACTIONS:
		if s["factions"].has(def["key"]):
			var faction: Dictionary = s["factions"][def["key"]]
			if faction.get("mood", 50.0) > 52.0:
				sum += faction.get("seats", 0.0)
	return sum


static func apply_midterm_swing(s: Dictionary, swing: float) -> void:
	var mine: Array = []
	var theirs: Array = []
	for f in FACTIONS:
		if f["party"] == s["party"]:
			mine.append(f)
		elif f["party"] != null:
			theirs.append(f)
	var move: float = clampf(swing, -14.0, 14.0) / mine.size()
	for def in mine:
		var faction: Dictionary = s["factions"][def["key"]]
		faction["seats"] = maxf(4.0, faction["seats"] + move)
	for def in theirs:
		var faction: Dictionary = s["factions"][def["key"]]
		faction["seats"] = maxf(4.0, faction["seats"] - (move * mine.size()) / theirs.size())
	var total: float = 0.0
	for f in FACTIONS:
		total += s["factions"][f["key"]]["seats"]
	for f in FACTIONS:
		s["factions"][f["key"]]["seats"] = (s["factions"][f["key"]]["seats"] / total) * 100.0
