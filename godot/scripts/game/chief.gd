class_name Chief
extends RefCounted
## The Chief of Staff.
##
## Ported from src/game/chief.ts. She is the one fixed person in the building:
## the cabinet is drawn from a seed, the family is drawn from a seed, the
## crises are drawn from a seed — but Ruth Ellery is always Ruth Ellery,
## because she is the voice that teaches the job and a teacher who changes
## every run teaches nothing.
##
## Her lines are generated into ChiefTable and ObligationsTable. What is here
## is the condition on each one, and the order those conditions are tried in —
## the first match wins, so the table's order is as load-bearing as the
## conditions themselves. It runs most urgent to least: what is on the desk
## right now, then the country, then the person, then the machine, then the
## line for a morning when nothing is on fire.

const CHIEF_NAME := "Ruth Ellery"
const CHIEF_TITLE := "Chief of Staff"


## How much she is still holding your hand.
##
## Full guidance for the first three months, then she steps back to the
## morning brief and the things that actually need her. She never disappears
## entirely — a president with no chief of staff is not a president.
static func guidance_level(s: Dictionary) -> String:
	var month := int(s["month"])
	if month <= 3:
		return "full"
	if month <= 8:
		return "settled"
	return "distant"


static func _family_has(s: Dictionary, test: Callable) -> bool:
	for m in (s.get("family", []) as Array):
		if test.call(m):
			return true
	return false


## Whether `id`'s condition holds right now.
static func briefing_applies(id: String, s: Dictionary) -> bool:
	match id:
		"first-day":
			return int(s["month"]) == 1 and not s["flags"].get("briefed:first-day", false)
		"first-month-cabinet":
			return int(s["month"]) == 1 and not s["flags"].get("briefed:cabinet", false)
		"first-month-address":
			return int(s["month"]) == 1 and not s["flags"].get("briefed:address", false)
		"no-actions":
			return (int(s["ap"]) == 0
				and (s["pendingCrises"] as Array).is_empty()
				and s.get("pendingArc", null) == null)
		"crisis-waiting":
			return not (s["pendingCrises"] as Array).is_empty()
		"arc-waiting":
			return s.get("pendingArc", null) != null
		"unrest-high":
			return float(s["nation"]["unrest"]) > 62.0
		"approval-low":
			return float(s["politics"]["approval"]) < 36.0
		"scandal-high":
			return float(s["politics"]["scandal"]) > 45.0
		"capital-empty":
			return float(s["politics"]["capital"]) < 18.0
		"stress-high":
			return float(s["personal"]["stress"]) > 72.0
		"health-low":
			return float(s["personal"]["health"]) < 45.0
		"family-neglected":
			return _family_has(s, func(m): return int(m.get("since", 0)) >= 5)
		"family-strain":
			return _family_has(s, func(m):
				return float((m.get("strain", {}) as Dictionary).get("severity", 0.0)) > 55.0)
		"cabinet-loyalty":
			for c in (s.get("cabinet", []) as Array):
				if float(c["loyalty"]) < 32.0:
					return true
			return false
		"threads-running":
			return (s["threads"] as Array).size() >= 2
		"budget-month":
			return (int(s["month"]) - 1) % 12 == 0 and int(s["month"]) > 1
		"election-near":
			return int(s["month"]) >= 40 and int(s["month"]) <= 46
		"quiet":
			return true
	push_error("chief: no condition for \"%s\"" % id)
	return false


## The line she opens the month with. Returns {id, text}.
static func morning_briefing(s: Dictionary) -> Dictionary:
	var level := guidance_level(s)
	for b in ChiefTable.BRIEFINGS:
		# A briefing with no levels is offered at every level.
		if b.has("levels") and not (b["levels"] as Array).has(level):
			continue
		if briefing_applies(str(b["id"]), s):
			return {"id": b["id"], "text": b["text"]}
	var last: Dictionary = ChiefTable.BRIEFINGS[ChiefTable.BRIEFINGS.size() - 1]
	return {"id": "quiet", "text": last["text"]}


## What she says when you do something she has an opinion about, keyed by the
## action or choice id. Deliberately sparse: she comments on the things that
## matter and stays quiet about the rest, which is what makes them land.
const REACTIONS := {
	"executive-order": "That will hold until a judge looks at it. Some of them do not, and you will not know which until they do.",
	"veto": "You have made an enemy of the Speaker and a hero of your own backbench. Both of those are expensive.",
	"pardon": "Nobody will thank you for that and four hundred families will. I would take that trade.",
	"fundraiser": "Eleven million is eleven million. I have written down who was in the room, in case it matters later.",
	"reshuffle": "You have moved the dead weight and made four people who know where the bodies are buried very unhappy.",
	"summit": "Nine time zones for a communiqué. It was worth it, but you will pay for it next week.",
	"trade-deal": "Two states will hold that against you for the rest of your life. The other forty-eight will not notice.",
	"address": "Forty-one million people. You had their attention for eleven minutes and you spent it on the thing you chose.",
	"rally": "That was for your people and nobody else. Fine. Just do not mistake it for the country.",
	"camp-david": "Two days with no staff. I have moved everything. Do not check your phone — I will know.",
	"sleep": "Good. You have been running on nothing and it was starting to show in the room.",
	"therapy": "I have kept it off the schedule. Nobody in this building needs to know, and nobody will.",
	"physical": "The letter reads well. That is the point of it, and it is also true.",
}


## Her reaction to a decision, or "" if she has none.
static func reaction(id: String) -> String:
	return str(REACTIONS.get(id, ""))


## Whether a standing obligation has been discharged. Each reads a flag some
## verb sets, which is why signing a budget and meeting the cabinet both had
## to remember to set one.
static func obligation_done(id: String, s: Dictionary) -> bool:
	match id:
		"address-house":
			return s["flags"].get("addressed:house", false) == true
		"meet-cabinet":
			return s["flags"].get("met:cabinet", false) == true
		"first-budget":
			return s["flags"].get("budget:signed", false) == true
	push_error("chief: no done-check for \"%s\"" % id)
	return false


## The obligations still outstanding, in the order she would raise them.
static func outstanding_obligations(s: Dictionary) -> Array:
	var out: Array = []
	for o in ObligationsTable.OBLIGATIONS:
		if int(s["month"]) >= int(o["from"]) and not obligation_done(str(o["id"]), s):
			out.append(o)
	return out
