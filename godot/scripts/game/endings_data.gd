class_name EndingsData
extends RefCounted
## How a presidency ends, and what it was worth.
##
## Ported from src/game/endings.ts: the three ways a term ends early, the
## legacy score, the re-election margin, and the closing text -- which names
## the people upstairs, because a presidency ending is a thing that happens to
## a family as well as to a country.
##
## One thing to know about the port. JavaScript's Array.sort has been required
## to be stable since ES2019, and both orderings here depend on that: ties are
## broken by the order the blocs and the children are declared in. sort_custom
## is documented as unstable, so every comparator below falls back to the
## original index. Godot 4.3 happens to agree without it, because eight
## elements go through an insertion sort -- so the tiebreak is defensive
## rather than a fix for a live divergence, and it stays because that
## "happens to" is otherwise the only thing holding the order up.

const CLAMP_LO := 0.0
const CLAMP_HI := 100.0


static func _clamp(v: float) -> float:
	return clampf(v, CLAMP_LO, CLAMP_HI)


## Ways a presidency ends early. Checked after every month.
## Returns {id, title, blurb}, or {} when the term survives.
static func check_fail_state(s: Dictionary) -> Dictionary:
	if float(s["personal"]["health"]) <= 8.0:
		return {"id": "health", "title": "Resignation on Medical Advice", "blurb":
			"You collapsed in the corridor outside the Cabinet Room. The letter to the Speaker was signed from a hospital bed nine days later. Your Vice President finishes the term, and the doctors are careful to say you might have had years, had you been anyone else with any other job."}
	if float(s["politics"]["scandal"]) >= 85.0 and float(s["personal"]["integrity"]) <= 25.0:
		return {"id": "impeachment", "title": "Removed From Office", "blurb":
			"The House impeached on two articles. The Senate, after eleven days of testimony and one very bad afternoon of documents, convicted on the first. You leave by the South Lawn with the helicopter rotors already turning and the country arguing about what it all meant before you have cleared the fence line."}
	if int(s["dangerStreak"]) >= 4:
		return {"id": "collapse", "title": "A Government That Could Not Govern", "blurb":
			"Four months of approval in the twenties, cities under curfew, and a party that stopped answering the phone. The delegation that came to the residence was polite and entirely unanimous. You announce you will not seek, and will not accept, a second term, and the rest of it is logistics."}
	return {}


## Updates the rolling counter that triggers the collapse ending.
static func update_danger_streak(s: Dictionary) -> void:
	var in_danger: bool = (float(s["politics"]["approval"]) < 24.0
		and float(s["nation"]["unrest"]) > 72.0)
	s["dangerStreak"] = int(s["dangerStreak"]) + 1 if in_danger else 0


## {economy, society, standing, politics, personal, total}, each 0-100.
static func score_legacy(s: Dictionary) -> Dictionary:
	var n: Dictionary = s["nation"]
	var economy := _clamp(50.0
		+ (float(n["growth"]) - 2.0) * 9.0
		- (float(n["unemployment"]) - 4.5) * 6.0
		- maxf(0.0, float(n["inflation"]) - 2.5) * 5.0
		- maxf(0.0, float(n["debtToGdp"]) - 100.0) * 0.35)
	var sectors: Dictionary = n["sectors"]
	var sector_total := 0.0
	for k in sectors:
		sector_total += float(sectors[k])
	var avg_sector := sector_total / float(sectors.size())
	var society := _clamp(avg_sector * 0.75 + (100.0 - float(n["unrest"])) * 0.25)
	var standing := _clamp(float(n["standing"]) * 0.6 + float(n["security"]) * 0.4)
	var politics := _clamp(float(s["politics"]["approval"]) * 0.5
		+ minf(30.0, float(s["counters"].get("billsPassed", 0)) * 5.0)
		+ float(s["personal"]["integrity"]) * 0.2
		- float(s["politics"]["scandal"]) * 0.2)
	var personal := _clamp(float(s["personal"]["health"]) * 0.3
		+ float(s["personal"]["marriage"]) * 0.3
		+ float(s["personal"]["family"]) * 0.3
		+ (100.0 - float(s["personal"]["stress"])) * 0.1)
	var total := _clamp(economy * 0.24 + society * 0.24 + standing * 0.16
		+ politics * 0.18 + personal * 0.18)
	return {"economy": economy, "society": society, "standing": standing,
		"politics": politics, "personal": personal, "total": total}


static func grade_for(score: float) -> String:
	if score >= 88.0: return "A+"
	if score >= 80.0: return "A"
	if score >= 72.0: return "B+"
	if score >= 64.0: return "B"
	if score >= 56.0: return "C+"
	if score >= 48.0: return "C"
	if score >= 40.0: return "D"
	return "F"


## Margin of the re-election result, in points. Positive means a win.
##
## Elections are won bloc by bloc. Turnout is not uniform: a constituency that
## likes you turns out for you, and one that has given up on you stays home,
## which cuts both ways.
static func election_margin(s: Dictionary) -> float:
	var margin := 0.0
	for def in CoreData.BLOCS:
		var support := float(s["blocs"].get(def["key"], 50.0))
		# Enthusiasm at the extremes, apathy in the middle.
		var turnout := 0.75 + absf(support - 50.0) / 100.0
		margin += float(def["weight"]) * turnout * (support - 50.0) * 2.2
	return (margin
		+ (float(s["nation"]["growth"]) - 2.0) * 1.5
		- maxf(0.0, float(s["nation"]["inflation"]) - 3.0) * 1.5
		+ (float(s["politics"]["party"]) - 55.0) * 0.12
		- float(s["politics"]["scandal"]) * 0.1)


## The constituencies that decided it, for the ending text. Furthest from the
## middle first; ties keep the order CoreData.BLOCS declares them in.
static func decisive_blocs(s: Dictionary) -> Array:
	var rows: Array = []
	for i in CoreData.BLOCS.size():
		var def: Dictionary = CoreData.BLOCS[i]
		rows.append({"name": def["short"], "support": float(s["blocs"].get(def["key"], 50.0)),
			"i": i})
	rows.sort_custom(func(a, b):
		var da := absf(float(a["support"]) - 50.0)
		var db := absf(float(b["support"]) - 50.0)
		if da == db:
			return int(a["i"]) < int(b["i"])
		return da > db)
	return rows.slice(0, 3)


## What the four years did to the people upstairs, by name.
static func _personal_coda(s: Dictionary) -> String:
	var p: Dictionary = s["personal"]
	var spouse := People.spouse_of(s)
	var kids := People.children_of(s)
	var them: String = spouse["name"] if not spouse.is_empty() else "your spouse"
	var kid_names := ""
	if kids.size() == 2:
		kid_names = "%s and %s" % [kids[0]["name"], kids[1]["name"]]
	else:
		var names: Array[String] = []
		for k in kids:
			names.append(str(k["name"]))
		kid_names = ", ".join(names)
		if kid_names.is_empty():
			kid_names = "your children"
	# The child who took the worst of it gets named specifically. The
	# TypeScript sorts by bond and takes the first, and a stable sort makes
	# that the *earliest-declared* child among equals -- which is what this
	# scan gives, because it only replaces on a strictly lower bond.
	var worst := {}
	for k in kids:
		if worst.is_empty() or float(k["bond"]) < float(worst["bond"]):
			worst = k

	var marriage := float(p["marriage"])
	var family := float(p["family"])
	var health := float(p["health"])
	var condition: Variant = p.get("condition", null)
	var has_condition: bool = condition != null and str(condition) != ""

	if marriage < 25.0 and family < 30.0:
		return ("You go home to a house where the arguments have already been had and nobody lives with you any more. "
			+ them + " left the residence before you did. " + kid_names
			+ " call on birthdays. The presidency took the whole family, and it took it in pieces small enough that you never had to notice on any particular Tuesday.")
	if marriage < 30.0:
		return ("The separation from " + them
			+ " is announced through a lawyer three months after you leave. It is reported respectfully and briefly, and you find you cannot argue with a single line of it.")
	if family < 30.0:
		var aside := ""
		if not worst.is_empty():
			aside = " " + str(worst["name"]) + " is polite in the way that takes practice."
		return (kid_names + " are polite at the library dedication. They are polite at Thanksgiving."
			+ aside
			+ " You spend the rest of your life trying to get back to a version of them you last saw before the motorcade.")
	if health < 35.0:
		var clause := ""
		if has_condition:
			clause = ", where " + str(condition) + " finally gets the attention it wanted four years ago"
		return ("You spend most of the first year out of office in cardiology waiting rooms" + clause
			+ ". The job was worth it, you tell people, and about half the time you believe it. "
			+ them + " drives you to the appointments.")
	if marriage > 70.0 and family > 70.0 and health > 60.0:
		return ("You walk out of the building with " + them + ", with " + kid_names
			+ ", and with most of your health intact. Almost nobody manages all three. It is, quietly, the achievement you are proudest of.")
	return ("You leave tired, still married to " + them
		+ ", and mostly on speaking terms with " + kid_names
		+ " — which the historians will never score and your family will never forget.")


static func _nation_coda(s: Dictionary, legacy: Dictionary) -> String:
	var total := float(legacy["total"])
	if total >= 78.0:
		return "The country you hand over is measurably better than the one you were given: working, solvent, and calmer than it has any right to be. Your successor will spend eight years being compared to you, and will not enjoy it."
	if total >= 60.0:
		return "A solid term. Some of it worked, some of it stalled in the Senate, and the parts that worked will be attributed to the economy for at least a decade."
	if total >= 45.0:
		return "A middling presidency: some real accomplishments, an unresolved deficit, and a country that mostly stayed on its feet. The verdict will keep moving for thirty years."
	if float(s["nation"]["unrest"]) > 60.0:
		return "You leave a country angrier than you found it, with problems that were manageable in your first year and are not manageable now."
	return "The consensus forms early and hardens: a term spent reacting, with little of it standing five years later."


## `fail` is the Dictionary check_fail_state returned, or {} for a full term.
## Returns {id, title, blurb, reelected, legacy, grade}; `reelected` is null
## when the president chose not to run.
static func build_ending(s: Dictionary, rng: Rng, fail: Dictionary) -> Dictionary:
	var legacy := score_legacy(s)
	var total := float(legacy["total"])
	if not fail.is_empty():
		return {
			"id": fail["id"],
			"title": fail["title"],
			"blurb": str(fail["blurb"]) + "\n\n" + _personal_coda(s),
			"reelected": false,
			"legacy": int(round(total * 0.6)),
			"grade": grade_for(total * 0.6),
		}

	var ran: bool = s["runningForReelection"]
	var margin := election_margin(s) + rng.range_float(-4.0, 4.0)
	var reelected: bool = margin > 0.0 if ran else false
	var parts: Array[String] = []

	if not ran:
		parts.append("You announced in the spring that you would not seek a second term. The room went quiet in a way that told you a lot of people had been waiting to hear it, and a few had not.")
	elif reelected:
		parts.append("You win a second term comfortably, carrying states your own campaign had written off in the summer." if margin > 8.0
			else "You win a second term by a margin thin enough that three counties spend a week counting. It counts the same.")
	else:
		parts.append("You lose by a point and a half. The concession call is short and the drive back from the hotel is very long." if margin > -4.0
			else "You lose, and not narrowly. The country decided somewhere around the middle of year three and never really revisited it.")

	# Name the coalition that decided it: an election is people, not a number.
	var won: Array[String] = []
	var lost: Array[String] = []
	for b in decisive_blocs(s):
		if float(b["support"]) >= 55.0:
			won.append(str(b["name"]))
		elif float(b["support"]) < 45.0:
			lost.append(str(b["name"]))
	if not won.is_empty() or not lost.is_empty():
		var clauses: Array[String] = []
		if not won.is_empty():
			clauses.append(" and ".join(won) + " stayed with you")
		if not lost.is_empty():
			clauses.append(" and ".join(lost) + " did not")
		parts.append(", and ".join(clauses) + ".")

	parts.append(_nation_coda(s, legacy))
	parts.append(_personal_coda(s))

	var title := "A Single Term"
	if not ran:
		title = "One Term, By Choice"
	elif reelected:
		title = "Four More Years"

	return {
		"id": "reelected" if reelected else "single-term",
		"title": title,
		"blurb": "\n\n".join(parts),
		"reelected": reelected if ran else null,
		"legacy": int(round(total)),
		"grade": grade_for(total),
	}


static func is_term_over(s: Dictionary) -> bool:
	return int(s["month"]) > CoreData.TERM_MONTHS
