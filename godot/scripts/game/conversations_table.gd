class_name ConversationsTable
extends RefCounted
## The conversations table, generated from src/game/conversations.ts and src/game/conversations/.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## 6 conversations. Every field here is plain data. The fields that are
## functions in the TypeScript live in ConversationsData instead:
##
##   available -- the two meetings gated to the opening of the term, in
##                ConversationsData.available_for.
##   requires  -- the options that only open if you said something earlier,
##                in ConversationsData.option_requires. These read the path
##                through the meeting, not the state.
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how ConversationsData knows to
## generate one.

const CONVERSATIONS := [
	{
		"id": "first-cabinet",
		"station": "staff",
		"label": "Meet your cabinet",
		"detail": "Six people you did not appoint are waiting in the Cabinet Room. They have read your speeches. They want to know which one you meant.",
		"ap": 1.0,
		"intro": "The Cabinet Room, ten past nine. Six secretaries, already seated, already briefed. Ruth has put you at the head of the table and left the door open behind her.",
		"startBeat": "open",
		"beats": {
			"open": {
				"id": "open",
				"speaker": {
					"role": "chief",
					"name": "Ruth Ellery",
					"title": "Chief of Staff",
					"mood": "guarded",
				},
				"prompt": "Ruth does not sit down. \"They have all read your acceptance speech,\" she says, quietly, at your shoulder. \"They have each decided which half of it you meant. This is the meeting where you tell them.\" Six faces, waiting. How do you open?",
				"options": [
					{
						"id": "ask-them",
						"label": "Ask each of them what they think the job is",
						"detail": "Slow, and it tells you more about the room than any briefing would.",
						"effects": {
							"politics.capital": 3.0,
							"politics.party": 2.0,
							"personal.stress": 2.0,
						},
						"resultText": "",
						"next": "answers",
					},
					{
						"id": "set-direction",
						"label": "Tell them what the next year is for",
						"detail": "Fast, and it makes you the author of the agenda rather than its editor.",
						"effects": {
							"politics.capital": 6.0,
							"politics.party": 4.0,
							"personal.stress": 3.0,
						},
						"resultText": "",
						"next": "direction",
					},
					{
						"id": "defer-ruth",
						"label": "Let Ruth run it, and listen",
						"detail": "She has done this four times. You have done it once, today.",
						"effects": {
							"politics.capital": 2.0,
							"personal.stress": -2.0,
							"politics.party": 1.0,
						},
						"resultText": "",
						"next": "ruth-runs",
					},
				],
			},
			"answers": {
				"id": "answers",
				"speaker": {
					"role": "treasury",
					"name": "The Treasury Secretary",
					"title": "Treasury Secretary",
					"mood": "neutral",
				},
				"prompt": "The Treasury Secretary goes first, because of course she does. She talks for four minutes about the deficit and does not once look at her notes. When she finishes, the Defense Secretary is waiting, and he has clearly been waiting since before you sat down.",
				"options": [
					{
						"id": "let-defense",
						"label": "Let him have the room",
						"detail": "He has something to say and it will be worse if he holds it.",
						"effects": {
							"nation.security": 2.0,
							"politics.party": 1.0,
							"personal.stress": 2.0,
						},
						"resultText": "",
						"next": "defense-speaks",
					},
					{
						"id": "cut-to-it",
						"label": "Cut to the decision you actually need",
						"detail": "The room has given you what it has. Now you want a vote.",
						"effects": {
							"politics.capital": 4.0,
							"politics.party": -1.0,
							"personal.stress": 1.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
				],
			},
			"defense-speaks": {
				"id": "defense-speaks",
				"speaker": {
					"role": "defense",
					"name": "The Defense Secretary",
					"title": "Defense Secretary",
					"mood": "concerned",
				},
				"prompt": "He does not talk about the deficit. He talks about a carrier group that has been at sea for seven months and a readiness report he has read twice. \"Nobody in this room has been told what we are for,\" he says. \"I would like to know before I have to spend money on it.\"",
				"options": [
					{
						"id": "give-him-a-doctrine",
						"label": "Give him a doctrine, there and then",
						"detail": "It commits you to something in front of six witnesses.",
						"effects": {
							"nation.standing": 3.0,
							"nation.security": 3.0,
							"politics.party": 2.0,
							"personal.stress": 4.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
					{
						"id": "defer-doctrine",
						"label": "Tell him the doctrine is coming, and mean it",
						"detail": "Honest, and it leaves him holding the question.",
						"effects": {
							"nation.security": -1.0,
							"politics.party": -2.0,
							"personal.integrity": 2.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
				],
			},
			"direction": {
				"id": "direction",
				"speaker": "The room",
				"prompt": "You talk for eleven minutes. Nobody interrupts, which is not the same as agreement. When you stop, the Attorney General is writing something down and the Health Secretary has not moved since you started.",
				"options": [
					{
						"id": "ask-for-objections",
						"label": "Ask who disagrees",
						"detail": "You will find out now or you will find out in six months.",
						"effects": {
							"politics.capital": 2.0,
							"politics.party": 3.0,
							"personal.stress": 3.0,
						},
						"resultText": "",
						"next": "objections",
					},
					{
						"id": "move-to-work",
						"label": "Move straight to the work",
						"detail": "The direction is set. The details are theirs.",
						"effects": {
							"politics.capital": 5.0,
							"politics.party": 1.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
				],
			},
			"objections": {
				"id": "objections",
				"speaker": {
					"role": "justice",
					"name": "The Attorney General",
					"title": "Attorney General",
					"mood": "guarded",
				},
				"prompt": "The Attorney General puts her pen down. \"I disagree with about a third of it,\" she says, and she does not soften it. \"I am telling you that now because you asked, and because the last president did not ask, and I spent two years finding out the hard way.\"",
				"options": [
					{
						"id": "thank-her",
						"label": "Thank her for it, in front of everyone",
						"detail": "It costs you nothing and it buys the whole room.",
						"effects": {
							"politics.party": 5.0,
							"politics.capital": 2.0,
							"personal.integrity": 2.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
					{
						"id": "note-it",
						"label": "Note it, and move on",
						"detail": "You have heard her. You have not agreed to anything.",
						"effects": {
							"politics.capital": 3.0,
							"politics.party": -2.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
				],
			},
			"ruth-runs": {
				"id": "ruth-runs",
				"speaker": {
					"role": "chief",
					"name": "Ruth Ellery",
					"title": "Chief of Staff",
					"mood": "neutral",
				},
				"prompt": "Ruth runs it like a woman who has run four hundred of these. Agenda, timings, who speaks when, and a hard stop at ten. You watch six people be managed by somebody who has never once raised her voice, and you learn more about your cabinet in forty minutes than any briefing would have told you.",
				"options": [
					{
						"id": "watch-and-learn",
						"label": "Keep watching",
						"detail": "There is a version of this job where you never have to do this yourself.",
						"effects": {
							"politics.capital": 3.0,
							"personal.stress": -3.0,
							"politics.party": 2.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
					{
						"id": "take-it-back",
						"label": "Take the room back halfway through",
						"detail": "It is your cabinet. It should be your meeting.",
						"effects": {
							"politics.capital": 4.0,
							"politics.party": 3.0,
							"personal.stress": 2.0,
						},
						"resultText": "",
						"next": "the-ask",
					},
				],
			},
			"the-ask": {
				"id": "the-ask",
				"speaker": {
					"role": "chief",
					"name": "Ruth Ellery",
					"title": "Chief of Staff",
					"mood": "guarded",
				},
				"prompt": "The meeting is nearly done. Ruth catches your eye from the end of the table and taps her watch. There is one thing left, and it is the thing the whole room has been waiting for: what you actually want from them this year.",
				"options": [
					{
						"id": "ask-for-loyalty",
						"label": "Ask for their loyalty",
						"detail": "They will give it. Whether they mean it is a different question.",
						"effects": {
							"politics.party": 6.0,
							"politics.capital": 3.0,
							"personal.integrity": -2.0,
						},
						"resultText": "Six people say yes. Two of them mean it, and you will not find out which two for a year.",
					},
					{
						"id": "ask-for-candour",
						"label": "Ask them to tell you when you are wrong",
						"detail": "It is a harder thing to ask for and a harder thing to give.",
						"effects": {
							"politics.party": 3.0,
							"personal.integrity": 4.0,
							"politics.capital": 1.0,
							"personal.stress": 2.0,
						},
						"resultText": "The Attorney General nods. The Treasury Secretary does not, and that tells you something too.",
					},
					{
						"id": "ask-for-results",
						"label": "Ask for results, and nothing else",
						"detail": "The job is the job. Sentiment is for other rooms.",
						"effects": {
							"politics.capital": 7.0,
							"politics.party": -2.0,
							"personal.stress": 3.0,
						},
						"resultText": "They understand the terms. It is a clean way to run a cabinet and a cold one.",
					},
				],
			},
		},
	},
	{
		"id": "address-house",
		"station": "press",
		"label": "Address the joint session",
		"detail": "The House, the Senate, the cabinet, the Court and the networks. You get one of these a year and this is the one that counts.",
		"ap": 2.0,
		"intro": "The Capitol, twenty past eight. The Sergeant at Arms has announced you twice. Four hundred and thirty-five members of the House, a hundred senators, the cabinet, the Court, and every network in the country. Ruth is in the gallery, watching.",
		"startBeat": "walk-in",
		"beats": {
			"walk-in": {
				"id": "walk-in",
				"speaker": {
					"role": "chief",
					"name": "Ruth Ellery",
					"title": "Chief of Staff",
					"mood": "guarded",
				},
				"prompt": "You have the speech in your hand and eleven minutes of the country's attention. Ruth's note, in the car, was three words: \"Pick one thing.\" What is the address for?",
				"options": [
					{
						"id": "the-country",
						"label": "The country — name the thing you were elected to fix",
						"detail": "It is the honest speech. It is also the one that commits you to a number.",
						"effects": {
							"politics.approval": 6.0,
							"politics.media": 3.0,
							"blocs.labour": 4.0,
							"blocs.young": 3.0,
							"politics.party": -2.0,
						},
						"resultText": "",
						"next": "the-country-2",
					},
					{
						"id": "the-congress",
						"label": "The Congress — tell them what you need from them",
						"detail": "A working speech, aimed at four hundred people in the room rather than forty million outside it.",
						"effects": {
							"politics.house": 5.0,
							"politics.senate": 4.0,
							"politics.capital": 6.0,
							"politics.approval": 1.0,
							"politics.media": -1.0,
						},
						"resultText": "",
						"next": "the-congress-2",
					},
					{
						"id": "the-party",
						"label": "Your own party — give them the fight they want",
						"detail": "It will be a great night for your base and a difficult morning for everyone else.",
						"effects": {
							"politics.party": 10.0,
							"blocs.activists": 6.0,
							"blocs.traditionalists": 5.0,
							"politics.approval": -2.0,
							"politics.media": -3.0,
						},
						"resultText": "",
						"next": "the-party-2",
					},
				],
			},
			"the-country-2": {
				"id": "the-country-2",
				"speaker": "The chamber",
				"prompt": "You name it plainly, and for about ninety seconds the room is completely still. Then the two sides remember themselves: your benches stand, the other side sits with their arms folded, and the networks cut to their panels before you have finished the sentence. The number you said is now the number you own.",
				"options": [
					{
						"id": "hold-the-number",
						"label": "Hold the number, whatever it costs",
						"detail": "You have made it a promise. Promises are expensive and they are worth something.",
						"effects": {
							"politics.approval": 3.0,
							"personal.integrity": 5.0,
							"politics.capital": -4.0,
							"personal.stress": 4.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
					{
						"id": "soften-it",
						"label": "Soften it in the follow-up interviews",
						"detail": "The number becomes a goal, and a goal is not a promise.",
						"effects": {
							"politics.approval": 1.0,
							"personal.integrity": -3.0,
							"politics.media": -2.0,
							"politics.capital": 2.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
				],
			},
			"the-congress-2": {
				"id": "the-congress-2",
				"speaker": "The chamber",
				"prompt": "You speak to the room rather than the cameras, and the room notices. You name three bills, two chairmen and one vote, and by the time you reach the peroration there are members on both sides taking notes. It is not a speech that will be replayed. It is a speech that will be acted on.",
				"options": [
					{
						"id": "name-the-vote",
						"label": "Name the vote and dare them to hold it",
						"detail": "It puts a date on the calendar and your name on the line.",
						"effects": {
							"politics.house": 3.0,
							"politics.capital": 4.0,
							"politics.party": -2.0,
							"personal.stress": 3.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
					{
						"id": "leave-it-open",
						"label": "Leave the timing to the leadership",
						"detail": "It keeps the goodwill and gives away the leverage.",
						"effects": {
							"politics.house": 5.0,
							"politics.senate": 3.0,
							"politics.capital": -2.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
				],
			},
			"the-party-2": {
				"id": "the-party-2",
				"speaker": "The chamber",
				"prompt": "You give them the fight. Your benches are on their feet four times before you reach the second page, and the other side stops pretending to listen. It is the best speech of your life and it was not addressed to the country.",
				"options": [
					{
						"id": "own-it",
						"label": "Own it — this is who you are",
						"detail": "The base is yours for four years. The middle is not.",
						"effects": {
							"politics.party": 6.0,
							"blocs.activists": 4.0,
							"politics.approval": -3.0,
							"blocs.suburban": -4.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
					{
						"id": "reach-out",
						"label": "Reach for the middle in the last two minutes",
						"detail": "It is a different speech bolted onto the end of this one, and it shows.",
						"effects": {
							"politics.party": -3.0,
							"politics.approval": 2.0,
							"blocs.suburban": 3.0,
							"politics.media": 1.0,
						},
						"resultText": "",
						"next": "aftermath",
					},
				],
			},
			"aftermath": {
				"id": "aftermath",
				"speaker": {
					"role": "chief",
					"name": "Ruth Ellery",
					"title": "Chief of Staff",
					"mood": "neutral",
				},
				"prompt": "The car, afterwards. Ruth has the overnight numbers on her phone and does not read them out. \"That is the year set,\" she says. \"Everything you do from here is either keeping that promise or explaining why you did not.\" She looks out of the window for a moment. \"The last one who spoke like that lasted a term. The one before lasted two.\"",
				"options": [
					{
						"id": "ask-which",
						"label": "Ask her which one you just was",
						"detail": "She has an answer. She has had it since the car door closed.",
						"effects": {
							"personal.stress": 2.0,
							"politics.capital": 2.0,
						},
						"resultText": "\"Too early,\" she says, and goes back to her phone. It is the first time she has refused you anything, and you notice it.",
					},
					{
						"id": "say-nothing",
						"label": "Say nothing, and watch the city go past",
						"detail": "There is nothing to say. It is done.",
						"effects": {
							"personal.stress": -2.0,
							"personal.integrity": 1.0,
						},
						"resultText": "You ride the rest of the way in silence. It is the most comfortable you have been since the oath.",
					},
				],
			},
		},
	},
	{
		"id": "cabinet",
		"station": "staff",
		"label": "Run a cabinet meeting",
		"detail": "Two hours of alignment. Unglamorous, and it is where capital comes from.",
		"ap": 1.0,
		"cooldown": 2.0,
		"intro": "The Cabinet Room, half past nine. Six secretaries, six different ideas about what this hour is for.",
		"startBeat": "open",
		"beats": {
			"open": {
				"id": "open",
				"speaker": {
					"role": "chief",
					"name": "The Chief of Staff",
					"title": "Chief of Staff",
					"mood": "guarded",
				},
				"prompt": "She opens with the agenda: budget pressure, a leak nobody has found the source of yet, and the appropriations vote next month. How do you run the room?",
				"options": [
					{
						"id": "listen",
						"label": "Let them argue it out first",
						"detail": "You learn more from who says what than from what you'd say yourself.",
						"effects": {
							"politics.capital": 4.0,
							"politics.party": 1.0,
							"personal.stress": 1.0,
						},
						"resultText": "",
						"next": "treasury",
					},
					{
						"id": "direct",
						"label": "Set the agenda yourself",
						"detail": "Faster, and it says who is actually in charge of this hour.",
						"effects": {
							"politics.capital": 6.0,
							"politics.party": 3.0,
							"personal.stress": 3.0,
						},
						"resultText": "",
						"next": "agenda",
					},
					{
						"id": "confront",
						"label": "Raise the leak directly, in the room",
						"detail": "Naming it costs you something if it lands badly.",
						"effects": {
							"politics.capital": 2.0,
							"personal.stress": 4.0,
							"politics.scandal": -3.0,
						},
						"risk": 0.18,
						"onFail": {
							"politics.capital": -2.0,
							"politics.party": -6.0,
							"personal.stress": 6.0,
						},
						"failText": "Someone takes it personally. The rest of the meeting is people being careful with each other.",
						"resultText": "",
						"next": "confront2",
					},
				],
			},
			"treasury": {
				"id": "treasury",
				"speaker": {
					"role": "treasury",
					"name": "The Treasury Secretary",
					"title": "Treasury Secretary",
					"mood": "neutral",
				},
				"prompt": "Letting the room argue put her case front and centre: freeze three agencies rather than touch the tax rate. Everyone is watching to see if you'll back her.",
				"options": [
					{
						"id": "back-treasury",
						"label": "Back her, publicly",
						"detail": "It is her call to defend from here.",
						"effects": {
							"politics.capital": 3.0,
							"politics.party": 2.0,
							"nation.debtToGdp": -0.6,
						},
						"resultText": "She has the room's attention now, and the freeze is hers to explain when it gets ugly.",
					},
					{
						"id": "split-treasury",
						"label": "Split the difference",
						"detail": "Freeze two, not three. Nobody fully wins.",
						"effects": {
							"politics.capital": 1.0,
							"politics.party": 1.0,
						},
						"resultText": "A compromise everyone can live with and nobody will remember fondly.",
					},
					{
						"id": "overrule-treasury",
						"label": "Overrule her, in front of everyone",
						"detail": "It will be faster. It will also be noted.",
						"effects": {
							"politics.capital": -2.0,
							"politics.party": -3.0,
							"nation.debtToGdp": 0.4,
						},
						"resultText": "She says nothing else for the rest of the meeting. Neither does anyone else.",
					},
				],
			},
			"agenda": {
				"id": "agenda",
				"speaker": "The room",
				"prompt": "Setting the agenda yourself gets through the list twice as fast — but the Attorney General wanted five minutes on the leak investigation and didn't get one.",
				"options": [
					{
						"id": "circle-back",
						"label": "Give her the five minutes anyway",
						"detail": "Run over. It matters to her department.",
						"effects": {
							"politics.capital": 2.0,
							"politics.party": 1.0,
							"politics.scandal": -2.0,
						},
						"resultText": "She gets her five minutes. The meeting runs long; nobody complains out loud.",
					},
					{
						"id": "move-on",
						"label": "Move on — there's no more time",
						"detail": "The list gets finished. The leak keeps leaking.",
						"effects": {
							"politics.capital": 3.0,
							"politics.scandal": 2.0,
						},
						"consequence": {
							"heats": {
								"scandal": 6.0,
							},
						},
						"resultText": "The agenda is clear by ten. The investigation is nobody's job in particular.",
					},
				],
			},
			"confront2": {
				"id": "confront2",
				"speaker": {
					"role": "justice",
					"name": "The Attorney General",
					"title": "Attorney General",
					"mood": "concerned",
				},
				"prompt": "Naming it broke the tension, at least. Somebody now has to actually own the investigation.",
				"options": [
					{
						"id": "assign-doj",
						"label": "Hand it to Justice, formally",
						"detail": "It stops being a rumour and starts being a process.",
						"effects": {
							"politics.scandal": -4.0,
							"politics.capital": 2.0,
							"politics.party": -1.0,
						},
						"resultText": "Justice opens a file. That alone changes what people are willing to say out loud.",
					},
					{
						"id": "handle-personally",
						"label": "Say you'll handle it yourself",
						"detail": "It signals you take it seriously. It also means it's now your problem alone.",
						"effects": {
							"personal.stress": 5.0,
							"personal.integrity": 3.0,
							"politics.scandal": -2.0,
						},
						"resultText": "Nobody argues with a president who says that in the room. Whether you follow through is a different question.",
					},
				],
			},
		},
	},
	{
		"id": "interview",
		"station": "press",
		"label": "Sit for a hostile interview",
		"detail": "An hour with someone who has done the reading and does not like you.",
		"ap": 1.0,
		"cooldown": 4.0,
		"intro": "The lights are already hot. She has done her homework, and she is not here to be liked either.",
		"startBeat": "open",
		"beats": {
			"open": {
				"id": "open",
				"speaker": {
					"role": "press",
					"name": "The correspondent",
					"title": "Political correspondent",
					"mood": "hostile",
				},
				"prompt": "She opens with the unemployment numbers, and whether you still stand behind last quarter's forecast.",
				"options": [
					{
						"id": "own-it",
						"label": "Own the number, explain the plan",
						"detail": "Slower, and it reads as honest.",
						"effects": {
							"politics.media": 5.0,
							"politics.approval": 2.0,
							"personal.integrity": 2.0,
						},
						"resultText": "",
						"next": "follow",
					},
					{
						"id": "deflect",
						"label": "Pivot to the bigger picture",
						"detail": "Safe. Also visibly a pivot.",
						"effects": {
							"politics.media": 1.0,
							"politics.approval": 1.0,
						},
						"resultText": "",
						"next": "follow",
					},
					{
						"id": "counterattack",
						"label": "Question where her numbers come from",
						"detail": "It plays well with people who already like you.",
						"effects": {
							"politics.media": -4.0,
							"politics.party": 3.0,
						},
						"risk": 0.3,
						"onFail": {
							"politics.media": -9.0,
							"politics.approval": -3.0,
						},
						"failText": "The clip is thirty seconds long and it is everywhere by morning.",
						"resultText": "",
						"next": "follow",
					},
				],
			},
			"follow": {
				"id": "follow",
				"speaker": {
					"role": "press",
					"name": "The correspondent",
					"title": "Political correspondent",
					"mood": "guarded",
				},
				"prompt": "She follows up on whether the cabinet actually agrees with you, and names the memo that leaked last month.",
				"options": [
					{
						"id": "double-down",
						"label": "Say the leak is the real story here",
						"detail": "Turn the question back on the room that produced it.",
						"effects": {
							"politics.media": -3.0,
							"politics.scandal": 3.0,
							"politics.party": 4.0,
						},
						"resultText": "It lands with people already on your side. It does not land anywhere else.",
					},
					{
						"id": "straight-answer",
						"label": "Answer straight — yes, there was disagreement, and that's fine",
						"detail": "Disagreement in a cabinet is not, on its own, a scandal.",
						"effects": {
							"politics.media": 4.0,
							"personal.integrity": 3.0,
							"politics.party": -1.0,
						},
						"resultText": "It is a strange thing to watch a politician just answer the question. The room notices.",
					},
					{
						"id": "no-comment",
						"label": "Decline to discuss internal deliberations",
						"detail": "The safest thing to say, and it reads that way.",
						"effects": {
							"politics.media": -2.0,
							"politics.scandal": -1.0,
						},
						"resultText": "\"I won't get into internal conversations,\" you say, for the fourth time this year.",
					},
				],
			},
		},
	},
	{
		"id": "call-ally",
		"station": "phone",
		"label": "Call an ally",
		"detail": "Forty minutes with a head of government who needs reassuring.",
		"ap": 1.0,
		"cooldown": 2.0,
		"intro": "Forty minutes, a translator on the line, and a head of government who needs reassuring.",
		"startBeat": "open",
		"beats": {
			"open": {
				"id": "open",
				"speaker": {
					"role": "ally",
					"name": "The Prime Minister",
					"title": "Head of government",
					"mood": "concerned",
				},
				"prompt": "They open worried: their own parliament is asking out loud whether the alliance still means what it used to.",
				"options": [
					{
						"id": "reassure",
						"label": "Reaffirm the commitment plainly",
						"detail": "No hedging. It costs nothing today and is remembered later.",
						"effects": {
							"nation.standing": 5.0,
							"personal.stress": 1.0,
						},
						"resultText": "",
						"next": "ask",
					},
					{
						"id": "hedge",
						"label": "Reassure them, but hedge on specifics",
						"detail": "Keeps your options open at home.",
						"effects": {
							"nation.standing": 2.0,
							"politics.capital": 2.0,
						},
						"resultText": "",
						"next": "ask",
					},
					{
						"id": "redirect",
						"label": "Turn it into a trade conversation instead",
						"detail": "Transactional, and they will notice that it is.",
						"effects": {
							"nation.standing": 1.0,
							"nation.growth": 0.05,
						},
						"resultText": "",
						"next": "ask",
					},
				],
			},
			"ask": {
				"id": "ask",
				"speaker": {
					"role": "ally",
					"name": "The Prime Minister",
					"title": "Head of government",
					"mood": "neutral",
				},
				"prompt": "Satisfied for now, they ask for something concrete before the call ends — a joint statement, or forces for a coming exercise.",
				"options": [
					{
						"id": "statement",
						"label": "Agree to the joint statement",
						"detail": "Words, mostly. Words that get quoted for years.",
						"effects": {
							"nation.standing": 4.0,
							"politics.capital": -2.0,
						},
						"resultText": "The statement is stronger than either side's lawyers wanted. It holds.",
					},
					{
						"id": "exercise",
						"label": "Commit forces to the exercise",
						"detail": "Real, visible, and not free.",
						"effects": {
							"nation.standing": 6.0,
							"nation.security": 2.0,
							"personal.stress": 3.0,
							"politics.capital": -3.0,
						},
						"resultText": "It is a small deployment with a large photograph. Both governments get their headline.",
					},
					{
						"id": "trade-terms",
						"label": "Give ground on trade terms",
						"detail": "The conversation you steered it toward.",
						"effects": {
							"nation.standing": 3.0,
							"nation.growth": -0.05,
							"politics.party": -2.0,
						},
						"resultText": "They get their market access. Someone at home will call it a giveaway by Friday.",
					},
					{
						"id": "stall",
						"label": "Say you'll need to take it back to your team",
						"detail": "True, and also a way of saying not yet.",
						"effects": {
							"nation.standing": -2.0,
						},
						"resultText": "They hear the delay for what it is. The call ends warm anyway.",
					},
				],
			},
		},
	},
	{
		"id": "family-dinner",
		"station": "family",
		"label": "Family dinner, no staff",
		"detail": "Upstairs, phones in a basket, the schedule cleared for two hours.",
		"ap": 1.0,
		"cooldown": 2.0,
		"intro": "Upstairs, phones in a basket. Two hours, if nothing breaks in on it.",
		"startBeat": "open",
		"beats": {
			"open": {
				"id": "open",
				"speaker": {
					"role": "spouse",
					"name": "Your spouse",
					"title": "your spouse",
					"mood": "warm",
				},
				"prompt": "Nobody brings up the polls, which took visible effort from everyone. It falls to you to set the tone.",
				"options": [
					{
						"id": "listen",
						"label": "Ask what everyone actually did today",
						"detail": "The small, unglamorous version of paying attention.",
						"effects": {
							"personal.stress": -4.0,
						},
						"target": "all",
						"attention": 6.0,
						"resultText": "",
						"next": "deep",
					},
					{
						"id": "unwind",
						"label": "Let the evening be nothing at all",
						"detail": "No agenda. Sometimes that is the gift.",
						"effects": {
							"personal.stress": -8.0,
						},
						"target": "all",
						"attention": 3.0,
						"resultText": "",
						"next": "deep",
					},
					{
						"id": "work-creeps-in",
						"label": "Take the one call you said you wouldn't",
						"detail": "Ten minutes. It is never ten minutes.",
						"effects": {
							"personal.stress": 2.0,
							"politics.capital": 3.0,
						},
						"target": "all",
						"attention": -2.0,
						"resultText": "",
						"next": "deep",
					},
				],
			},
			"deep": {
				"id": "deep",
				"speaker": {
					"role": "child",
					"name": "One of your children",
					"title": "your child",
					"mood": "concerned",
				},
				"prompt": "One of them finally says the thing that has actually been sitting there all week.",
				"options": [
					{
						"id": "engage",
						"label": "Put the fork down and actually talk it through",
						"detail": "It takes the rest of the evening. That is the point.",
						"effects": {
							"personal.stress": -3.0,
							"personal.integrity": 2.0,
						},
						"target": "all",
						"attention": 5.0,
						"resultText": "It is not solved by dessert. It is heard, which is most of what was being asked for.",
					},
					{
						"id": "reassure",
						"label": "Reassure them without digging into it",
						"detail": "Kinder in the moment, and it will come back around.",
						"effects": {},
						"target": "all",
						"attention": 2.0,
						"resultText": "It smooths the table over. It does not go away.",
					},
					{
						"id": "apologize",
						"label": "Apologize for the call, then listen",
						"detail": "Start by admitting you weren't fully there.",
						"effects": {
							"personal.stress": -2.0,
						},
						"target": "all",
						"attention": 4.0,
						"resultText": "\"I know,\" you say. \"I'm here now.\" It is enough to get the evening back.",
					},
					{
						"id": "change-subject",
						"label": "Steer it back to something lighter",
						"detail": "Not tonight, is the message, however it's phrased.",
						"effects": {},
						"target": "all",
						"attention": 1.0,
						"resultText": "The table takes the hint and lets it go. It will keep, and it will cost interest.",
					},
				],
			},
		},
	},
]
