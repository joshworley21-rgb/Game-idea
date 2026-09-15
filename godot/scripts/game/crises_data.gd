class_name CrisesData
extends RefCounted
## The parts of the crisis table that are code rather than content.
##
## Ported from src/game/crises.ts. The 34 crises themselves are generated into
## CrisesTable by scripts/export-crises.mjs -- 1,900 lines of titles, choices,
## effect maps and result text, which would be a thousand chances to mistype a
## number if it were transcribed by hand. What could not be generated is here:
##
##   pressure_for  -- how likely each crisis is right now. Zero means it
##                    cannot fire at all, which is how the gated ones stay out
##                    of the pool until something unlocks them.
##   brief_for     -- the eight residence crises whose opening paragraph names
##                    your spouse, or the child the crisis is actually about.
##
## Both are a match on the crisis id, the same shape BlocsData uses for the
## bloc targets, and for the same reason: a GDScript Dictionary cannot hold a
## function.


## Pressure from a shortfall. Zero once the sector is at or above the floor.
static func _lack(value: float, floor_v: float, k: float = 0.08) -> float:
	return maxf(0.0, (floor_v - value) * k)


static func _spouse_name(s: Dictionary) -> String:
	var spouse := People.spouse_of(s)
	return str(spouse["name"]) if not spouse.is_empty() else "your spouse"


## The child a residence crisis is about.
##
## A crisis names the child it can plausibly be about -- a call from a school
## is not about the 23-year-old -- and falls back to whoever is carrying the
## most. `ids` restricts to children under one of those strains.
static func _troubled_child(s: Dictionary, ids: Array = [], min_age: int = 0,
		max_age: int = 200) -> Dictionary:
	var kids := People.children_of(s)
	if kids.is_empty():
		return {}
	# Worst first: how much they are carrying, less how close you still are.
	var best := func(pool: Array) -> Dictionary:
		var out := {}
		var out_score := -INF
		for m in pool:
			var st: Dictionary = m.get("strain", {})
			var score: float = st.get("severity", 0.0) - float(m["bond"])
			if score > out_score:
				out_score = score
				out = m
		return out
	var matching: Array = []
	var by_age: Array = []
	for m in kids:
		if int(m["age"]) < min_age or int(m["age"]) > max_age:
			continue
		by_age.append(m)
		var st: Dictionary = m.get("strain", {})
		if ids.is_empty() or (not st.is_empty() and ids.has(st["id"])):
			matching.append(m)
	if not matching.is_empty():
		return best.call(matching)
	# Age still has to hold even when nobody carries the right strain.
	if not by_age.is_empty():
		return best.call(by_age)
	return best.call(kids)


static func _child_name(s: Dictionary, ids: Array = [], min_age: int = 0,
		max_age: int = 200) -> String:
	var kid := _troubled_child(s, ids, min_age, max_age)
	return str(kid["name"]) if not kid.is_empty() else "your youngest"


## How badly one strain is running, for pressure. Zero when nobody has one.
static func _strain_on(s: Dictionary, kind: String, ids: Array = []) -> float:
	var worst := 0.0
	for m in (s.get("family", []) as Array):
		if m.get("kind", "") != kind:
			continue
		var st: Dictionary = m.get("strain", {})
		if st.is_empty():
			continue
		if not ids.is_empty() and not ids.has(st["id"]):
			continue
		worst = maxf(worst, float(st["severity"]))
	return worst * 0.022


static func _any_child_aged(s: Dictionary, min_age: int, max_age: int) -> bool:
	for k in People.children_of(s):
		if int(k["age"]) >= min_age and int(k["age"]) <= max_age:
			return true
	return false


static func _bill_passed(s: Dictionary, bill_id: String) -> bool:
	for b in (s["bills"] as Array):
		if b.get("id", "") == bill_id and b.get("status", "") == "passed":
			return true
	return false


## The crisis's own pressure expression, before heat and feeds.
##
## This is `c.pressure(s)` and nothing else — crisis_pressure is what turns it
## into the number the roll actually uses. The ten gated crises return zero
## here because their expression is literally `() => 0`; what makes them
## reachable is the gated bonus in crisis_pressure, not this.
static func pressure_for(id: String, s: Dictionary) -> float:
	var n: Dictionary = s["nation"]
	var sec: Dictionary = n["sectors"]
	var pol: Dictionary = s["politics"]
	var per: Dictionary = s["personal"]

	match id:
		"hurricane":
			return (1.2
				+ _lack(float(sec["environment"]), 55.0, 0.05)
				+ _lack(float(sec["infrastructure"]), 55.0, 0.05))
		"bank-run":
			return ((2.2 if float(n["growth"]) < 1.0 else 0.5)
				+ maxf(0.0, float(n["inflation"]) - 4.0) * 0.4)
		"standoff":
			return (0.8
				+ _lack(float(n["security"]), 60.0, 0.06)
				+ _lack(float(n["standing"]), 55.0, 0.04))
		"cyberattack":
			return (0.7
				+ _lack(float(sec["infrastructure"]), 55.0, 0.06)
				+ _lack(float(sec["science"]), 55.0, 0.04))
		"opioid":
			return _lack(float(sec["healthcare"]), 60.0, 0.1) + 0.3
		"strike":
			return (0.6
				+ maxf(0.0, float(n["inflation"]) - 3.0) * 0.4
				+ _lack(float(sec["welfare"]), 50.0, 0.05))
		"outbreak":
			return ((0.3 if _bill_passed(s, "pandemic") else 1.1)
				+ _lack(float(sec["healthcare"]), 55.0, 0.05))
		"leak":
			return (0.3
				+ float(pol["scandal"]) * 0.05
				+ maxf(0.0, 45.0 - float(pol["media"])) * 0.03)
		"health-scare":
			return (_lack(float(per["health"]), 65.0, 0.11)
				+ maxf(0.0, float(per["stress"]) - 70.0) * 0.05)
		"marriage":
			return _lack(float(per["marriage"]), 55.0, 0.11) + _strain_on(s, "spouse")
		"child":
			if not _any_child_aged(s, 17, 200):
				return 0.0
			return _lack(float(per["family"]), 55.0, 0.1) + _strain_on(s, "child")
		"spouse-career":
			return (_strain_on(s, "spouse", ["spouse-work", "spouse-erasure"])
				+ _lack(float(per["marriage"]), 62.0, 0.05))
		"child-school-call":
			if not _any_child_aged(s, 0, 18):
				return 0.0
			return _strain_on(s, "child", ["child-school", "child-bullied"])
		"child-name-trading":
			if not _any_child_aged(s, 19, 200):
				return 0.0
			return (_strain_on(s, "child", ["child-money"])
				+ maxf(0.0, float(pol["scandal"]) - 25.0) * 0.02)
		"child-not-well":
			return _strain_on(s, "child", ["child-health", "child-drinking"])
		"anniversary":
			return 0.35 + _lack(float(per["marriage"]), 70.0, 0.04)
		"exhaustion":
			return (maxf(0.0, float(per["sleepDebt"]) - 55.0) * 0.045
				+ _lack(float(per["health"]), 50.0, 0.05))
		"border-surge":
			return (0.6
				+ _lack(float(n["security"]), 60.0, 0.05)
				+ maxf(0.0, float(n["unrest"]) - 40.0) * 0.03)
		"inflation-spike":
			return maxf(0.0, float(n["inflation"]) - 3.5) * 1.2
		"ally-attacked":
			return (0.4
				+ _lack(float(n["standing"]), 50.0, 0.05)
				+ _lack(float(n["security"]), 55.0, 0.05))
		"wildfire":
			return 0.5 + _lack(float(sec["environment"]), 60.0, 0.09)
		"cabinet-resignation":
			return (0.3
				+ maxf(0.0, 40.0 - float(pol["party"])) * 0.05
				+ maxf(0.0, float(n["debtToGdp"]) - 115.0) * 0.03)
		"shooting":
			return (0.7
				+ _lack(float(sec["justice"]), 55.0, 0.05)
				+ maxf(0.0, float(n["unrest"]) - 45.0) * 0.03)
		"primary-threat":
			return ((0.6 if int(s["month"]) > 24 else 0.1)
				+ maxf(0.0, 55.0 - float(pol["party"])) * 0.06)
		"court-vacancy":
			return 0.5
		# Consequences, not events: their expression is zero, and they reach
		# the player through crisis_pressure's unlock and feed paths instead.
		"war-casualties", "anti-war-protests", "coalition-strain", \
		"unemployment-spiral", "general-strike", "cover-up-unravels", \
		"inquiry", "impeachment-push", "court-defeat":
			return 0.0
	push_error("crises: no pressure for \"%s\"" % id)
	return 0.0


## The opening paragraph, for the eight crises whose brief names somebody.
## Returns "" for a crisis that carries a static brief in CrisesTable.
static func brief_for(id: String, s: Dictionary) -> String:
	match id:
		"marriage":
			var spouse := People.spouse_of(s)
			var months: int = int(spouse["since"]) if not spouse.is_empty() else 3
			var carrying := "all of this"
			if not spouse.is_empty():
				var st: Dictionary = spouse.get("strain", {})
				if not st.is_empty():
					carrying = str(st["label"])
			return ("%s has asked for a conversation with the door closed and no staff. They have been asking for six weeks. Tonight they stopped asking.\n\nIt has been %d %s since you gave them an evening, and they have been carrying %s on their own."
				% [_spouse_name(s), months, "month" if months == 1 else "months", carrying])
		"child":
			var kid := _troubled_child(s, [], 17, 200)
			var name := str(kid["name"]) if not kid.is_empty() else "your youngest"
			var age_clause := ("%s is %d" % [name, int(kid["age"])]) if not kid.is_empty() else "She is nineteen"
			return ("%s was photographed leaving a club at 3am and the picture is being sold. %s, and has not picked up your calls since Tuesday."
				% [name, age_clause])
		"spouse-career":
			var spouse := People.spouse_of(s)
			var doing := str(spouse["doing"]) if not spouse.is_empty() else "the work they left"
			return ("%s was offered it again this week — %s — and turned it down again, and you found out from someone else. They are not angry. That is what worries you."
				% [_spouse_name(s), doing])
		"child-school-call":
			var kid := _troubled_child(s, [], 0, 18)
			var name := str(kid["name"]) if not kid.is_empty() else "your youngest"
			var aside := ""
			if not kid.is_empty():
				var st: Dictionary = kid.get("strain", {})
				if not st.is_empty():
					aside = " %s has been %s since the spring." % [name, st["label"]]
			return ("The head of %s's school has called the residence three times. The third time they asked whether the President was aware. Nobody had told you.%s"
				% [name, aside])
		"child-name-trading":
			return ("A firm has been paying %s very well for work that is mostly a phone number and a surname. Nothing about it is illegal. A reporter has the invoices anyway."
				% _child_name(s, ["child-money"], 19, 200))
		"child-not-well":
			return ("There is a specialist appointment on %s's calendar that nobody has briefed you on, because you never asked. It is on Thursday. So is the vote."
				% _child_name(s, ["child-health", "child-drinking"]))
		"anniversary":
			return ("It is your anniversary on Thursday. %s has not mentioned it, which is how you know it matters. The Chief of Staff has put three things in that evening."
				% _spouse_name(s))
		"exhaustion":
			var condition: Variant = s["personal"].get("condition", null)
			var clause := ""
			if condition != null and str(condition) != "":
				clause = ", on top of %s" % str(condition)
			return ("Your physician has stopped suggesting and started documenting. The memo says you are running a sleep debt no schedule can absorb%s, and it is now in your file."
				% clause)
	return ""


## The brief the player actually reads, static or generated.
static func brief_of(crisis: Dictionary, s: Dictionary) -> String:
	if crisis.has("brief"):
		return str(crisis["brief"])
	return brief_for(str(crisis["id"]), s)


static func by_id(id: String) -> Dictionary:
	for c in CrisesTable.CRISES:
		if c["id"] == id:
			return c
	return {}


## How likely `c` is right now, all in.
##
## Three things sit on top of the crisis's own expression, and leaving any of
## them out changes which crises a term can contain at all:
##
##   feed  -- a running situation can name the crises it makes more likely.
##           A war feeds war-casualties, anti-war-protests and
##           coalition-strain; a scandal feeds the leak, the resignation and
##           the impeachment push.
##
##   the gate -- a `gated` crisis is a consequence, not an event. Its own
##           expression is zero, so it stays out of the pool until something
##           unlocks it or a situation feeds it — and once one does, it gets
##           a flat 0.85 to fire on, because at that point it is not waiting
##           on the country drifting anywhere.
##
##   heat  -- a domain that has been in the news stays in the news. Each of
##           the crisis's tags contributes its heat over 70, and the total
##           multiplies the base rather than adding to it, so trouble
##           clusters instead of arriving evenly.
static func crisis_pressure(s: Dictionary, c: Dictionary) -> float:
	var feed := 0.0
	for t in (s["threads"] as Array):
		var feeds: Array = t.get("feeds", [])
		if feeds.has(c["id"]):
			feed += float(t["intensity"]) / 45.0

	var gated: bool = c.get("gated", false)
	if gated and feed == 0.0 and not (s["unlocked"] as Array).has(c["id"]):
		return 0.0

	var heat := 0.0
	for tag in (c["tags"] as Array):
		heat += maxf(0.0, float(s["heat"].get(tag, 0.0))) / 70.0

	var base := pressure_for(str(c["id"]), s) + (0.85 if gated else 0.0)
	return maxf(0.0, base * (1.0 + heat) + feed)


## Crises that could fire this month: off cooldown, and under real pressure.
static func eligible_crises(s: Dictionary) -> Array:
	var out: Array = []
	for c in CrisesTable.CRISES:
		var history: Dictionary = s["crisisHistory"]
		var cid: String = c["id"]
		if history.has(cid) and int(s["month"]) - int(history[cid]) < float(c["cooldown"]):
			continue
		if crisis_pressure(s, c) > 0.0:
			out.append(c)
	return out


## Applies what a choice set in motion: situations, unlocks, and heat.
static func apply_consequence(s: Dictionary, consequence: Dictionary) -> void:
	if consequence.is_empty():
		return

	if consequence.has("startsThread"):
		var def: Dictionary = consequence["startsThread"]
		var existing := {}
		for t in (s["threads"] as Array):
			if t["id"] == def["id"]:
				existing = t
				break
		# Starting a situation that is already running deepens it instead.
		if not existing.is_empty():
			existing["intensity"] = minf(100.0,
				float(existing["intensity"]) + float(def["intensity"]) * 0.5)
		else:
			var thread := def.duplicate(true)
			thread["age"] = 0
			s["threads"].append(thread)

	if consequence.has("escalates"):
		var esc: Dictionary = consequence["escalates"]
		for t in (s["threads"] as Array):
			if t["id"] == esc["id"]:
				t["intensity"] = minf(100.0, float(t["intensity"]) + float(esc["by"]))
				break

	if consequence.has("eases"):
		var ease: Dictionary = consequence["eases"]
		for t in (s["threads"] as Array):
			if t["id"] == ease["id"]:
				t["intensity"] = maxf(0.0, float(t["intensity"]) - float(ease["by"]))
				break

	for id in (consequence.get("unlocks", []) as Array):
		if not (s["unlocked"] as Array).has(id):
			s["unlocked"].append(id)

	var heats: Dictionary = consequence.get("heats", {})
	for tag in heats:
		s["heat"][tag] = clampf(float(s["heat"].get(tag, 0.0)) + float(heats[tag]), 0.0, 100.0)
