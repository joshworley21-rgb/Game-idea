class_name ObligationsTable
extends RefCounted
## The obligations table, generated from src/game/chief.ts.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## 3 obligations. Every field here is plain data. The fields that are
## functions in the TypeScript live in Chief instead:
##
##   done -- whether the obligation has been discharged, in
##           Chief.obligation_done. Each one reads a flag a verb sets.
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how Chief knows to
## generate one.

const OBLIGATIONS := [
	{
		"id": "address-house",
		"label": "Address the joint session",
		"detail": "A new president speaks to Congress in the first weeks. It sets the year.",
		"from": 1.0,
	},
	{
		"id": "meet-cabinet",
		"label": "Meet your cabinet",
		"detail": "Six people run the departments. You have not met most of them.",
		"from": 1.0,
	},
	{
		"id": "first-budget",
		"label": "Sign an appropriations bill",
		"detail": "The government runs on money Congress has to vote for.",
		"from": 1.0,
	},
]
