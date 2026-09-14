class_name ActionsData
extends RefCounted
## Static actions and station catalogue.

const STATION_ORDER := ["desk", "budget", "staff", "floor", "phone", "press", "family", "rest", "brief", "watch"]

const STATION_INFO := {
	"desk": {"name": "The Resolute Desk", "blurb": "Executive orders, clemency, vetoes: the things you can do alone."},
	"floor": {"name": "The House Floor", "blurb": "Where a bill becomes a law, or does not, in front of four hundred people."},
	"budget": {"name": "The Cabinet Table", "blurb": "Appropriations, taxes, and the arithmetic nobody wants to look at."},
	"phone": {"name": "The Secure Line", "blurb": "Allies, adversaries, and the world outside the fence."},
	"press": {"name": "The Press Pool", "blurb": "Cameras, questions, and whatever the country thinks it saw."},
	"family": {"name": "The Residence", "blurb": "The people who knew you before any of this."},
	"staff": {"name": "The West Wing", "blurb": "Your cabinet, your party, and the votes on the Hill."},
	"rest": {"name": "The Private Study", "blurb": "Sleep, the physician, and the hour that belongs to you."},
	"brief": {"name": "The Situation Table", "blurb": "What the agencies know this morning, and which way it is trending."},
	"watch": {"name": "The Watch Floor", "blurb": "The situations that are still running, and the only place you can work them."},
}

const ACTIONS := [
	{"id": "executive-order", "station": "desk", "label": "Sign an executive order", "detail": "Act alone. Fast, narrow, and reversible by the next person to sit here — or by a judge before that.", "ap": 1, "capitalCost": 6, "cooldown": 2, "effects": {"nation.sectors.justice": 2, "nation.sectors.environment": 2, "politics.party": 3, "nation.unrest": 2, "politics.approval": 1}, "consequence": {"unlocks": ["court-defeat"], "heats": {"justice": 6}}, "resultText": "Three agencies have new marching orders by Monday and a district judge has the filing by Friday."},
	{"id": "pardon", "station": "desk", "label": "Grant clemency", "detail": "Commute a batch of sentences the Justice Department flagged years ago.", "ap": 1, "cooldown": 8, "effects": {"nation.sectors.justice": 3, "nation.unrest": -2, "personal.integrity": 3, "politics.media": 2, "politics.approval": -1}, "resultText": "Four hundred and eleven sentences commuted. Two op-eds call it courage; four call it weakness."},
	{"id": "veto", "station": "desk", "label": "Veto the opposition bill", "detail": "Kill the bill Congress sent over and dare them to override. Daring them is the risky part.", "ap": 1, "capitalCost": 8, "cooldown": 6, "effects": {"politics.party": 8, "politics.house": -2, "politics.senate": -2, "politics.media": -2, "politics.approval": -1}, "risk": 0.14, "onFail": {"politics.party": -10, "politics.house": -4, "politics.senate": -4, "politics.approval": -3, "politics.media": -4}, "failText": "The override succeeds by four votes. Congress has just overturned you for the first time this term.", "resultText": "The override attempt fails by nine votes. Your side is delighted; the Hill is not."},
	{"id": "whip", "station": "floor", "label": "Work the Hill personally", "detail": "Calls, favours, and a long afternoon in the Speaker's office.", "ap": 1, "capitalCost": 4, "cooldown": 3, "effects": {"politics.house": 2.5, "politics.senate": 2, "politics.party": 3, "personal.stress": 6, "personal.family": -2}, "resultText": "Six members move from 'no' to 'undecided', which in this town is a landslide."},
	{"id": "fundraiser", "station": "staff", "label": "Headline a fundraiser", "detail": "An evening of handshakes for money that is not, technically, yours. Someone is always counting who thanked whom.", "ap": 1, "cooldown": 3, "effects": {"politics.party": 7, "politics.capital": 5, "personal.integrity": -2, "politics.media": -1, "personal.family": -3, "personal.stress": 4}, "consequence": {"heats": {"scandal": 5}}, "resultText": "Eleven million in a hotel ballroom. Your party chair stops returning other people's calls."},
	{"id": "reshuffle", "station": "staff", "label": "Reshuffle the cabinet", "detail": "Move the dead weight. It buys a headline and costs you loyalty — and whoever you cut has a phone.", "ap": 2, "capitalCost": 10, "cooldown": 12, "effects": {"politics.capital": 6, "politics.media": 4, "politics.approval": 2, "politics.party": -4, "personal.stress": 6}, "risk": 0.22, "onFail": {"politics.capital": 2, "politics.media": -6, "politics.approval": -3, "politics.party": -6, "politics.scandal": 8}, "failText": "Three new faces, and the fourth one gives an interview about what it was really like. It runs for a week.", "resultText": "Three new faces, one genuinely good one. The reset lasts about six weeks."},
	{"id": "summit", "station": "phone", "label": "Fly to a summit", "detail": "Nine time zones, four days, and a communiqué nobody will read.", "ap": 2, "capitalCost": 5, "cooldown": 6, "effects": {"nation.standing": 9, "nation.security": 3, "nation.growth": 0.1, "personal.stress": 9, "personal.health": -2, "personal.family": -5}, "consequence": {"eases": {"id": "alliance-drift", "by": 18}}, "resultText": "A joint statement with real commitments in it, and a photograph you will use for two years."},
	{"id": "trade-deal", "station": "phone", "label": "Push a trade agreement", "detail": "Market access for someone's exporters, pain for someone's factory town.", "ap": 1, "capitalCost": 6, "cooldown": 8, "effects": {"nation.growth": 0.22, "nation.standing": 4, "nation.inflation": -0.15, "politics.party": -4, "nation.unrest": 2}, "consequence": {"eases": {"id": "alliance-drift", "by": 10}, "heats": {"labour": 8}}, "resultText": "Tariffs fall in eleven categories. Two states will hold this against you forever."},
	{"id": "intel-brief", "station": "phone", "label": "Sit the full intelligence brief", "detail": "The long version, with the analysts in the room instead of the summary.", "ap": 1, "cooldown": 4, "effects": {"nation.security": 4, "personal.stress": 4}, "resultText": "You now know three things you cannot tell anyone, and one of them will matter in a month."},
	{"id": "address", "station": "press", "label": "Address the nation", "detail": "Prime time from the Oval. You get one of these every few months before it stops working.", "ap": 1, "capitalCost": 4, "cooldown": 4, "effects": {"politics.approval": 5, "politics.media": 2, "nation.unrest": -2, "personal.stress": 5}, "resultText": "Forty-one million watch. The bump is real, and it has a half-life of about five weeks."},
	{"id": "rally", "station": "press", "label": "Hold a rally", "detail": "An arena, your people, and no follow-up questions. The people it doesn't feed notice too.", "ap": 1, "cooldown": 2, "effects": {"politics.party": 8, "politics.approval": 2, "nation.unrest": 2, "personal.stress": 5, "personal.family": -3, "politics.media": -2}, "consequence": {"heats": {"politics": 6}}, "resultText": "Eighteen thousand people and a clip that runs for two days. Your base is fed."},
	{"id": "campaign-swing", "station": "press", "label": "Campaign swing", "detail": "Six states in nine days. Only worth it when the election is close enough to smell.", "ap": 2, "capitalCost": 6, "cooldown": 2, "available": "campaign_swing", "effects": {"politics.approval": 5, "politics.party": 6, "personal.stress": 12, "personal.health": -3, "personal.family": -6, "personal.marriage": -4}, "resultText": "Nine days, twenty-two events, and a voice that will not come back until Thursday."},
	{"id": "camp-david", "station": "family", "label": "A weekend at Camp David", "detail": "Everyone comes. No staff, no cameras, and the country runs itself for two days.", "ap": 2, "cooldown": 5, "target": "all", "attention": 11, "effects": {"personal.stress": -18, "personal.health": 3, "personal.sleepDebt": -12, "politics.capital": -4}, "resultText": "Two days of walking, cards, and terrible movies. You come back recognisable to your own family."},
	{"id": "sleep", "station": "rest", "label": "Protect the schedule", "detail": "No 5am calls for two weeks. The staff will hate it and do it anyway.", "ap": 1, "cooldown": 2, "effects": {"personal.stress": -13, "personal.health": 2, "personal.sleepDebt": -26}, "resultText": "Fourteen nights of real sleep. Everything is still on fire; you are simply awake for it."},
	{"id": "exercise", "station": "rest", "label": "Train with the physician", "detail": "Five mornings a week, cardiology's plan, no negotiating.", "ap": 1, "cooldown": 2, "effects": {"personal.health": 3, "personal.fitness": 9, "personal.stress": -5}, "resultText": "Resting heart rate down nine points in a month. The doctor stops looking at you like that."},
	{"id": "physical", "station": "rest", "label": "Full physical at Walter Reed", "detail": "The complete workup, results released to the public as tradition demands.", "ap": 1, "cooldown": 8, "effects": {"personal.health": 3, "politics.media": 3, "personal.integrity": 2, "personal.stress": -2}, "resultText": "Bloodwork, imaging, and a two-page letter the networks read out line by line."},
	{"id": "therapy", "station": "rest", "label": "See someone about it", "detail": "A standing appointment, off the official schedule. It stays off it.", "ap": 1, "cooldown": 3, "effects": {"personal.stress": -16, "personal.health": 2, "personal.sleepDebt": -8}, "resultText": "An hour a week where nobody wants anything from you. It is the most useful hour on the calendar."},
	{"id": "read", "station": "rest", "label": "Read something that isn't a briefing", "detail": "History, mostly. Other people's disasters are restful.", "ap": 1, "cooldown": 2, "effects": {"personal.stress": -8, "personal.health": 1, "politics.capital": 2}, "resultText": "Three hundred pages on a predecessor who had it worse. Oddly, it helps."},
	{"id": "manage-condition", "station": "rest", "label": "Do what the cardiologist said", "detail": "The medication, the monitoring, and the half of the schedule they want cut.", "ap": 1, "cooldown": 2, "available": "manage_condition", "effects": {"personal.health": 6, "personal.fitness": 4, "personal.stress": -6, "politics.capital": -3}, "resultText": "Numbers back where they should be, and two events dropped from the week to get them there."},
]

const DOMAIN_NAME := {"economy": "the economy", "labour": "labour", "foreign": "the alliance", "war": "the war", "security": "security", "justice": "the courts", "scandal": "the scandal", "health": "public health", "climate": "the climate", "politics": "the Hill", "personal": "you"}


static func _for_child(child: Dictionary) -> Array:
	var show_up: Dictionary
	if child["age"] <= 18:
		show_up = {"id": "show-up-" + child["id"], "station": "family", "label": "Show up for " + child["name"], "detail": "A game, a recital, whatever it is this month. Be in the third row.", "ap": 1, "cooldown": 3, "target": child["id"], "attention": 9, "effects": {"politics.media": 2, "personal.stress": -3, "politics.capital": -2}, "resultText": "You are in the third row for all of it. " + child["name"] + " pretends not to look over. " + child["name"] + " looks over."}
	else:
		show_up = {"id": "visit-" + child["id"], "station": "family", "label": "Go and see " + child["name"], "detail": "Their place, their terms, no press pool. Two vehicles and an apology.", "ap": 1, "cooldown": 4, "target": child["id"], "attention": 10, "effects": {"personal.stress": -5, "politics.capital": -3}, "resultText": "Four hours in a flat you have never been to. " + child["name"] + " cooks. It is not good and you say it is."}
	return [
		{"id": "call-" + child["id"], "station": "family", "label": "Call " + child["name"], "detail": "Twenty minutes on the residence line, badly timed for both of you.", "ap": 1, "cooldown": 1, "target": child["id"], "attention": 5, "effects": {"personal.stress": -3}, "resultText": child["name"] + " talks for nineteen minutes about something you do not follow. It is the best part of the week."},
		show_up,
	]


static func _for_spouse(spouse: Dictionary) -> Array:
	return [
		{"id": "date-night", "station": "family", "label": "Take " + spouse["name"] + " out", "detail": "A restaurant, a motorcade, and forty agents pretending not to exist.", "ap": 1, "cooldown": 3, "target": spouse["id"], "attention": 8, "effects": {"personal.stress": -6, "politics.media": 1}, "resultText": "You get most of a meal before someone asks for a photo. " + spouse["name"] + " laughs about it. It counts."},
		{"id": "spouse-listen", "station": "family", "label": "Ask " + spouse["name"] + " how it is going", "detail": "And then do not check the phone once, whatever the answer turns out to be.", "ap": 1, "cooldown": 2, "target": spouse["id"], "attention": 7, "effects": {"personal.stress": -4, "personal.integrity": 1}, "resultText": "An hour, most of it theirs. Some of what you hear you did not want to know."},
	]


static func residence_actions(state: Dictionary) -> Array:
	var out: Array = []
	var spouse := People.spouse_of(state)
	if not spouse.is_empty():
		out.append_array(_for_spouse(spouse))
	for child in People.children_of(state):
		out.append_array(_for_child(child))
	return out


static func hottest_domain(state: Dictionary) -> Dictionary:
	var heat: Dictionary = state.get("heat", {})
	var best := {}
	for tag in DOMAIN_NAME.keys():
		var value: float = heat.get(tag, 0.0)
		if best.is_empty() or value > best["heat"]:
			best = {"tag": tag, "heat": value}
	if not best.is_empty() and best["heat"] > 8.0:
		return best
	return {}


static func brief_action(state: Dictionary) -> Array:
	var hot := hottest_domain(state)
	if hot.is_empty():
		return []
	var name: String = DOMAIN_NAME[hot["tag"]]
	var key: String = hot["tag"]
	return [{"id": "daily-brief", "station": "brief", "label": "Take the morning brief on " + name, "detail": "Forty minutes, no aides, and the version with the sources in it. You will not enjoy all of it.", "ap": 1, "cooldown": 1, "effects": {"nation.security": 1, "personal.stress": 1}, "consequence": {"heats": {key: -12}}, "resultText": "They walk you through it twice. You come out knowing what is coming in " + name + ", which is not the same as being able to stop it, and is worth more than it sounds."}]


static func watch_actions(state: Dictionary) -> Array:
	var out: Array = []
	for thread in (state.get("threads", []) as Array):
		var competence := People.crisis_competence(state, thread.get("tags", []))
		var ease_by := int(round(6.0 + competence / 8.0))
		var risk := clampf((70.0 - competence) / 120.0, 0.0, 0.3)
		var age: int = thread.get("age", 0)
		out.append({
			"id": "work-" + thread["id"], "station": "watch", "label": "Work it: " + thread["label"],
			"detail": "Running at " + str(int(round(thread["intensity"]))) + ", " + str(age + 1) + (" month" if age == 0 else " months") + " in. An afternoon on one thing, with the people whose job it is.",
			"ap": 1, "cooldown": 1, "effects": {"personal.stress": 2},
			"consequence": {"eases": {"id": thread["id"], "by": ease_by}}, "risk": risk,
			"onFail": {"personal.stress": 3, "politics.capital": -2},
			"failConsequence": {"escalates": {"id": thread["id"], "by": 5}},
			"failText": "Four hours in the room and it moves the wrong way. Somebody was working from a picture of the situation that was two weeks old, and nobody in the room knew it.",
			"resultText": "You stay on the one thing until it has actually moved. It is the least presidential afternoon of the month and it is the one that counts.",
		})
	return out


static func situation_actions(state: Dictionary) -> Array:
	var out: Array = brief_action(state)
	out.append_array(watch_actions(state))
	return out


static func action_available(action: Dictionary, state: Dictionary) -> bool:
	var key: String = action.get("available", "")
	if key == "":
		return true
	if key == "campaign_swing":
		return state["month"] >= 34
	if key == "manage_condition":
		return state["personal"].has("condition")
	return true


static func actions_for(state: Dictionary, station: String) -> Array:
	var pool: Array = []
	if station == "family":
		pool = ACTIONS.duplicate()
		pool.append_array(residence_actions(state))
	elif station == "brief" or station == "watch":
		pool = ACTIONS.duplicate()
		pool.append_array(situation_actions(state))
	else:
		pool = ACTIONS.duplicate()
	var out: Array = []
	for a in pool:
		if a["station"] != station:
			continue
		if not action_available(a, state):
			continue
		out.append(a)
	return out


static func action_by_id(state: Dictionary, action_id: String) -> Dictionary:
	for a in ACTIONS:
		if a["id"] == action_id:
			return a
	if state.has("family"):
		for a in residence_actions(state):
			if a["id"] == action_id:
				return a
	for a in situation_actions(state):
		if a["id"] == action_id:
			return a
	return {}


static func action_cooldown_left(state: Dictionary, action: Dictionary) -> int:
	var cooldown: int = action.get("cooldown", 0)
	if cooldown == 0:
		return 0
	var last: Variant = state.get("actionHistory", {}).get(action["id"])
	if last == null:
		return 0
	return maxi(0, cooldown - (int(state["month"]) - int(last)))


static func can_afford(state: Dictionary, action: Dictionary) -> bool:
	if state["ap"] < int(action.get("ap", 1)):
		return false
	if float(action.get("capitalCost", 0.0)) > state["politics"]["capital"]:
		return false
	return action_cooldown_left(state, action) == 0
