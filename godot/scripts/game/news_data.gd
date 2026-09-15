class_name NewsData
extends RefCounted
## Two headlines a month, drawn from whatever is actually true.
##
## Ported from src/game/news.ts. The templates are a table of conditions, and
## the port keeps them in the TypeScript's order: generate_news picks by index
## out of the *filtered* list, so reordering the table would change which
## headline a given seed prints even though every condition still read the
## same field.
##
## Each template's `when` is a function in the TypeScript, which a GDScript
## Dictionary cannot hold, so it becomes a match on the template's id -- the
## same shape BlocsData uses for the bloc targets.

const TEMPLATES := [
	{"id": "approval-high", "tone": "good", "lines": [
		"President's approval hits {approval}% as voters credit steady hand",
		"Poll: {approval}% approve, the strongest number of the term so far",
	]},
	{"id": "approval-low", "tone": "bad", "lines": [
		"Approval slides to {approval}% as allies begin distancing themselves",
		"Poll: only {approval}% approve; party strategists openly worried",
	]},
	{"id": "jobs-strong", "tone": "good", "lines": [
		"Unemployment falls to {unemployment}%, lowest in a generation",
		"Hiring surge pushes joblessness to {unemployment}%",
	]},
	{"id": "jobs-weak", "tone": "bad", "lines": [
		"Layoffs mount as unemployment reaches {unemployment}%",
		"Jobless rate climbs to {unemployment}%; manufacturing towns hit hardest",
	]},
	{"id": "inflation", "tone": "bad", "lines": [
		"Prices up again: inflation running at {inflation}%",
		"Grocery costs dominate kitchen tables as inflation holds at {inflation}%",
	]},
	{"id": "recession", "tone": "bad", "lines": [
		"Economy contracts; economists call it a recession in all but name",
		"Output shrinks for a second straight quarter",
	]},
	{"id": "boom", "tone": "good", "lines": [
		"Economy expanding at {growth}%, fastest run in years",
		"Boom talk returns as growth hits {growth}%",
	]},
	{"id": "unrest-high", "tone": "bad", "lines": [
		"Third straight weekend of protests in a dozen cities",
		"Governors activate the Guard as demonstrations spread",
	]},
	{"id": "unrest-low", "tone": "good", "lines": [
		"A quieter country: civic tension at its lowest point in years",
		"Commentators note an unfamiliar calm in national politics",
	]},
	{"id": "debt", "tone": "bad", "lines": [
		"Debt passes {debt}% of GDP; ratings agencies signal a review",
		"Interest costs now exceed the defense budget",
	]},
	{"id": "scandal", "tone": "bad", "lines": [
		"Ethics questions widen as committee requests documents",
		"A drip of disclosures the White House cannot seem to stop",
	]},
	{"id": "healthcare", "tone": "bad", "lines": [
		"Rural hospitals close at record pace",
		"Emergency rooms report the worst wait times on record",
	]},
	{"id": "infrastructure", "tone": "bad", "lines": [
		"Another bridge closed for emergency inspection",
		"Water main failures leave two cities boiling their tap water",
	]},
	{"id": "standing-high", "tone": "good", "lines": [
		"Allies call it the strongest alliance footing in a decade",
		"Summit ends with signatures on every line",
	]},
	{"id": "standing-low", "tone": "bad", "lines": [
		"Allies quietly explore arrangements that do not involve us",
		"Diplomats describe a country talking mostly to itself",
	]},
	{"id": "marriage", "tone": "bad", "lines": [
		"First Family spends another weekend apart, aides say nothing",
		"Speculation about the residence that the press office will not address",
	]},
	{"id": "health", "tone": "bad", "lines": [
		"Questions about the president's stamina after a visibly hard week",
		"Physician's office declines to comment on schedule changes",
	]},
	{"id": "quiet", "tone": "neutral", "lines": [
		"Congress returns to a docket nobody expects to finish",
		"A quiet week in Washington, which nobody trusts",
		"Sunday shows chew over the same three questions",
		"Governors gather to complain about the same funding formula",
	]},
]


static func _matches(id: String, s: Dictionary) -> bool:
	var n: Dictionary = s["nation"]
	match id:
		"approval-high": return float(s["politics"]["approval"]) > 60.0
		"approval-low": return float(s["politics"]["approval"]) < 38.0
		"jobs-strong": return float(n["unemployment"]) < 4.0
		"jobs-weak": return float(n["unemployment"]) > 6.5
		"inflation": return float(n["inflation"]) > 4.5
		"recession": return float(n["growth"]) < 0.0
		"boom": return float(n["growth"]) > 3.4
		"unrest-high": return float(n["unrest"]) > 62.0
		"unrest-low": return float(n["unrest"]) < 25.0
		"debt": return float(n["debtToGdp"]) > 125.0
		"scandal": return float(s["politics"]["scandal"]) > 45.0
		"healthcare": return float(n["sectors"]["healthcare"]) < 32.0
		"infrastructure": return float(n["sectors"]["infrastructure"]) < 30.0
		"standing-high": return float(n["standing"]) > 70.0
		"standing-low": return float(n["standing"]) < 35.0
		"marriage": return float(s["personal"]["marriage"]) < 30.0
		"health": return float(s["personal"]["health"]) < 45.0
		"quiet": return true
	push_error("news: no condition for \"%s\"" % id)
	return false


static func _fill(line: String, s: Dictionary) -> String:
	return (line
		.replace("{approval}", str(Effects.js_round(float(s["politics"]["approval"]))))
		.replace("{unemployment}", Effects.js_fixed1(float(s["nation"]["unemployment"])))
		.replace("{inflation}", Effects.js_fixed1(float(s["nation"]["inflation"])))
		.replace("{growth}", Effects.js_fixed1(float(s["nation"]["growth"])))
		.replace("{debt}", str(Effects.js_round(float(s["nation"]["debtToGdp"])))))


## Two headlines a month, and never one the reader saw in the last couple.
static func generate_news(s: Dictionary, rng: Rng) -> Array:
	var matching: Array = []
	for t in TEMPLATES:
		if _matches(t["id"], s):
			matching.append(t)
	var chosen: Array = []
	var used := {}
	var recent: Array = s["news"]
	for i in mini(4, recent.size()):
		used[recent[i]["headline"]] = true
	var wanted: int = mini(2, matching.size())
	var attempt := 0
	while attempt < 8 and chosen.size() < wanted:
		attempt += 1
		var t: Dictionary = rng.pick(matching)
		var line := _fill(str(rng.pick(t["lines"])), s)
		if used.has(line):
			continue
		used[line] = true
		chosen.append({"month": int(s["month"]), "headline": line,
			"source": rng.pick(CoreData.OUTLETS), "tone": t["tone"]})
	return chosen


static func push_news(s: Dictionary, items: Array) -> void:
	var news: Array = s["news"]
	for i in range(items.size() - 1, -1, -1):
		news.push_front(items[i])
	if news.size() > 60:
		news.resize(60)
