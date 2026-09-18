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
##   score          - the legacy score, 0-100.
##   grade          - that score as a letter, "A+" down to "F".
##   breakdown      - the four parts the score is made of, each 0-100, so the
##                    screen can show what earned the grade.
func generate_legacy() -> Dictionary:
	var breakdown := _legacy_breakdown()
	var score := _legacy_score(breakdown)
	return {
		"verdict": _reelection_verdict(),
		"cabinet_fates": _cabinet_fates(),
		"score": score,
		"grade": grade_for(score),
		"breakdown": breakdown,
	}


# ----------------------------------------------------------------- the grade

## The grade bands are the web build's, from gradeFor() in src/game/endings.ts,
## copied rather than reinvented so a B+ means the same thing in both versions
## of the game.
static func grade_for(score: int) -> String:
	if score >= 88:
		return "A+"
	if score >= 80:
		return "A"
	if score >= 72:
		return "B+"
	if score >= 64:
		return "B"
	if score >= 56:
		return "C+"
	if score >= 48:
		return "C"
	if score >= 40:
		return "D"
	return "F"


## The four parts of the score, each normalised to 0-100 and named for what a
## player would call it.
##
## The web build scores a legacy out of five sectors -- economy, society,
## standing, politics, personal -- off a nation model with growth, unemployment,
## unrest and a dozen more numbers. None of that is ported: this GameState
## carries four headline numbers, so the score is built from those four and is
## deliberately not claimed to be the same number. The bands it is read against
## are the same, which is what keeps a grade comparable.
func _legacy_breakdown() -> Dictionary:
	return {
		"approval": _clamp100(int(GameState.approval)),
		"solvency": _clamp100(int(GameState.budget)),
		"calm": _clamp100(100 - int(GameState.tension)),
		"loyalty": _clamp100(int(GameState.loyalty)),
	}


## Weighted so approval dominates and the books matter next, which is the same
## order of priorities the web build's weighting has. They sum to 1.0, so an
## opening position of 50 across the board scores 50 and grades a C -- a
## presidency that changed nothing.
func _legacy_score(breakdown: Dictionary) -> int:
	var total := (
		float(breakdown.get("approval", 0)) * 0.40
		+ float(breakdown.get("solvency", 0)) * 0.25
		+ float(breakdown.get("calm", 0)) * 0.20
		+ float(breakdown.get("loyalty", 0)) * 0.15
	)
	return _clamp100(int(roundf(total)))


func _clamp100(value: int) -> int:
	return clampi(value, 0, 100)


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
