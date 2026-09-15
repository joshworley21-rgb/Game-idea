class_name ConversationsData
extends RefCounted
## Meetings, played out rather than resolved in one click.
##
## Ported from src/game/conversations.ts and the six modules under
## src/game/conversations/. Each meeting applies its effects beat by beat, and
## what you say first can open or close what you are offered next — which is
## the whole reason these are not flat actions.
##
## The beats themselves are generated into ConversationsTable. What is here is
## the two kinds of function a Dictionary cannot hold, and they have different
## signatures, so they are two separate matches:
##
##   available_for(id, state)   -- whether the meeting is on the calendar at
##                                 all. Only the two that open the term use
##                                 it, and both are gated to the first months
##                                 and to not having happened yet.
##   option_requires(conversation_id, option_id, path)
##                              -- whether an option is offered, given what
##                                 you have already said. This reads the path
##                                 through the meeting, not the state.


## Whether `id` can be started right now. A meeting with no gate is always on.
static func available_for(id: String, s: Dictionary) -> bool:
	match id:
		"address-house":
			return int(s["month"]) <= 4 and not s["flags"].get("addressed:house", false)
		"first-cabinet":
			return int(s["month"]) <= 3 and not s["flags"].get("met:cabinet", false)
	return true


## Whether an option is on the table, given the path taken so far.
##
## Keyed on the option id rather than on the beat as well: no two options
## within one meeting share an id, which the test checks, so the beat would be
## redundant and would only be another thing to keep in step with the table.
static func option_requires(conversation_id: String, option_id: String, path: Array) -> bool:
	match conversation_id:
		"call-ally":
			match option_id:
				"statement", "exercise":
					return path.has("reassure") or path.has("hedge")
				"trade-terms":
					return path.has("redirect")
		"family-dinner":
			match option_id:
				"engage", "reassure":
					return not path.has("work-creeps-in")
				"apologize":
					return path.has("work-creeps-in")
		"interview":
			match option_id:
				"double-down":
					return path.has("counterattack")
				"straight-answer":
					return not path.has("counterattack")
	return true


static func by_id(id: String) -> Dictionary:
	for c in ConversationsTable.CONVERSATIONS:
		if c["id"] == id:
			return c
	return {}


## Meetings open at a station right now -- availability, not cost.
static func conversations_for(s: Dictionary, station: String) -> Array:
	var out: Array = []
	for c in ConversationsTable.CONVERSATIONS:
		if c["station"] == station and available_for(str(c["id"]), s):
			out.append(c)
	return out


## The options open at `beat`, given how the meeting has gone so far.
static func options_for(conversation_id: String, beat: Dictionary, path: Array) -> Array:
	var out: Array = []
	for o in (beat["options"] as Array):
		if option_requires(conversation_id, str(o["id"]), path):
			out.append(o)
	return out
