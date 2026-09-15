class_name ArcsData
extends RefCounted
## Story arcs: the things that take months to arrive.
##
## A crisis is something that happens to you. An arc is something you did,
## coming back — the secretary you overruled, the leak you sat on, the child
## you have not seen since the inauguration. Each is a consequence with a face
## on it, and it arrives wanting an answer.
##
## Ported from src/game/arcs.ts, arcRunner.ts and arcHooks.ts. The 12 arcs
## themselves are generated into ArcsTable by scripts/export-content.mjs; what
## is here is the two fields per arc that are functions and could not be:
##
##   when_for   -- an arc only fires while the situation that caused it still
##                 holds. Let the treasury secretary's loyalty recover and the
##                 feud stops being a thing that could happen.
##   brief_for  -- every arc names the person it is about, their office, how
##                 long they have been in the job. That naming is the whole
##                 difference between a consequence and an event.


static func by_id(id: String) -> Dictionary:
	for a in ArcsTable.ARCS:
		if a["id"] == id:
			return a
	return {}


static func _secretary(s: Dictionary, office: String) -> Dictionary:
	for c in (s.get("cabinet", []) as Array):
		if c.get("office", "") == office:
			return c
	return {}


static func _any_sector_below(s: Dictionary, floor_v: float) -> bool:
	for k in (s["nation"]["sectors"] as Dictionary):
		if float(s["nation"]["sectors"][k]) < floor_v:
			return true
	return false


static func _flag(s: Dictionary, key: String) -> bool:
	return s["flags"].get(key, false) == true


## Whether `id` could fire right now, the situation being what it is.
static func when_for(id: String, s: Dictionary) -> bool:
	var pol: Dictionary = s["politics"]
	match id:
		"arc-treasury-feud":
			var person := _secretary(s, "treasury")
			return not person.is_empty() and float(person["loyalty"]) < 42.0
		"arc-leak-source":
			return float(pol["scandal"]) > 34.0
		"arc-child-away":
			for m in (s.get("family", []) as Array):
				if m.get("kind", "") == "child" and int(m.get("since", 0)) >= 6:
					return true
			return false
		"arc-primary-challenge":
			return float(pol["approval"]) < 40.0 and float(pol["party"]) < 45.0
		"arc-unrest-organised":
			return float(s["nation"]["unrest"]) > 62.0
		"arc-rival-positioning":
			var person := People.secretary_with(s, "rival")
			return not person.is_empty() and float(person["loyalty"]) < 58.0
		"arc-believer-ultimatum":
			var person := People.secretary_with(s, "believer")
			return (not person.is_empty() and float(person["loyalty"]) < 62.0
				and float(s["counters"].get("billsPassed", 0)) < 2.0)
		"arc-friend-cost":
			var person := People.secretary_with(s, "friend")
			return (not person.is_empty() and float(person["loyalty"]) < 60.0
				and float(s["personal"]["stress"]) > 55.0)
		"arc-institutionalist-paper":
			var person := People.secretary_with(s, "institutionalist")
			return not person.is_empty() and float(pol["scandal"]) > 38.0
		"arc-technocrat-starved":
			var person := People.secretary_with(s, "technocrat")
			if person.is_empty():
				return false
			return float(person["loyalty"]) < 64.0 and _any_sector_below(s, 42.0)
		"arc-campaign-filing":
			return (_flag(s, "campaign:get-ahead") or _flag(s, "campaign:lawyer-up")
				or _flag(s, "campaign:counterstory"))
		"arc-base-play-bill":
			return _flag(s, "campaign:base-play") and float(pol["party"]) < 62.0
	push_error("arcs: no condition for \"%s\"" % id)
	return false


## The paragraph the player reads, with the people in it named.
static func brief_for(id: String, s: Dictionary) -> String:
	match id:
		"arc-treasury-feud":
			var person := _secretary(s, "treasury")
			if person.is_empty():
				return "The Treasury has gone quiet, and quiet is not the same as agreement."
			return ("%s has been in the job %d months and has not been in the Oval Office since the spring. Her department is answering the White House in writing now, which is a way of saying no."
				% [person["name"], int(person["months"])])
		"arc-leak-source":
			var person := _secretary(s, "chief")
			if person.is_empty():
				return "The counsel's office has a name. The file is on your desk and nobody else has read it."
			return ("The counsel's office has a name, and it is somebody who sits in %s's meetings. The file is on your desk and nobody else has read it."
				% person["name"])
		"arc-child-away":
			var child := {}
			for m in (s.get("family", []) as Array):
				if m.get("kind", "") == "child" and int(m.get("since", 0)) >= 6:
					child = m
					break
			if child.is_empty():
				return "One of them has stopped coming home, and the residence is quieter for it."
			return ("%s has not been in the residence since the spring. They are %d, they are %s, and the last three calls went to voicemail."
				% [child["name"], int(child["age"]), child["doing"]])
		"arc-primary-challenge":
			return ("A governor has been making calls. Nothing announced, nothing on the record, but three of your own senators have taken the meeting. Your party's patience with %d%% approval has run out."
				% int(round(float(s["politics"]["approval"]))))
		"arc-unrest-organised":
			return ("What began as a crowd has become a movement with a name, a bank account and a list of demands. Unrest is at %d and it is no longer weather. It is a constituency."
				% int(round(float(s["nation"]["unrest"]))))
		"arc-rival-positioning":
			var person := People.secretary_with(s, "rival")
			if person.is_empty():
				return "Somebody in your cabinet has a speaking schedule nobody cleared with you."
			return ("%s has a speaking schedule. Not the department's — their own. Three of the stops are in states that vote early, and the %s's office has stopped clearing them with you."
				% [person["name"], str(person["title"]).to_lower()])
		"arc-believer-ultimatum":
			var person := People.secretary_with(s, "believer")
			if person.is_empty():
				return "Somebody who came here to do one thing has asked for twenty minutes."
			var passed := int(s["counters"].get("billsPassed", 0))
			var middle := "nothing has gone to the floor yet"
			if passed != 0:
				middle = "%d %s passed and none of them were it" % [
					passed, "bill has" if passed == 1 else "bills have"]
			return ("%s took this job to do one thing, and %s. They have asked for twenty minutes and they have not said what about."
				% [person["name"], middle])
		"arc-friend-cost":
			var person := People.secretary_with(s, "friend")
			if person.is_empty():
				return "Somebody you have known for twenty years is not doing well in this building."
			return ("%s has been in this building %d months and has aged more than that. You have known them long enough to see it, which is the problem with knowing somebody that long."
				% [person["name"], int(person["months"])])
		"arc-institutionalist-paper":
			var person := People.secretary_with(s, "institutionalist")
			if person.is_empty():
				return "Instructions from this office are being confirmed back to it in writing, and copied to counsel."
			return ("%s has begun confirming your instructions by memo. Every one is polite, accurate, and copied to their own counsel. Thirty years in this building teaches you what a file is for."
				% person["name"])
		"arc-technocrat-starved":
			var person := People.secretary_with(s, "technocrat")
			if person.is_empty():
				return "A four-page note with a graph on page one has arrived from a department that is running out of money."
			return ("%s has sent a four-page note with a graph on page one. It shows their department's funding against what it is being asked to deliver, and the two lines crossed eleven months ago."
				% person["name"])
		"arc-campaign-filing":
			if _flag(s, "campaign:get-ahead"):
				return "The financial filing you released yourself in October is back, because a committee has finished reading it. There is nothing in it. There is a hearing anyway, and hearings are not about what is in things."
			if _flag(s, "campaign:counterstory"):
				return "The story you put out about your opponent ten days before the election has been traced to your campaign. Nobody has proved it. Everybody knows it."
			return "The financial filing your lawyers sat on in October has been obtained by a committee, and the part your lawyers were worried about is the part they have."
		"arc-base-play-bill":
			return ("You won the primary by going to the flank and staying there. The people who carried you through February have been patient for %d months, and a letter with four hundred signatures on it says the patience is a loan, not a gift."
				% int(s["month"]))
	push_error("arcs: no brief for \"%s\"" % id)
	return ""


## Arcs that could fire right now: not already answered, old enough, and with
## the situation that causes them still true.
static func eligible_arcs(s: Dictionary) -> Array:
	var out: Array = []
	for a in ArcsTable.ARCS:
		if _flag(s, "arc:%s" % a["id"]):
			continue
		if int(s["month"]) < int(a["after"]):
			continue
		if when_for(str(a["id"]), s):
			out.append(a)
	return out


## Decides whether an arc fires this month. At most one at a time: two
## consequences arriving in the same month reads as noise rather than as cause
## and effect. Returns {} when none fires.
static func roll_arcs(s: Dictionary, rng: Rng) -> Dictionary:
	var pool := eligible_arcs(s)
	if pool.is_empty():
		return {}
	# Arcs are not crises: they are not weighted by pressure, and they do not
	# fire every time they are eligible. Roughly one in three months.
	if not rng.chance(0.34):
		return {}
	var picked = rng.weighted(pool, func(a): return a["weight"])
	return picked if picked != null else {}


## Applies the player's answer and marks the arc spent. Returns
## {arc, text, effects, failed}, or {} if the arc or choice is not real.
static func resolve_arc(s: Dictionary, rng: Rng, arc_id: String, choice_id: String) -> Dictionary:
	var arc := by_id(arc_id)
	if arc.is_empty():
		return {}
	if _flag(s, "arc:%s" % arc["id"]):
		return {}
	var choice := {}
	for c in (arc["choices"] as Array):
		if c["id"] == choice_id:
			choice = c
			break
	if choice.is_empty():
		return {}

	var failed: bool = choice.has("risk") and rng.chance(float(choice["risk"]))
	var effects: Dictionary = choice["onFail"] if (failed and choice.has("onFail")) else choice["effects"]
	Effects.apply_effects(s, effects)

	# One shot. An arc that has been answered does not come back.
	s["flags"]["arc:%s" % arc["id"]] = true
	s["counters"]["arcsAnswered"] = int(s["counters"].get("arcsAnswered", 0)) + 1

	return {
		"arc": arc,
		"text": choice["failText"] if (failed and choice.has("failText")) else choice["resultText"],
		"effects": effects,
		"failed": failed,
	}


## The effects an arc choice would apply, for the panel to show.
static func arc_choice_effects(arc: Dictionary, choice_id: String) -> Dictionary:
	for c in (arc["choices"] as Array):
		if c["id"] == choice_id:
			return c["effects"]
	return {}


# ------------------------------------------------------------- engine hooks

## The arc waiting on an answer, if there is one.
static func pending_arc(s: Dictionary) -> Dictionary:
	var id: Variant = s.get("pendingArc", null)
	return by_id(str(id)) if id != null else {}


## Rolls for an arc at the end of a month. Returns the one that fired.
static func roll_month_arcs(s: Dictionary, rng: Rng) -> Dictionary:
	if s.get("pendingArc", null) != null:
		return {}
	var arc := roll_arcs(s, rng)
	if arc.is_empty():
		return {}
	s["pendingArc"] = arc["id"]
	return arc


## Answers the pending arc. Returns what to show, or {} if there is none.
static func answer_arc(s: Dictionary, rng: Rng, choice_id: String) -> Dictionary:
	if s.get("pendingArc", null) == null:
		return {}
	var result := resolve_arc(s, rng, str(s["pendingArc"]), choice_id)
	if result.is_empty():
		return {}
	s["pendingArc"] = null
	return result


## Whether the month can end. An arc blocks it for the same reason a crisis
## does: something has arrived and it wants a decision before you move on.
static func arc_blocks_month(s: Dictionary) -> bool:
	return s.get("pendingArc", null) != null
