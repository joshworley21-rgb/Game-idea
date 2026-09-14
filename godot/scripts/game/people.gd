class_name People
extends RefCounted
## The people: cabinet, family, and their temperaments. All static, state is a Dictionary.

static func temperament_of(person: Dictionary) -> Dictionary:
	var key: String = person.get("temperament", "technocrat")
	if CoreData.TEMPERAMENTS.has(key):
		return CoreData.TEMPERAMENTS[key]
	return CoreData.TEMPERAMENTS["technocrat"]


static func clamp01(v: float) -> float:
	return clampf(v, 0.0, 100.0)


static func _draw_name(rng: Rng, pool: Array, taken: Dictionary) -> String:
	var name: String = str(rng.pick(pool))
	for i in range(30):
		if not taken.has(name):
			break
		name = str(rng.pick(pool))
	taken[name] = true
	return name


static func make_secretary(rng: Rng, office: Dictionary, taken: Dictionary, temperament: String = "technocrat") -> Dictionary:
	var faction: String = rng.pick(CoreData.FACTIONS)["key"]
	var first: String = _draw_name(rng, CoreData.FIRST_NAMES, taken)
	var last: String = _draw_name(rng, CoreData.LAST_NAMES, taken)
	var full := first + " " + last
	taken[full] = true
	var skew := 8.0 if temperament == "rival" else (-10.0 if temperament == "friend" else 0.0)
	var warmth := 8.0 if temperament == "friend" else (-14.0 if temperament == "rival" else 0.0)
	return {
		"office": office["key"], "title": office["title"], "name": full,
		"competence": clamp01(round(rng.range_float(38.0, 88.0) + skew)),
		"loyalty": clamp01(round(rng.range_float(52.0, 92.0) + warmth)),
		"faction": faction, "temperament": temperament, "months": 0,
	}


static func make_chief() -> Dictionary:
	return {"office": "chief", "title": "Chief of Staff", "name": CoreData.CHIEF_NAME, "competence": 91.0, "loyalty": 88.0, "faction": "moderates", "temperament": "institutionalist", "months": 0}


static func deal_temperaments(rng: Rng, seats: int) -> Array:
	var pool: Array = CoreData.TEMPERAMENTS.keys()
	var dealt: Array = []
	for i in range(seats):
		if pool.is_empty():
			pool = CoreData.TEMPERAMENTS.keys()
		dealt.append(pool.pop_at(rng.range_int(0, pool.size() - 1)))
	return dealt


static func create_cabinet(rng: Rng) -> Array:
	var taken := {CoreData.CHIEF_NAME: true, "Ruth": true, "Ellery": true}
	var hands := deal_temperaments(rng, 5)
	var out: Array = []
	var seat := 0
	for office in CoreData.OFFICES:
		if office["key"] == "chief":
			out.append(make_chief())
		else:
			out.append(make_secretary(rng, office, taken, hands[seat]))
			seat += 1
	return out


static func replace_secretary(rng: Rng, cabinet: Array, office_key: String) -> Dictionary:
	var office: Dictionary = CoreData.OFFICES[0]
	for o in CoreData.OFFICES:
		if o["key"] == office_key:
			office = o
			break
	if office_key == "chief":
		for c in cabinet:
			if c["office"] == "chief":
				return c
	var taken := {}
	for c in cabinet:
		taken[c["name"]] = true
		var parts: Array = str(c["name"]).split(" ")
		for p in parts:
			taken[p] = true
	var fresh := make_secretary(rng, office, taken, rng.pick(CoreData.TEMPERAMENTS.keys()))
	for i in range(cabinet.size()):
		if cabinet[i]["office"] == office_key:
			cabinet[i] = fresh
			break
	return fresh


static func cabinet_strength(s: Dictionary) -> float:
	var arr: Array = s.get("cabinet", [])
	if arr.is_empty():
		return 55.0
	var total := 0.0
	for c in arr:
		total += c.get("competence", 55.0)
	return total / float(arr.size())


static func cabinet_loyalty(s: Dictionary) -> float:
	var arr: Array = s.get("cabinet", [])
	if arr.is_empty():
		return 65.0
	var total := 0.0
	for c in arr:
		total += c.get("loyalty", 60.0)
	return total / float(arr.size())


static func domain_competence(s: Dictionary, domain: String) -> float:
	var person := {}
	for c in (s.get("cabinet", []) as Array):
		for o in CoreData.OFFICES:
			if o["domain"] == domain and c["office"] == o["key"]:
				person = c
	if person.is_empty():
		return 55.0
	return clamp01(person.get("competence", 55.0) + temperament_of(person).get("crisisEdge", 0.0))


const TAG_DOMAIN := {"economy": "economy", "labour": "economy", "foreign": "foreign", "war": "security", "security": "security", "justice": "justice", "scandal": "justice", "health": "health", "politics": "politics"}


static func crisis_competence(s: Dictionary, tags: Array = []) -> float:
	var owners: Array = []
	for tag in tags:
		if TAG_DOMAIN.has(tag):
			owners.append(domain_competence(s, TAG_DOMAIN[tag]))
	var best := 55.0
	if not owners.is_empty():
		best = owners.max()
	var chief := domain_competence(s, "politics")
	return best * 0.78 + chief * 0.22


static func cabinet_faction_support(s: Dictionary) -> Dictionary:
	var support := {}
	for person in (s.get("cabinet", []) as Array):
		support[person["faction"]] = support.get(person["faction"], 0.0) + person.get("competence", 55.0) / 40.0
	return support


static func secretary_with(s: Dictionary, key: String) -> Dictionary:
	for c in (s.get("cabinet", []) as Array):
		if c["office"] != "chief" and c.get("temperament", "") == key:
			return c
	return {}


static func loyalty_erosion(person: Dictionary, s: Dictionary) -> Dictionary:
	var t := temperament_of(person)
	var shelter := minf(0.45, maxf(0.0, float(s["politics"]["party"]) - 52.0) * 0.035)
	var fatigue: float = float(person.get("months", 0)) * 0.007
	var ambient: float = 0.5 * float(t["baseDrift"]) + maxf(0.0, 48.0 - float(s["politics"]["approval"])) * 0.075 * float(t["approvalWeight"]) + fatigue - shelter
	var acute: float = float(s["politics"]["scandal"]) * 0.04 * float(t["scandalWeight"]) + maxf(0.0, float(s["nation"]["unrest"]) - 55.0) * 0.025 * float(t["unrestWeight"])
	return {"ambient": maxf(0.0, ambient), "acute": maxf(0.0, acute)}


static func temperament_line(person: Dictionary) -> String:
	var t := temperament_of(person)
	var sour: bool = person.get("loyalty", 100.0) < 46.0
	var pool: Array = t["linesSour"] if sour else t["linesLoyal"]
	var h := 0
	var text: String = person["name"] + (":sour" if sour else ":loyal")
	for ch in text:
		h = (h * 31 + ch.unicode_at(0)) & 0xFFFFFFFF
	return pool[abs(h) % pool.size()]


static func tick_cabinet(s: Dictionary, rng: Rng) -> Array:
	var events: Array = []
	var cabinet: Array = s.get("cabinet", [])
	if cabinet.is_empty():
		return events
	for person in cabinet:
		person["months"] = int(person.get("months", 0)) + 1
		if person["office"] == "chief":
			continue
		var t := temperament_of(person)
		var er := loyalty_erosion(person, s)
		var loyalty: float = person.get("loyalty", 60.0)
		var drifted := maxf(t["floor"], loyalty - er["ambient"]) if loyalty > t["floor"] else loyalty
		person["loyalty"] = clamp01(drifted - er["acute"])
		if person["loyalty"] < 28.0 and rng.chance((28.0 - person["loyalty"]) / 190.0):
			events.append({"kind": "leaked" if rng.chance(t["leakChance"]) else "resigned", "person": person})
	return events


# ---------------------------------------------------------------- family

static func _life_for(age: int, rng: Rng) -> String:
	var band: Dictionary = CoreData.CHILD_LIVES[2]
	for b in CoreData.CHILD_LIVES:
		if age >= b["min"] and age <= b["max"]:
			band = b
			break
	return rng.pick(band["lines"])


static func create_family(rng: Rng, president_age: float) -> Array:
	var taken := {}
	var spouse := {
		"id": "spouse", "kind": "spouse", "name": _draw_name(rng, CoreData.SPOUSE_FIRST, taken),
		"age": int(president_age) + rng.range_int(-6, 4), "doing": rng.pick(CoreData.SPOUSE_LIVES),
		"bond": rng.range_int(68, 80), "since": 0,
	}
	var elder := rng.range_int(20, 29)
	var younger := rng.range_int(9, maxi(11, elder - 5))
	var out: Array = [spouse]
	for i in range(2):
		var age := elder if i == 0 else younger
		out.append({
			"id": "child" + str(i + 1), "kind": "child", "name": _draw_name(rng, CoreData.CHILD_FIRST, taken),
			"age": age, "doing": _life_for(age, rng), "bond": rng.range_int(62, 78), "since": 0,
		})
	return out


static func spouse_of(s: Dictionary) -> Dictionary:
	for m in (s.get("family", []) as Array):
		if m.get("kind", "") == "spouse":
			return m
	return {}


static func children_of(s: Dictionary) -> Array:
	var out: Array = []
	for m in (s.get("family", []) as Array):
		if m.get("kind", "") == "child":
			out.append(m)
	return out


static func member_by_id(s: Dictionary, id: String) -> Dictionary:
	for m in (s.get("family", []) as Array):
		if m.get("id", "") == id:
			return m
	return {}


static func family_strain(s: Dictionary) -> float:
	var total := 0.0
	for m in (s.get("family", []) as Array):
		var st: Dictionary = m.get("strain", {})
		if not st.is_empty():
			total += st.get("severity", 0.0)
	return total


static func most_neglected(s: Dictionary) -> Dictionary:
	var best := {}
	var best_score := -INF
	for m in (s.get("family", []) as Array):
		var st: Dictionary = m.get("strain", {})
		var score: float = float(m.get("since", 0)) + (float(st.get("severity", 0.0)) / 12.0)
		if score > best_score:
			best_score = score
			best = m
	return best


static func attend(member: Dictionary, weight: float) -> void:
	if member.is_empty():
		return
	member["since"] = 0
	member["bond"] = minf(100.0, member.get("bond", 0.0) + weight)
	var st: Dictionary = member.get("strain", {})
	if not st.is_empty():
		st["severity"] = st.get("severity", 0.0) - weight * 2.2
		if st["severity"] <= 0.0:
			member.erase("strain")


static func _new_strain(rng: Rng, member: Dictionary) -> Dictionary:
	var pool: Array = []
	for d in CoreData.STRAINS:
		if d["kind"] != member["kind"]:
			continue
		if d.has("ages"):
			var ages: Array = d["ages"]
			if member["age"] < ages[0] or member["age"] > ages[1]:
				continue
		pool.append(d)
	var def: Dictionary = rng.weighted(pool, func(d): return d["weight"])
	if def.is_empty():
		return {}
	return {"id": def["id"], "label": def["label"], "detail": def["detail"], "severity": rng.range_float(18.0, 30.0), "months": 0}


static func drift_family(s: Dictionary, rng: Rng, notes: Array) -> void:
	var family: Array = s.get("family", [])
	if family.is_empty():
		return
	for member in family:
		member["since"] = int(member.get("since", 0)) + 1
		var st: Dictionary = member.get("strain", {})
		if st.is_empty():
			var exposure := 0.012 + maxf(0.0, float(member.get("since", 0)) - 2.0) * 0.016 + maxf(0.0, s["personal"]["stress"] - 60.0) * 0.0016 + maxf(0.0, 60.0 - float(member.get("bond", 0))) * 0.0018
			if rng.chance(minf(0.3, exposure)):
				st = _new_strain(rng, member)
				if not st.is_empty():
					member["strain"] = st
					notes.append(member["name"] + " is " + st["label"] + ".")
		else:
			st["months"] = int(st.get("months", 0)) + 1
			st["severity"] = minf(100.0, st.get("severity", 0.0) + (3.2 if int(member.get("since", 0)) > 1 else -1.5))
			if st["severity"] <= 0.0:
				notes.append("Things have settled down for " + member["name"] + ".")
				member.erase("strain")
		var target: float = 80.0 - minf(float(member.get("since", 0)), 9.0) * 3.0 - (float(st.get("severity", 0.0)) if not st.is_empty() else 0.0) * 0.22 - maxf(0.0, float(s["personal"]["stress"]) - 55.0) * 0.28
		if member["kind"] == "spouse":
			target -= maxf(0.0, s["politics"]["scandal"] - 20.0) * 0.2
		member["bond"] = clampf(member.get("bond", 0.0) + (target - member.get("bond", 0.0)) * 0.22, 0.0, 100.0)
	var spouse := spouse_of(s)
	if not spouse.is_empty():
		s["personal"]["marriage"] = spouse["bond"]
	var kids := children_of(s)
	if not kids.is_empty():
		var total := 0.0
		for k in kids:
			total += k["bond"]
		s["personal"]["family"] = total / float(kids.size())


static func state_of(member: Dictionary) -> String:
	var st: Dictionary = member.get("strain", {})
	if not st.is_empty() and st.get("severity", 0.0) > 45.0:
		return st["label"] + " — badly"
	if not st.is_empty():
		return st["label"]
	if int(member.get("since", 0)) >= 5:
		return "you have not spoken properly in months"
	if int(member.get("since", 0)) >= 3:
		return str(member["since"]) + " months since you gave them an evening"
	if member.get("bond", 0.0) >= 75.0:
		return "close, and glad of it"
	return "fine, as far as you know"
