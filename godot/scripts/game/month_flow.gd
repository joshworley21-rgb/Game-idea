class_name MonthFlow
extends RefCounted
## The things that happen at the end of a month, outside the economic model.
##
## Ported from src/game/monthFlow.ts: the cabinet's resignations and leaks, the
## body's own month, the residence, the midterms, and the stopgap that funds a
## government whose budget you did not sign.
##
## Sim.simulate_month is the country. This is everything else the month does,
## and it runs after it, in the order endMonth calls these: stopgap, then the
## simulation, then cabinet, body, residence.
##
## `report` is the Dictionary Sim.simulate_month returned; these functions push
## onto its `notes`, which is how the month report ends up saying what actually
## happened rather than only which numbers moved.


## The cabinet's month: resignations and leaks.
static func run_cabinet(s: Dictionary, rng: Rng, report: Dictionary) -> void:
	for event in People.tick_cabinet(s, rng):
		var person: Dictionary = event["person"]
		var who := People.temperament_of(person)
		if event["kind"] == "resigned":
			var successor := People.replace_secretary(rng, s["cabinet"], person["office"])
			# How loudly they go is who they were. An institutionalist
			# resigning on principle is a week of coverage; an old friend
			# stepping down for health reasons costs you almost nothing but
			# the person.
			var loud: bool = who["key"] == "institutionalist" or who["key"] == "rival"
			var quiet: bool = who["key"] == "friend"
			Effects.apply_effects(s, {
				"politics.capital": -2.0 if quiet else (-8.0 if loud else -5.0),
				"politics.approval": -0.4 if quiet else (-2.2 if loud else -1.4),
				"politics.media": -1.0 if quiet else (-5.0 if loud else -3.0),
				"personal.stress": 7.0 if quiet else 5.0,
			})
			s["counters"]["resignations"] = int(s["counters"].get("resignations", 0)) + 1
			_log(s, "system", "%s %s resigns; %s sworn in." % [
				person["title"], person["name"], successor["name"]])
			report["notes"].append("%s %s. %s takes the department." % [
				person["name"], who["parting"], successor["name"]])
			var headline := ""
			if loud:
				headline = "%s quits as %s and does not go quietly" % [
					person["name"], person["title"]]
			elif quiet:
				headline = "%s steps down as %s after a private year" % [
					person["name"], person["title"]]
			else:
				headline = "%s resigns as %s, citing \"differences of direction\"" % [
					person["name"], person["title"]]
			NewsData.push_news(s, [{"month": int(s["month"]), "headline": headline,
				"source": "The Beacon", "tone": "bad"}])
		else:
			# The leak vents the pressure.
			person["loyalty"] = minf(100.0, float(person["loyalty"]) + 6.0)
			# A rival leaking is not the same as a junior aide leaking: they
			# know which meeting was the damaging one, and they were in it.
			var sharp: bool = who["key"] == "rival"
			Effects.apply_effects(s, {
				"politics.scandal": 10.0 if sharp else 7.0,
				"politics.media": -5.0,
				"personal.stress": 4.0,
			})
			s["counters"]["leaks"] = int(s["counters"].get("leaks", 0)) + 1
			_log(s, "system", "A private meeting with %s appears in print." % person["name"])
			report["notes"].append("Someone who wanted this desk is briefing against you, and they were in the room." if sharp
				else "Someone in the room is talking to the press.")
			NewsData.push_news(s, [{"month": int(s["month"]),
				"headline": ("Cabinet source gives detailed account of Oval Office meeting \"the President would rather forget\"" if sharp
					else "Leaked account of Oval Office meeting contradicts White House line"),
				"source": "The Beacon", "tone": "bad"}])


## The body's month. A full physical is what finds a condition before it finds
## you; left long enough, exhaustion and a bad heart collect on their own
## terms, and the country watches you do it.
##
## Returns {title, text, tone} when something happened, or {} when nothing did.
static func run_body(s: Dictionary, rng: Rng, report: Dictionary) -> Dictionary:
	var p: Dictionary = s["personal"]

	# The physician cannot diagnose what you never let them look at.
	var history: Dictionary = s["actionHistory"]
	var looked: bool = history.has("physical") and int(s["month"]) - int(history["physical"]) <= 2
	if not p.has("condition") and looked:
		var risk := ((maxf(0.0, float(p["age"]) - 58.0) * 0.02
			+ maxf(0.0, 55.0 - float(p["fitness"])) * 0.006
			+ maxf(0.0, float(p["sleepDebt"]) - 40.0) * 0.004)
			* (1.6 if float(p["health"]) < 55.0 else 1.0))
		if rng.chance(minf(0.6, risk)):
			p["condition"] = rng.pick([
				"atrial fibrillation",
				"hypertension the letter called \"managed\"",
				"a coronary narrowing they want watched",
				"type 2 diabetes",
			])
			Effects.apply_effects(s, {"personal.stress": 8.0, "politics.media": -2.0})
			_log(s, "personal", "Walter Reed finds %s." % p["condition"])
			report["notes"].append("The physical found something: %s." % p["condition"])
			return {
				"title": "The Physical",
				"text": ("The letter the networks read out is two pages. The one your "
					+ "physician hands you privately is longer, and it names "
					+ str(p["condition"]) + ". There is a plan. The plan involves the schedule."),
				"tone": "bad",
			}

	# An episode: exhaustion, a heart, a body that has had enough.
	var episode_risk := (maxf(0.0, float(p["sleepDebt"]) - 62.0) * 0.004
		+ maxf(0.0, 45.0 - float(p["health"])) * 0.005
		+ (0.012 if p.has("condition") else 0.0)
		+ maxf(0.0, float(p["stress"]) - 78.0) * 0.003)
	if episode_risk > 0.0 and rng.chance(minf(0.14, episode_risk)):
		var kind := ("an episode the cardiology team had warned you about" if p.has("condition")
			else "a collapse in the residence corridor at four in the morning")
		Effects.apply_effects(s, {
			"personal.health": -9.0,
			"personal.stress": -14.0,
			"personal.sleepDebt": -35.0,
			"politics.capital": -8.0,
			"politics.approval": -2.0,
		})
		s["counters"]["healthEpisodes"] = int(s["counters"].get("healthEpisodes", 0)) + 1
		# A week at Walter Reed is a week you do not get back.
		s["ap"] = maxi(0, int(s["ap"]) - 1)
		_log(s, "personal", "A week at Walter Reed. The Vice President signs three things.")
		report["notes"].append("You lost a week of the month to a hospital bed.")
		NewsData.push_news(s, [{"month": int(s["month"]),
			"headline": "President admitted to Walter Reed; White House says tests are precautionary",
			"source": "Channel 8 Nightly", "tone": "bad"}])
		return {
			"title": "Walter Reed",
			"text": ("It is " + kind + ". You wake up with a cannula in your arm and your "
				+ "chief of staff already in the room. The country is told it was "
				+ "precautionary. Your family is told the truth."),
			"tone": "bad",
		}
	return {}


## Upstairs. Nobody schedules this, so the month says once, plainly, who has
## been waiting longest -- and the country eventually notices a first family
## that is never in the same room.
static func run_residence(s: Dictionary, report: Dictionary) -> void:
	var waiting := People.most_neglected(s)
	if not waiting.is_empty() and int(waiting["since"]) >= 4:
		report["notes"].append("%s has been waiting %d months for an evening." % [
			waiting["name"], int(waiting["since"])])
	# A visibly absent family is a story, and a visibly close one is an asset.
	var closeness := (float(s["personal"]["marriage"]) + float(s["personal"]["family"])) / 2.0
	if closeness < 38.0:
		Effects.apply_effects(s, {"blocs.traditionalists": -0.9, "blocs.suburban": -0.5,
			"politics.media": -0.4})
	elif closeness > 74.0:
		Effects.apply_effects(s, {"blocs.traditionalists": 0.5, "blocs.suburban": 0.4,
			"politics.media": 0.3})


## The midterms. The president's party almost always loses ground.
## Returns {swing, won}.
static func run_midterms(s: Dictionary, rng: Rng) -> Dictionary:
	var swing := (float(s["politics"]["approval"]) - 50.0) * 0.55 + rng.range_float(-4.0, 4.0) - 4.0
	Effects.apply_effects(s, {"politics.house": swing, "politics.senate": swing * 0.7})
	# Seats actually change hands between the factions.
	CongressData.apply_midterm_swing(s, swing)
	var won := swing > 0.0
	_log(s, "system", "Midterm elections: %s of %.1f points." % [
		"gains" if won else "losses", absf(swing)])
	NewsData.push_news(s, [{"month": int(s["month"]),
		"headline": ("President's party defies history and holds the line at the midterms" if won
			else "Voters deliver a rebuke: opposition picks up seats in both chambers"),
		"source": "Channel 8 Nightly", "tone": "good" if won else "bad"}])
	return {"swing": swing, "won": won}


## An unsigned budget means a continuing resolution: last year's numbers.
static func run_stopgap(s: Dictionary) -> void:
	s["flags"]["budget%d" % int(s["month"])] = true
	Effects.apply_effects(s, {
		"politics.approval": -2.5,
		"politics.capital": -4.0,
		"nation.unrest": 2.0,
		"personal.stress": 5.0,
	})
	_log(s, "policy", "No budget signed; the government runs on a continuing resolution.")
	NewsData.push_news(s, [{"month": int(s["month"]),
		"headline": "Government funded by stopgap again as budget talks stall",
		"source": "Capitol Wire", "tone": "bad"}])


## The label for a midterm outcome, for the toast.
static func midterm_text(result: Dictionary) -> String:
	if result["won"]:
		return "Your party holds. Nobody in this building can quite believe it, including you."
	return "Your party loses seats in both chambers. Every vote from here is harder than the last one was."


## Writes a line to the log. No cap here on purpose: the TypeScript trims the
## log to 120 entries in the engine's own log() and nowhere else, so trimming
## it at the point of writing would quietly drop lines the engine keeps.
static func _log(s: Dictionary, kind: String, text: String) -> void:
	var log_lines: Array = s["log"]
	log_lines.push_front({"month": int(s["month"]), "text": text, "kind": kind})
