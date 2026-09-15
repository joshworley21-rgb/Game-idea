class_name CampaignTable
extends RefCounted
## The campaigns table, generated from src/game/campaign.ts.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## 2 campaigns. Every field here is plain data. The fields that are
## functions in the TypeScript live in Campaign instead:
##
##   requires -- the one option that only opens if you ran a ground game,
##               in Campaign.option_requires. It reads the path taken so
##               far, not any state: there is no state yet.
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how Campaign knows to
## generate one.

const CAMPAIGNS := [
	{
		"id": "blue",
		"beats": {
			"primary": {
				"id": "primary",
				"speaker": "Your campaign manager",
				"prompt": "The primary is tightening. Money is flowing to the flank candidate, and you have six weeks before the first real votes are counted. How do you spend them?",
				"options": [
					{
						"id": "grassroots",
						"label": "Grind it out on the ground",
						"detail": "Town halls, diners, retail politics. Slow, and it builds something that lasts.",
						"deltas": {
							"party": 6.0,
							"blocs": {
								"labour": 4.0,
								"rural": 2.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
					{
						"id": "air-war",
						"label": "Go all-in on television",
						"detail": "Expensive, fast, and it buys exactly the voters who are still deciding.",
						"deltas": {
							"approval": 3.0,
							"capital": 6.0,
							"media": -2.0,
							"blocs": {
								"suburban": 3.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
					{
						"id": "base-play",
						"label": "Lean hard into the base — damn the middle",
						"detail": "Turnout over persuasion. It works until it doesn't.",
						"deltas": {
							"party": 10.0,
							"blocs": {
								"activists": 8.0,
								"traditionalists": -4.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
				],
			},
			"debate": {
				"id": "debate",
				"speaker": "Debate night",
				"prompt": "Forty million people watching. Your opponent goes straight at your record, and you have ninety seconds to answer.",
				"options": [
					{
						"id": "ground-game",
						"label": "Point to the fifty diners you sat in this month",
						"detail": "The ground game becomes the answer.",
						"deltas": {
							"approval": 3.0,
							"blocs": {
								"labour": 2.0,
							},
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "specifics",
						"label": "Answer with specifics and numbers",
						"detail": "Slower television, and it reads as someone who did the homework.",
						"deltas": {
							"approval": 4.0,
							"media": 2.0,
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "counterpunch",
						"label": "Turn it around on their record instead",
						"detail": "The base loves a fighter. Nobody else is scoring this one for you.",
						"deltas": {
							"party": 3.0,
							"approval": -1.0,
							"blocs": {
								"activists": 3.0,
							},
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "high-road",
						"label": "Refuse to engage — pivot to your own plan",
						"detail": "Discipline, on a night that rewards almost anything else.",
						"deltas": {
							"approval": 1.0,
							"media": 1.0,
						},
						"resultText": "",
						"next": "surprise",
					},
				],
			},
			"surprise": {
				"id": "surprise",
				"speaker": "Ten days out",
				"prompt": "A story breaks — an old financial filing, ambiguous, and easy to spin either way depending on who gets there first.",
				"options": [
					{
						"id": "get-ahead",
						"label": "Get ahead of it — release everything yourself",
						"detail": "Costs momentum this week. Buys credibility for four years.",
						"deltas": {
							"approval": 2.0,
							"media": 4.0,
							"capital": -3.0,
						},
						"resultText": "You hold your own press conference before anyone asks you to. It is a strange thing to watch a candidate just answer the question.",
					},
					{
						"id": "lawyer-up",
						"label": "Let the lawyers handle it, say nothing",
						"detail": "The safest sentence is the one you don't say.",
						"deltas": {
							"approval": -2.0,
							"media": -4.0,
						},
						"resultText": "\"I won't get into an ongoing matter,\" your campaign says, for the fourth time this week.",
					},
					{
						"id": "counterstory",
						"label": "Leak something on your opponent in return",
						"detail": "Ugly, and it works on the people who were always going to vote for you anyway.",
						"deltas": {
							"party": 4.0,
							"approval": -3.0,
							"media": -3.0,
						},
						"resultText": "It works exactly as well as it deserves to: your side is thrilled, and no one else is.",
					},
				],
			},
		},
	},
	{
		"id": "red",
		"beats": {
			"primary": {
				"id": "primary",
				"speaker": "Your campaign manager",
				"prompt": "The primary is tightening. Money is flowing to the flank candidate, and you have six weeks before the first real votes are counted. How do you spend them?",
				"options": [
					{
						"id": "grassroots",
						"label": "Grind it out on the ground",
						"detail": "Town halls, diners, retail politics. Slow, and it builds something that lasts.",
						"deltas": {
							"party": 6.0,
							"blocs": {
								"labour": 4.0,
								"rural": 2.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
					{
						"id": "air-war",
						"label": "Go all-in on television",
						"detail": "Expensive, fast, and it buys exactly the voters who are still deciding.",
						"deltas": {
							"approval": 3.0,
							"capital": 6.0,
							"media": -2.0,
							"blocs": {
								"suburban": 3.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
					{
						"id": "base-play",
						"label": "Lean hard into the base — damn the middle",
						"detail": "Turnout over persuasion. It works until it doesn't.",
						"deltas": {
							"party": 10.0,
							"blocs": {
								"traditionalists": 8.0,
								"activists": -4.0,
							},
						},
						"resultText": "",
						"next": "debate",
					},
				],
			},
			"debate": {
				"id": "debate",
				"speaker": "Debate night",
				"prompt": "Forty million people watching. Your opponent goes straight at your record, and you have ninety seconds to answer.",
				"options": [
					{
						"id": "ground-game",
						"label": "Point to the fifty diners you sat in this month",
						"detail": "The ground game becomes the answer.",
						"deltas": {
							"approval": 3.0,
							"blocs": {
								"labour": 2.0,
							},
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "specifics",
						"label": "Answer with specifics and numbers",
						"detail": "Slower television, and it reads as someone who did the homework.",
						"deltas": {
							"approval": 4.0,
							"media": 2.0,
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "counterpunch",
						"label": "Turn it around on their record instead",
						"detail": "The base loves a fighter. Nobody else is scoring this one for you.",
						"deltas": {
							"party": 3.0,
							"approval": -1.0,
							"blocs": {
								"traditionalists": 3.0,
							},
						},
						"resultText": "",
						"next": "surprise",
					},
					{
						"id": "high-road",
						"label": "Refuse to engage — pivot to your own plan",
						"detail": "Discipline, on a night that rewards almost anything else.",
						"deltas": {
							"approval": 1.0,
							"media": 1.0,
						},
						"resultText": "",
						"next": "surprise",
					},
				],
			},
			"surprise": {
				"id": "surprise",
				"speaker": "Ten days out",
				"prompt": "A story breaks — an old financial filing, ambiguous, and easy to spin either way depending on who gets there first.",
				"options": [
					{
						"id": "get-ahead",
						"label": "Get ahead of it — release everything yourself",
						"detail": "Costs momentum this week. Buys credibility for four years.",
						"deltas": {
							"approval": 2.0,
							"media": 4.0,
							"capital": -3.0,
						},
						"resultText": "You hold your own press conference before anyone asks you to. It is a strange thing to watch a candidate just answer the question.",
					},
					{
						"id": "lawyer-up",
						"label": "Let the lawyers handle it, say nothing",
						"detail": "The safest sentence is the one you don't say.",
						"deltas": {
							"approval": -2.0,
							"media": -4.0,
						},
						"resultText": "\"I won't get into an ongoing matter,\" your campaign says, for the fourth time this week.",
					},
					{
						"id": "counterstory",
						"label": "Leak something on your opponent in return",
						"detail": "Ugly, and it works on the people who were always going to vote for you anyway.",
						"deltas": {
							"party": 4.0,
							"approval": -3.0,
							"media": -3.0,
						},
						"resultText": "It works exactly as well as it deserves to: your side is thrilled, and no one else is.",
					},
				],
			},
		},
	},
]
