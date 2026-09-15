class_name EngineMonth
extends RefCounted
## The month, end to end.
##
## Ported from src/game/engineMonth.ts. Everything else in the port is a piece
## of a month; this is the order they happen in, and the order is the design:
##
##   the stopgap first, because an unsigned budget is last year's numbers and
##   the simulation has to run against what was actually enacted;
##   then the country, in Sim.simulate_month;
##   then the cabinet, the body and the residence, which react to it;
##   then the month rolls over and the danger streak updates;
##   then the midterms, if this is the month for them;
##   then the fail check, because a term that ended does not get crises;
##   then crises, then arcs -- an arc is a consequence rather than an event,
##   so it waits its turn behind whatever the country did this month;
##   then the news, which reports all of it.
##
## Returns {report, outcomes, crises, arc, ending, askReelection}. `ending` is
## {} unless the term ended this month, and `arc` is {} unless one arrived.


## True on the month a new fiscal year's budget must be signed.
static func is_budget_pending(s: Dictionary) -> bool:
	return (int(s["month"]) - 1) % 12 == 0 and not s["flags"].get("budget%d" % int(s["month"]), false)


static func end_month(s: Dictionary, ctx: Dictionary, rng: Rng) -> Dictionary:
	var outcomes: Array = []

	# An unsigned budget means a continuing resolution: last year's numbers.
	if is_budget_pending(s):
		MonthFlow.run_stopgap(s)

	var crisis_count := int(s["counters"].get("crisesThisMonth", 0))
	var report := Sim.simulate_month(s, ctx, rng, crisis_count)
	s["counters"]["crisesThisMonth"] = 0

	MonthFlow.run_cabinet(s, rng, report)
	var body := MonthFlow.run_body(s, rng, report)
	if not body.is_empty():
		outcomes.append({"title": body["title"], "text": body["text"], "effects": [],
			"tone": body["tone"]})
	MonthFlow.run_residence(s, report)

	s["history"].append({
		"month": int(s["month"]),
		"approval": float(s["politics"]["approval"]),
		"growth": float(s["nation"]["growth"]),
		"unemployment": float(s["nation"]["unemployment"]),
		"unrest": float(s["nation"]["unrest"]),
		"health": float(s["personal"]["health"]),
	})

	s["month"] = int(s["month"]) + 1
	EndingsData.update_danger_streak(s)

	if int(s["month"]) == CoreData.MIDTERM_MONTH:
		var result := MonthFlow.run_midterms(s, rng)
		outcomes.append({
			"title": "Midterm Elections",
			"text": MonthFlow.midterm_text(result),
			"effects": [],
			"tone": "good" if result["won"] else "bad",
		})

	var fail := EndingsData.check_fail_state(s)
	if not fail.is_empty() or EndingsData.is_term_over(s):
		s["phase"] = "ended"
		s["ending"] = EndingsData.build_ending(s, rng, fail)
		return {"report": report, "outcomes": outcomes, "crises": [], "arc": {},
			"ending": s["ending"], "askReelection": false}

	# Crises, then arcs. An arc is a consequence rather than an event, so it
	# waits its turn behind whatever the country did this month.
	var crises := roll_crises(s, rng)
	var arc := ArcsData.roll_month_arcs(s, rng)
	NewsData.push_news(s, NewsData.generate_news(s, rng))

	var ask_reelection: bool = int(s["month"]) >= 34 and not s["flags"].get("reelectionAsked", false)
	if ask_reelection:
		s["flags"]["reelectionAsked"] = true

	return {"report": report, "outcomes": outcomes, "crises": crises, "arc": arc,
		"ending": {}, "askReelection": ask_reelection}


## Rolls this month's crises from the eligible pool, weighted by pressure.
static func roll_crises(s: Dictionary, rng: Rng) -> Array:
	var pool := CrisesData.eligible_crises(s)
	if pool.is_empty():
		return []
	var total_pressure := 0.0
	for c in pool:
		total_pressure += CrisesData.crisis_pressure(s, c)
	var chance := clampf(0.12 + total_pressure * 0.03, 0.15, 0.8)

	var fired: Array[String] = []
	if rng.chance(chance):
		var picked = rng.weighted(pool, func(c):
			return float(c["weight"]) * CrisesData.crisis_pressure(s, c))
		if picked != null:
			fired.append(str(picked["id"]))
	# A second, rarer crisis when the country is genuinely under strain.
	if fired.size() == 1 and rng.chance(minf(0.25, total_pressure * 0.012)):
		var rest: Array = []
		for c in pool:
			if not fired.has(c["id"]):
				rest.append(c)
		var second = rng.weighted(rest, func(c):
			return float(c["weight"]) * CrisesData.crisis_pressure(s, c))
		if second != null:
			fired.append(str(second["id"]))

	s["pendingCrises"] = fired
	s["counters"]["crisesThisMonth"] = fired.size()
	var out: Array = []
	for id in fired:
		var c := CrisesData.by_id(id)
		if not c.is_empty():
			out.append(c)
	return out
