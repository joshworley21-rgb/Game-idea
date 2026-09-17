class_name EpilogueGenerator
extends RefCounted
## Builds the end-of-run legacy report from GameState.
##
## Pure game logic, no presentation: the EpilogueScreen calls
## [method generate_legacy] once and turns the returned Dictionary into labels.

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


## Evaluates the current GameState and returns the legacy report as a
## Dictionary:
##   verdict        - "Landslide Win", "Narrow Victory", "Electoral Defeat",
##                    or "Impeached / Ousted".
##   cabinet_fates  - Array[String], one line per secretary who became a
##                    lifelong ally (trust >= 70) or wrote a tell-all memoir
##                    (trust <= 25).
func generate_legacy() -> Dictionary:
	return {
		"verdict": _reelection_verdict(),
		"cabinet_fates": _cabinet_fates(),
	}


# ---------------------------------------------------------------- verdicts

## Re-election outcome. Impeachment is checked first because a removed
## president never reaches the ballot box.
func _reelection_verdict() -> String:
	if _is_impeached():
		return "Impeached / Ousted"
	if int(GameState.approval) >= 65 and int(GameState.tension) <= 40:
		return "Landslide Win"
	if int(GameState.approval) >= 50:
		return "Narrow Victory"
	return "Electoral Defeat"


## Impeachment triggers only when the leaked-audio story has been threatened
## into the open AND the president's own party loyalty has collapsed.
func _is_impeached() -> bool:
	return GameState.story_flags.has("press_threatened") and int(GameState.loyalty) <= 15


# ------------------------------------------------------------------- fates

## One line for each of the six active secretaries, based on advisor_trust.
## >= 70 is a lifelong ally; <= 25 is a tell-all memoir. Secretaries between
## those thresholds receive no legacy line.
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
	return fates
