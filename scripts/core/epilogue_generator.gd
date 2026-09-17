class_name EpilogueGenerator
extends RefCounted
## Builds the end-of-run legacy report from GameState.
##
## Pure game logic, no presentation: the EpilogueScreen calls
## [method generate_legacy] once and turns the returned Dictionary into labels.
## It lives in scripts/core alongside the turn manager because it is a rules
## module, not a UI widget, and it reads the GameState autoload directly.

## Cabinet seating order matches the six active roles.
const ROLE_ORDER: Array[String] = [
	"chief", "treasury", "state", "defense", "justice", "health",
]

const ROLE_TITLES := {
	"chief": "Chief of Staff",
	"treasury": "Treasury Secretary",
	"state": "Secretary of State",
	"defense": "Defense Secretary",
	"justice": "Attorney General",
	"health": "Health Secretary",
}

## Grade letter -> legacy title, from 'S' (Transformative Statesman) down to
## 'F' (Disgraced Footnote).
const GRADE_TITLES := {
	"S": "Transformative Statesman",
	"A": "Commanding Leader",
	"B": "Steady Steward",
	"C": "Forgettable Incumbent",
	"D": "Stumbling Presidency",
	"F": "Disgraced Footnote",
}


## Evaluates the current GameState and returns the four legacy sections as a
## Dictionary:
##   verdict         - "Landslide Win", "Narrow Victory", "Electoral Defeat",
##                     or "Impeached / Ousted".
##   verdict_detail  - one-sentence flavour text for that verdict.
##   grade           - single letter 'S' through 'F'.
##   grade_title     - the human title for that grade.
##   cabinet_fates   - Array[String], one line per active cabinet secretary.
##   family_legacy   - a short paragraph summarising the family's personal toll.
func generate_legacy() -> Dictionary:
	var verdict: Dictionary = _verdict()
	var grade: Dictionary = _grade()
	return {
		"verdict": str(verdict.get("label", "Electoral Defeat")),
		"verdict_detail": str(verdict.get("detail", "")),
		"grade": str(grade.get("letter", "F")),
		"grade_title": str(grade.get("title", "Disgraced Footnote")),
		"cabinet_fates": _cabinet_fates(),
		"family_legacy": _family_legacy(),
	}


# ---------------------------------------------------------------- verdicts

## Re-election outcome. Impeachment/ouster is checked first because a removed
## president never reaches the ballot box.
func _verdict() -> Dictionary:
	if _is_impeached():
		return {
			"label": "Impeached / Ousted",
			"detail": "Your presidency did not reach the ballot box. Congress removed you before the voters could.",
		}
	if int(GameState.approval) >= 65 and int(GameState.tension) <= 40:
		return {
			"label": "Landslide Win",
			"detail": "The country re-elected you in a landslide, reading your steady hand as strength.",
		}
	if int(GameState.approval) >= 50:
		return {
			"label": "Narrow Victory",
			"detail": "You squeaked back into office, but the margin was thin enough to humble any second-term agenda.",
		}
	return {
		"label": "Electoral Defeat",
		"detail": "The voters turned you out. The campaign ended with concession calls and an empty transition office.",
	}


## An impeachment/ouster happens when loyalty has collapsed, or when the story
## flags carry an impeachment/ouster beat from a crisis or scandal arc.
func _is_impeached() -> bool:
	if int(GameState.loyalty) <= 15:
		return true
	for flag in GameState.story_flags.keys():
		var flag_id := str(flag).to_lower()
		if flag_id.contains("impeach") or flag_id.contains("oust"):
			return true
	return false


# ------------------------------------------------------------------- grade

## Legacy grade from combined Approval + Budget, capped at 'F' for a president
## who was impeached or ousted no matter how healthy the ledger looks.
func _grade() -> Dictionary:
	if _is_impeached():
		return {"letter": "F", "title": str(GRADE_TITLES["F"])}
	var combined := int(GameState.approval) + int(GameState.budget)
	var letter := "F"
	if combined >= 130:
		letter = "S"
	elif combined >= 110:
		letter = "A"
	elif combined >= 90:
		letter = "B"
	elif combined >= 70:
		letter = "C"
	elif combined >= 50:
		letter = "D"
	return {"letter": letter, "title": str(GRADE_TITLES[letter])}


# ------------------------------------------------------------------- fates

## One line for each of the six active secretaries, based on advisor_trust.
## >= 70 is a lifelong ally; <= 25 is a tell-all memoir; in between they simply
## leave politics without ceremony.
func _cabinet_fates() -> Array[String]:
	var fates: Array[String] = []
	for role in ROLE_ORDER:
		var first := str(GameState.cabinet_roles.get(role, ""))
		var trust := int(GameState.advisor_trust.get(role, 50))
		var who := first if not first.is_empty() else ("your " + str(ROLE_TITLES.get(role, role)))
		if trust >= 70:
			fates.append("%s became a lifelong political ally." % who)
		elif trust <= 25:
			fates.append("%s published a scathing tell-all memoir." % who)
		else:
			fates.append("%s returned to private life without ceremony." % who)
	return fates


# ------------------------------------------------------------------ family

## Summarises the personal toll from the family story flags. Both flags can be
## set across a long run; the combined text is deliberately harsher than either
## alone.
func _family_legacy() -> String:
	var flags: Dictionary = GameState.story_flags
	var isolated := flags.has("family_isolated")
	var resentful := flags.has("spouse_resentful")
	if isolated and resentful:
		return "You sent your family away for their safety, but the distance only hardened the resentment that had already set in. Your children came home to a colder house, and your marriage carried the term's scars into private life."
	if isolated:
		return "You sent your family to the private estate for their safety. They were shielded from the cameras, but the children spent the term far from you, and the distance left its own quiet cost."
	if resentful:
		return "You kept your family in the residence to project strength. The projection held, but your spouse never forgave you for it, and the children learned to flinch at flashbulbs."
	return "Your family weathered the term intact. There were late nights and missed dinners, but no lasting rift took root."
