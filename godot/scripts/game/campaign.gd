class_name Campaign
extends RefCounted
## The six weeks before the oath.
##
## Ported from src/game/campaign.ts. There is no game state yet — no nation,
## no cabinet, nothing but a name, a party and a story about how you got here
## — so the campaign carries its own small shape rather than reusing a
## conversation. What it produces is a bag of deltas laid over the
## seed-jittered opening position, so the numbers the presidency starts with
## have a reason behind them beyond the roll of the dice.
##
## The beats are generated into CampaignTable for both parties, because the
## campaign is the same shape either way and only which bloc counts as "the
## base" changes.

const INTRO := "Before any of it — the desk, the cabinet, the four years — there was a campaign. Here is how yours went."
const START := "primary"


## The beats for `party`, keyed by beat id.
static func beats(party: String) -> Dictionary:
	for c in CampaignTable.CAMPAIGNS:
		if c["id"] == party:
			return c["beats"]
	push_error("campaign: no beats for party \"%s\"" % party)
	return {}


## Whether an option is offered, given what has been chosen so far. Unlike the
## conversations this reads only the path, because there is no state to read.
static func option_requires(option_id: String, path: Array) -> bool:
	match option_id:
		"ground-game":
			return path.has("grassroots")
	return true


## The options open at `beat`, given the path so far.
static func options_for(beat: Dictionary, path: Array) -> Array:
	var out: Array = []
	for o in (beat["options"] as Array):
		if option_requires(str(o["id"]), path):
			out.append(o)
	return out


## Adds every campaign delta together, for the election-night summary.
static func merge_deltas(all: Array) -> Dictionary:
	var total := {"blocs": {}}
	for d in all:
		for key in ["approval", "capital", "party", "media"]:
			if d.has(key) and float(d[key]) != 0.0:
				total[key] = float(total.get(key, 0.0)) + float(d[key])
		for k in (d.get("blocs", {}) as Dictionary):
			total["blocs"][k] = float(total["blocs"].get(k, 0.0)) + float(d["blocs"][k])
	return total
