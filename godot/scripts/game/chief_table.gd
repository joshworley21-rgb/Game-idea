class_name ChiefTable
extends RefCounted
## The briefings table, generated from src/game/chief.ts.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## 19 briefings. Every field here is plain data. The fields that are
## functions in the TypeScript live in Chief instead:
##
##   when -- every briefing, in Chief.briefing_applies. The list is ordered
##           from most urgent to least and the first match wins, so the
##           order here is as load-bearing as the conditions are.
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how Chief knows to
## generate one.

const BRIEFINGS := [
	{
		"id": "first-day",
		"levels": [
			"full",
		],
		"text": "The desk is yours as of noon. Everything on it was somebody else's problem yesterday and is yours now. I have cleared the first month so you can find your feet — three things a month is what a person can actually do, and anyone who tells you otherwise is selling something.",
	},
	{
		"id": "first-month-cabinet",
		"levels": [
			"full",
		],
		"text": "Your cabinet is confirmed and in the building. Six people, and you did not pick most of them — that is what a transition is. Go and meet them before you need them. The West Wing is where you will find them.",
	},
	{
		"id": "first-month-address",
		"levels": [
			"full",
		],
		"text": "The House expects you this month. A new president addresses a joint session in the first weeks — it is not a legal requirement, it is a courtesy, and skipping it is a statement. Whatever you say in that room sets what the next year is about. Choose it carefully.",
	},
	{
		"id": "no-actions",
		"text": "You are out of hours. There is nothing left on today that cannot wait until tomorrow, and the ones that cannot wait will find you anyway. End the month when you are ready.",
	},
	{
		"id": "crisis-waiting",
		"text": "There is something on your desk that will not keep. I have put it in front of you because the alternative was putting it in front of somebody else, and that is how these become other people's decisions.",
	},
	{
		"id": "arc-waiting",
		"text": "This one is not a crisis. This one is something you did, arriving. I would rather you dealt with it now than let it sit — they always get worse sitting.",
	},
	{
		"id": "unrest-high",
		"text": "The streets are not weather any more. Somebody is organising them, and organised people have demands, and demands are a thing you can actually answer. That is better news than it sounds.",
	},
	{
		"id": "approval-low",
		"text": "You are at thirty-something in the polls and your own party has started taking meetings without you. I have seen this before. It is survivable, but not by doing nothing.",
	},
	{
		"id": "scandal-high",
		"text": "The counsel's office is getting calls it is not answering. Whatever this is, it is going to be a story whether or not it is true, and the only question left is who tells it first.",
	},
	{
		"id": "capital-empty",
		"text": "You have spent your goodwill down to nothing. Nobody on the Hill owes you a vote this month. That is not a crisis, it is a fact, and it should shape what you attempt.",
	},
	{
		"id": "stress-high",
		"text": "You have not slept properly in three weeks and it is starting to show in the room. I have moved two things off tomorrow. Do not argue with me about it.",
	},
	{
		"id": "health-low",
		"text": "The physician has asked me to raise something with you and I am raising it. The Private Study is not a reward, it is maintenance, and you are overdue.",
	},
	{
		"id": "family-neglected",
		"text": "Somebody upstairs has not seen you in months. I am not going to tell you who — you know who. The Residence is on your list whether or not you put it there.",
	},
	{
		"id": "family-strain",
		"text": "There is something happening at home that you have been told about and have not acted on. I would not raise it if it were going to keep.",
	},
	{
		"id": "cabinet-loyalty",
		"text": "One of your secretaries has stopped returning my calls, which means they have stopped returning yours. I would find out why before they tell somebody else instead.",
	},
	{
		"id": "threads-running",
		"text": "You have several things running at once and none of them are finished. That is normal. What is not normal is letting all of them run into the election.",
	},
	{
		"id": "budget-month",
		"text": "It is appropriations month. The Cabinet Table has the arithmetic and nobody enjoys it. A frozen budget is a cut — the numbers move whether you do or not.",
	},
	{
		"id": "election-near",
		"text": "We are inside the last stretch. Everything you do from here is read as a campaign decision, including the things that are not. I would rather you knew that than found out.",
	},
	{
		"id": "quiet",
		"text": "Nothing is on fire this morning. That is rarer than it sounds and it does not last. Use it on something that will still matter in a year.",
	},
]
