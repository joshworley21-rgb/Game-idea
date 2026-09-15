class_name Speaker
extends RefCounted
## Who is talking.
##
## Ported from src/game/speaker.ts. A beat used to carry a bare string — "The
## Chief of Staff" — which reads as a caption rather than a person. A speaker
## carries the name, the office, the seed their face is built from, and how
## they are holding themselves.
##
## `role` is what the speaker is FOR: it resolves to whoever holds that job at
## the moment the beat is shown, so a conversation written once still works
## after a reshuffle puts somebody else in the chair.

const OFFICE_ROLES := {
	"chief": "chief", "treasury": "treasury", "state": "state",
	"defense": "defense", "justice": "justice", "health": "health",
}


static func _secretary_for(s: Dictionary, role: String) -> Dictionary:
	if not OFFICE_ROLES.has(role):
		return {}
	var office: String = OFFICE_ROLES[role]
	for c in (s.get("cabinet", []) as Array):
		if c.get("office", "") == office:
			return c
	return {}


static func _member_of_kind(s: Dictionary, kind: String) -> Dictionary:
	for m in (s.get("family", []) as Array):
		if m.get("kind", "") == kind:
			return m
	return {}


## Turns a speaker into the person they actually are right now.
##
## Returns {name, title, seed, age, dress, mood, isPerson}. `age` is -1 for
## anyone the simulation does not track an age for; the TypeScript leaves the
## field off, which a Dictionary cannot do without the caller having to check.
static func resolve(speaker: Dictionary, s: Dictionary) -> Dictionary:
	var role := str(speaker.get("role", "narrator"))
	var mood := str(speaker.get("mood", "neutral"))

	var secretary := _secretary_for(s, role)
	if not secretary.is_empty():
		return {"name": secretary["name"], "title": secretary["title"],
			"seed": secretary["name"], "age": -1, "dress": "suit", "mood": mood,
			"isPerson": true}

	if role == "spouse" or role == "child":
		var member := _member_of_kind(s, role)
		if not member.is_empty():
			return {"name": member["name"],
				"title": "your spouse" if role == "spouse" else "your child",
				"seed": member["name"], "age": int(member["age"]),
				"dress": "smart" if role == "spouse" else "casual",
				"mood": mood, "isPerson": true}

	# The press, an ally, the room itself: a named figure with a face, but not
	# somebody the simulation tracks.
	return {
		"name": speaker.get("name", ""),
		"title": speaker.get("title", ""),
		"seed": speaker.get("name", ""),
		"age": -1,
		"dress": "smart" if role == "press" else "suit",
		"mood": mood,
		"isPerson": role != "room" and role != "narrator",
	}


## The mood a beat's text implies, when the writer has not set one. The order
## is the priority: hostile beats concerned beats amused, and so on down.
static func infer_mood(text: String) -> String:
	var t := text.to_lower()
	var tests := [
		["hostile", "\\b(hostile|demand|accus|attack|refus|angry|furious)\\b"],
		["concerned", "\\b(worried|concern|afraid|fear|anxious|grim)\\b"],
		["amused", "\\b(joke|laugh|smil|amused|dryly|wry)\\b"],
		["tired", "\\b(tired|exhaust|late|long night|drained)\\b"],
		["warm", "\\b(warm|glad|grateful|kind|gentle)\\b"],
		["guarded", "\\b(careful|guarded|measured|noncommittal|hedge)\\b"],
	]
	for pair in tests:
		var re := RegEx.new()
		re.compile(pair[1])
		if re.search(t) != null:
			return pair[0]
	return "neutral"


## A speaker for a cabinet office, for use in conversation definitions.
static func cabinet_speaker(role: String, name: String, title: String) -> Dictionary:
	return {"role": role, "name": name, "title": title}


## Picks the family member a residence beat is actually about: whoever is
## carrying the most, and failing that whoever has waited longest.
##
## The TypeScript sorts and takes the first, relying on JavaScript's sort
## being stable; this scans for the first strict maximum, which is the same
## thing without depending on sort_custom's stability.
static func family_speaker(s: Dictionary, rng: Rng) -> Dictionary:
	var members: Array = s.get("family", [])
	if members.is_empty():
		return {"role": "spouse", "name": "Your family", "title": ""}
	var pick: Dictionary = members[0]
	for m in members:
		var a := float((m.get("strain", {}) as Dictionary).get("severity", 0.0))
		var b := float((pick.get("strain", {}) as Dictionary).get("severity", 0.0))
		if a > b or (a == b and int(m.get("since", 0)) > int(pick.get("since", 0))):
			pick = m
	return {
		"role": "spouse" if pick["kind"] == "spouse" else "child",
		"name": pick["name"],
		"title": "your spouse" if pick["kind"] == "spouse" else "your child",
	}
