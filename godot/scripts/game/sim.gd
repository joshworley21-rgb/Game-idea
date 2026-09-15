class_name Sim
extends RefCounted
## One month of the country: laws, budgets, the economy, the mood, and the wear
## on the person in the chair.
##
## Ported from src/game/sim.ts. This is the tick that makes the Godot build a
## game rather than a viewer: everything already ported — the blocs, the
## factions, the cabinet, the family — sits still until something advances it,
## and this is the thing that does.
##
## Two details of the port are worth knowing before changing anything here.
##
## The draw order. simulate_month pulls exactly three values from the shared
## Rng for the economic shock, and then however many drift_family takes. Both
## happen in the order the TypeScript does them, because the same seed has to
## produce the same term in both engines.
##
## SimContext is a Dictionary, not a class: {"needs": {sector: float},
## "cyclePhase": float}. It is per-run scratch, deliberately not part of the
## saved state — it is rebuilt from the month number on load, which is what
## create_sim_context's `month` argument is for.


## `month` rebuilds the accumulated cost of standing still, so a loaded save
## resumes with the same needs it had when it was written.
static func create_sim_context(rng: Rng, month: int = 1) -> Dictionary:
	var elapsed: int = maxi(0, month - 1)
	var creep: float = pow(1.0 + CoreData.NEED_DRIFT, float(elapsed))
	var needs := {}
	for key in CoreData.SECTOR_NEED.keys():
		needs[key] = float(CoreData.SECTOR_NEED[key]) * creep
	return {"needs": needs, "cyclePhase": rng.range_float(0.0, TAU)}


static func _drift(current: float, target: float, rate: float) -> float:
	return current + (target - current) * rate


## The approval number the public would settle on given today's conditions.
##
## Not a formula over the nation's statistics: the weighted sum of what each
## constituency thinks of you, which is what approval actually is. Character
## and press relations shade it.
static func approval_target(s: Dictionary) -> float:
	var coalition := BlocsData.coalition_approval(s)
	var character := (float(s["personal"]["integrity"]) * 0.5
		+ (100.0 - float(s["politics"]["scandal"])) * 0.5)
	return (47.5
		+ (coalition - 50.0) * 0.92
		+ (character - 75.0) * 0.09
		+ (float(s["politics"]["media"]) - 50.0) * 0.06)


## Long-run growth the economy is capable of, before cycle and shocks.
static func potential_growth(s: Dictionary) -> float:
	var n: Dictionary = s["nation"]
	var sec: Dictionary = n["sectors"]
	return (2.2
		+ (float(sec["infrastructure"]) - 50.0) * 0.012
		+ (float(sec["education"]) - 50.0) * 0.01
		+ (float(sec["science"]) - 50.0) * 0.014
		- (float(n["taxRate"]) - 18.0) * 0.075
		- maxf(0.0, float(n["debtToGdp"]) - 90.0) * 0.004
		- (float(n["unrest"]) - 35.0) * 0.012
		+ (float(n["standing"]) - 50.0) * 0.004)


## The numbers the month report names, and how far each has to move to be worth
## mentioning. `higher_good` says which direction counts as good news.
const TRACKED := [
	{"label": "Approval", "path": "politics.approval", "higher_good": true, "min_delta": 0.6},
	{"label": "Growth", "path": "nation.growth", "higher_good": true, "min_delta": 0.12},
	{"label": "Unemployment", "path": "nation.unemployment", "higher_good": false, "min_delta": 0.12},
	{"label": "Inflation", "path": "nation.inflation", "higher_good": false, "min_delta": 0.12},
	{"label": "Debt/GDP", "path": "nation.debtToGdp", "higher_good": false, "min_delta": 0.35},
	{"label": "Unrest", "path": "nation.unrest", "higher_good": false, "min_delta": 0.8},
	{"label": "Health", "path": "personal.health", "higher_good": true, "min_delta": 0.8},
	{"label": "Stress", "path": "personal.stress", "higher_good": false, "min_delta": 1.2},
	{"label": "Marriage", "path": "personal.marriage", "higher_good": true, "min_delta": 0.8},
	{"label": "Family", "path": "personal.family", "higher_good": true, "min_delta": 0.8},
]


## Advances the world by one month. Returns the month report:
## {month, deltas: [{label, from, to, good}], deficit, revenue, notes}.
static func simulate_month(s: Dictionary, ctx: Dictionary, rng: Rng, crisis_count: int) -> Dictionary:
	var before := {}
	for t in TRACKED:
		before[t["label"]] = Effects.read_path(s, t["path"])
	var blocs_before := {}
	for def in CoreData.BLOCS:
		blocs_before[def["key"]] = float(s["blocs"].get(def["key"], 50.0))
	var notes: Array[String] = []

	# --- Running situations: wars, epidemics, investigations ---
	var threads: Array = s["threads"]
	for thread in threads:
		# Effects scale with intensity, so a situation winding down hurts less.
		var per_month: Dictionary = thread.get("perMonth", {})
		if not per_month.is_empty():
			Effects.apply_effects(s, per_month, float(thread["intensity"]) / 60.0)
		thread["intensity"] = clampf(float(thread["intensity"]) + float(thread["drift"]), 0.0, 100.0)
		thread["age"] = int(thread.get("age", 0)) + 1
		# A live situation keeps its domains hot, which is what clusters trouble.
		for tag in (thread.get("tags", []) as Array):
			s["heat"][tag] = maxf(float(s["heat"].get(tag, 0.0)), float(thread["intensity"]) * 0.6)
	var still_running: Array = []
	for t in threads:
		if float(t["intensity"]) <= 0.0:
			notes.append("%s is over, after %d months." % [t["label"], int(t["age"])])
		else:
			still_running.append(t)
	s["threads"] = still_running

	# Domains cool off when nothing is feeding them.
	for key in s["heat"].keys():
		var value := float(s["heat"][key]) * 0.86
		if value < 1.0:
			s["heat"].erase(key)
		else:
			s["heat"][key] = value

	# --- Standing effects: temporary modifiers and laws on the books ---
	for mod in (s["modifiers"] as Array):
		Effects.apply_effects(s, mod.get("perMonth", {}))
	var living_mods: Array = []
	for m in (s["modifiers"] as Array):
		if int(m["months"]) < 0:
			living_mods.append(m)
			continue
		m["months"] = int(m["months"]) - 1
		if int(m["months"]) > 0:
			living_mods.append(m)
	s["modifiers"] = living_mods
	for bill in (s["bills"] as Array):
		if bill.get("status", "") == "passed" and not (bill.get("perMonth", {}) as Dictionary).is_empty():
			Effects.apply_effects(s, bill["perMonth"])

	# --- Public services respond to money, slowly ---
	# Money buys capacity; a competent cabinet turns it into delivery.
	var machine := 1.0 + (People.cabinet_strength(s) - 63.0) * 0.0035
	for key in CoreData.BUDGET_KEYS:
		ctx["needs"][key] = float(ctx["needs"][key]) * (1.0 + CoreData.NEED_DRIFT)
		var ratio := float(s["enacted"][key]) / float(ctx["needs"][key])
		var target := clampf(50.0 + 62.0 * (ratio - 1.0), 0.0, 100.0)
		# Strikes and disorder blunt delivery.
		var decay := 0.9 if float(s["nation"]["unrest"]) > 65.0 else 1.0
		s["nation"]["sectors"][key] = _drift(
			float(s["nation"]["sectors"][key]), target * decay * machine, 0.085)

	# --- Macroeconomy ---
	var cycle := 0.6 * sin(float(s["month"]) / 9.0 + float(ctx["cyclePhase"]))
	var shock := (rng.next() + rng.next() + rng.next() - 1.5) * 0.5
	var growth_target := (potential_growth(s) + cycle + shock
		+ (People.domain_competence(s, "economy") - 60.0) * 0.006)
	# Central bank leans against inflation with rate hikes.
	if float(s["nation"]["inflation"]) > 3.2:
		growth_target -= (float(s["nation"]["inflation"]) - 3.2) * 0.35
	s["nation"]["growth"] = _drift(float(s["nation"]["growth"]), growth_target, 0.35)

	var revenue := StateData.annual_revenue(s)
	var deficit := StateData.annual_deficit(s)
	var deficit_pct := deficit / float(s["nation"]["gdp"]) * 100.0

	var inflation_target := (1.7
		+ 0.42 * (float(s["nation"]["growth"]) - 2.0)
		+ 0.1 * (deficit_pct - 2.5)
		+ shock * 0.3)
	s["nation"]["inflation"] = _drift(float(s["nation"]["inflation"]), inflation_target, 0.25)

	var unemployment_target := (4.4
		- 0.55 * (float(s["nation"]["growth"]) - 2.0)
		+ (50.0 - float(s["nation"]["sectors"]["education"])) * 0.012
		+ maxf(0.0, float(s["nation"]["unrest"]) - 50.0) * 0.02)
	s["nation"]["unemployment"] = _drift(
		float(s["nation"]["unemployment"]), unemployment_target, 0.28)

	# Nominal GDP compounds with real growth plus prices.
	var debt_dollars := (float(s["nation"]["debtToGdp"]) / 100.0 * float(s["nation"]["gdp"])
		+ deficit / 12.0)
	s["nation"]["gdp"] = float(s["nation"]["gdp"]) * (1.0
		+ (float(s["nation"]["growth"]) + float(s["nation"]["inflation"])) / 1200.0)
	s["nation"]["debtToGdp"] = minf(400.0, debt_dollars / float(s["nation"]["gdp"]) * 100.0)

	# --- Society, security, the world ---
	var sec: Dictionary = s["nation"]["sectors"]
	var avg_social := (float(sec["healthcare"]) + float(sec["welfare"])
		+ float(sec["justice"]) + float(sec["education"])) / 4.0
	var unrest_target := (24.0
		+ (float(s["nation"]["unemployment"]) - 4.5) * 3.2
		+ maxf(0.0, float(s["nation"]["inflation"]) - 3.0) * 3.0
		+ (50.0 - avg_social) * 0.45
		+ (50.0 - float(s["politics"]["approval"])) * 0.18
		- (float(sec["justice"]) - 50.0) * 0.15)
	s["nation"]["unrest"] = _drift(
		float(s["nation"]["unrest"]), maxf(0.0, unrest_target), 0.22)

	var security_target := (50.0
		+ (float(sec["defense"]) - 50.0) * 0.6
		+ (float(s["nation"]["standing"]) - 50.0) * 0.3
		- (float(s["nation"]["unrest"]) - 35.0) * 0.2)
	s["nation"]["security"] = _drift(float(s["nation"]["security"]), security_target, 0.18)

	var standing_target := (50.0
		+ (float(s["nation"]["security"]) - 50.0) * 0.2
		+ (float(sec["environment"]) - 50.0) * 0.15
		+ (float(s["nation"]["growth"]) - 2.0) * 1.5
		- (float(s["nation"]["unrest"]) - 35.0) * 0.15)
	s["nation"]["standing"] = _drift(float(s["nation"]["standing"]), standing_target, 0.14)

	# --- Politics ---
	# Constituencies move first: approval is the sum of what they now think.
	BlocsData.drift_blocs(s)
	# Then Congress, whose factions follow their own constituencies -- and take
	# note of which of them you gave a department to.
	CongressData.drift_factions(s, People.cabinet_faction_support(s))
	# House and Senate numbers now describe who would actually vote with you.
	var friendly := CongressData.friendly_seats(s)
	s["politics"]["house"] = _drift(float(s["politics"]["house"]), friendly, 0.5)
	s["politics"]["senate"] = _drift(float(s["politics"]["senate"]), friendly * 0.96, 0.5)

	var target_approval := approval_target(s)
	var month: int = int(s["month"])
	if month <= 6:
		target_approval += float(7 - month) * 1.1  # honeymoon
	if month >= 40:
		target_approval -= float(month - 39) * 0.25  # late-term fatigue
	s["politics"]["approval"] = _drift(float(s["politics"]["approval"]), target_approval, 0.3)

	var capital_gain := (3.5
		+ (float(s["politics"]["approval"]) - 48.0) / 12.0
		+ (float(s["politics"]["party"]) - 55.0) / 30.0)
	Effects.add_path(s, "politics.capital", capital_gain)

	s["politics"]["media"] = _drift(
		float(s["politics"]["media"]), 50.0 - float(s["politics"]["scandal"]) * 0.25, 0.07)
	# Your party's mood follows its own base rather than the country at large.
	var core_keys: Array = (["labour", "young", "activists"] if s["party"] == "blue"
		else ["rural", "business", "traditionalists"])
	var core := 0.0
	for k in core_keys:
		core += float(s["blocs"].get(k, 50.0))
	core /= float(core_keys.size())
	s["politics"]["party"] = _drift(float(s["politics"]["party"]),
		40.0 + core * 0.55 + (float(s["politics"]["approval"]) - 45.0) * 0.2, 0.09)
	Effects.add_path(s, "politics.scandal",
		-0.6 if float(s["politics"]["media"]) < 40.0 else -1.2)

	# --- The person in the chair ---
	# Whatever your family is carrying, you are carrying some of it too.
	var carried := People.family_strain(s) * 0.045
	var stress_target := (34.0
		+ (52.0 - float(s["politics"]["approval"])) * 0.5
		+ float(crisis_count) * 10.0
		+ maxf(0.0, float(s["nation"]["unrest"]) - 45.0) * 0.3
		+ maxf(0.0, 50.0 - float(s["personal"]["marriage"])) * 0.15
		+ carried
		+ float(s["personal"]["sleepDebt"]) * 0.12)
	s["personal"]["stress"] = _drift(
		float(s["personal"]["stress"]), maxf(5.0, stress_target), 0.3)

	# Sleep is the first thing the job takes and the last thing you get back.
	# You do recover a little on your own, which is why it settles somewhere
	# rather than running to a hundred: the level it settles at is the point.
	var rest_debt := (1.4
		+ float(crisis_count) * 3.0
		+ maxf(0.0, float(s["personal"]["stress"]) - 52.0) * 0.08
		- float(s["personal"]["fitness"]) * 0.018)
	Effects.add_path(s, "personal.sleepDebt",
		rest_debt - float(s["personal"]["sleepDebt"]) * 0.055)
	# Fitness falls toward what a schedule like this leaves you with.
	s["personal"]["fitness"] = _drift(float(s["personal"]["fitness"]),
		24.0 - maxf(0.0, float(s["personal"]["age"]) - 60.0) * 0.6, 0.05)

	var health_delta := (-0.2
		- maxf(0.0, float(s["personal"]["stress"]) - 65.0) * 0.05
		- maxf(0.0, float(s["personal"]["sleepDebt"]) - 42.0) * 0.014
		- maxf(0.0, 50.0 - float(s["personal"]["fitness"])) * 0.008)
	if float(s["personal"]["age"]) > 62.0:
		health_delta -= 0.12
	# The TypeScript tests `s.personal.condition` for truthiness; an absent
	# field and an explicit null both have to read as "no condition".
	var condition: Variant = s["personal"].get("condition", null)
	if condition != null and str(condition) != "":
		health_delta -= 0.25
	Effects.add_path(s, "personal.health", health_delta)
	s["personal"]["age"] = float(s["personal"]["age"]) + 1.0 / 12.0

	# The people upstairs have their own month. Bonds erode with absence, and
	# marriage and family become a readout of how those five people are doing.
	People.drift_family(s, rng, notes)

	# Name the constituency that shifted hardest, so movement is legible.
	var biggest_name := ""
	var biggest_delta := 0.0
	var have_biggest := false
	for def in CoreData.BLOCS:
		var delta := float(s["blocs"].get(def["key"], 50.0)) - float(blocs_before[def["key"]])
		if not have_biggest or absf(delta) > absf(biggest_delta):
			have_biggest = true
			biggest_name = def["short"]
			biggest_delta = delta
	if have_biggest and absf(biggest_delta) >= 1.4:
		if biggest_delta > 0.0:
			notes.append("%s are warming to you." % biggest_name)
		else:
			notes.append("%s are drifting away." % biggest_name)

	if float(s["personal"]["health"]) < 35.0:
		Effects.add_path(s, "personal.stress", 2.5)
		notes.append("Your doctor has stopped hinting and started warning.")
	if float(s["personal"]["sleepDebt"]) > 70.0:
		notes.append("You have not slept properly since the spring.")
	if float(s["personal"]["fitness"]) < 30.0:
		notes.append("Two flights of stairs is now a decision.")
	if float(s["nation"]["unrest"]) > 70.0:
		notes.append("Protests are now a nightly fixture on the news.")
	if float(s["nation"]["debtToGdp"]) > 130.0:
		notes.append("Bond markets are openly nervous about the debt.")

	# --- Action points for the month ahead ---
	# Two things a month, three if you are in good enough shape to manage it.
	var ap := 2
	if float(s["personal"]["health"]) >= 70.0 and float(s["personal"]["stress"]) <= 50.0:
		ap += 1
	if float(s["personal"]["health"]) < 40.0 or float(s["personal"]["stress"]) >= 85.0:
		ap -= 1
	# A body running on nothing gets less done, whatever the schedule says.
	if float(s["personal"]["sleepDebt"]) > 78.0:
		ap -= 1
	s["apMax"] = clampi(ap, 1, 3)
	s["ap"] = s["apMax"]

	var deltas: Array = []
	for t in TRACKED:
		var from: float = float(before[t["label"]])
		var to := Effects.read_path(s, t["path"])
		if absf(to - from) < float(t["min_delta"]):
			continue
		var good: bool = (to - from) > 0.0 if t["higher_good"] else (to - from) < 0.0
		deltas.append({"label": t["label"], "from": from, "to": to, "good": good})

	return {
		"month": int(s["month"]),
		"deltas": deltas,
		"deficit": deficit,
		"revenue": revenue,
		"notes": notes,
	}
