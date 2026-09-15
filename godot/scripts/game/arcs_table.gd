class_name ArcsTable
extends RefCounted
## The arcs table, generated from src/game/arcs.ts.
##
## DO NOT EDIT. Regenerate with:
##
##   npm run godot:content
##
## 12 arcs. Every field here is plain data. The fields that are
## functions in the TypeScript live in ArcsData instead:
##
##   when   -- every arc, in ArcsData.when_for. An arc only fires while
##             the situation that caused it still holds.
##   brief   -- every arc, in ArcsData.brief_for. An arc is a person
##             arriving with a question, so the brief names them.
##
## An entry with a static version of one of those fields carries it here; the
## ones without it have no such key at all, which is how ArcsData knows to
## generate one.

const ARCS := [
	{
		"id": "arc-treasury-feud",
		"source": "The Treasury Department",
		"title": "Your Treasury Secretary has stopped returning calls",
		"after": 8.0,
		"weight": 1.4,
		"choices": [
			{
				"id": "repair",
				"label": "Bring her in and give her the room",
				"detail": "It costs you an afternoon and some of the agenda.",
				"effects": {
					"politics.capital": -3.0,
					"personal.stress": 3.0,
					"nation.growth": 0.08,
				},
				"resultText": "She talks for forty minutes without notes. Half of it is a complaint and half of it is the best economic advice you have had this year.",
			},
			{
				"id": "replace",
				"label": "Move her out and put your own person in",
				"detail": "Cleaner, and everyone will read it as a purge.",
				"effects": {
					"politics.capital": -6.0,
					"politics.party": -4.0,
					"politics.media": -3.0,
					"personal.stress": 5.0,
				},
				"resultText": "The resignation is announced as a return to the private sector. Nobody in Washington believes that, and the markets take a day to decide how they feel.",
			},
			{
				"id": "ignore",
				"label": "Let her work it out on her own",
				"detail": "She is a professional. She will either come round or she will not.",
				"effects": {
					"politics.capital": 2.0,
					"nation.growth": -0.12,
				},
				"resultText": "The Treasury keeps producing competent documents that quietly assume none of your priorities are going to happen.",
			},
		],
	},
	{
		"id": "arc-leak-source",
		"source": "The West Wing",
		"title": "They have found who has been talking",
		"after": 10.0,
		"weight": 1.3,
		"choices": [
			{
				"id": "prosecute",
				"label": "Refer it to Justice and let it run",
				"detail": "The process is the point, and the process is slow.",
				"effects": {
					"politics.scandal": -9.0,
					"politics.media": 4.0,
					"politics.party": -3.0,
					"personal.stress": 4.0,
				},
				"resultText": "You hand the file over and say nothing else about it. It takes four months and it ends with a plea, and the story dies with it.",
			},
			{
				"id": "confront-privately",
				"label": "Call them in and end it in the room",
				"detail": "No lawyers. No file. Just the two of you.",
				"effects": {
					"politics.scandal": -5.0,
					"personal.stress": 6.0,
					"personal.integrity": 3.0,
				},
				"risk": 0.25,
				"onFail": {
					"politics.scandal": 6.0,
					"politics.media": -6.0,
				},
				"failText": "They deny it to your face, and then they go and tell three people you asked. The leak gets worse and now it has a grievance.",
				"resultText": "They do not admit it. They do not have to. The leaking stops within the month, which is its own kind of answer.",
			},
			{
				"id": "sit-on-it",
				"label": "Put the file in a drawer",
				"detail": "You know. That is enough for now.",
				"effects": {
					"personal.stress": 8.0,
					"politics.scandal": 3.0,
				},
				"resultText": "You know who it is every time you walk into the room, and you have to behave as though you do not. That is a tax you pay every day.",
			},
		],
	},
	{
		"id": "arc-child-away",
		"source": "The Residence",
		"title": "Your child has stopped coming home",
		"after": 12.0,
		"weight": 1.5,
		"choices": [
			{
				"id": "go-to-them",
				"label": "Clear a day and go to them",
				"detail": "Not the residence. Not with a detail in the room.",
				"effects": {
					"personal.stress": -6.0,
					"personal.integrity": 3.0,
					"politics.capital": -4.0,
				},
				"resultText": "You take one car and two agents and you sit in a kitchen that is not yours for four hours. It is awkward for the first one. It is not by the fourth.",
			},
			{
				"id": "bring-them-in",
				"label": "Have them brought to the residence for a weekend",
				"detail": "The schedule can hold a weekend. Probably.",
				"effects": {
					"personal.stress": -2.0,
				},
				"risk": 0.35,
				"onFail": {
					"personal.stress": 5.0,
				},
				"failText": "A crisis lands on the Friday and you spend the weekend in the Situation Room. They leave on Sunday without saying goodbye, which is a thing they have learned from you.",
				"resultText": "The weekend holds. Nobody talks about anything important, which turns out to be the important part.",
			},
			{
				"id": "let-them-be",
				"label": "Let them have their own life",
				"detail": "They are an adult. So are you.",
				"effects": {
					"personal.stress": 3.0,
				},
				"resultText": "You decide not to make it a thing. They are doing what people their age do, which is not a crisis, and you tell yourself that more than once.",
			},
		],
	},
	{
		"id": "arc-primary-challenge",
		"source": "Your Own Party",
		"title": "Someone is measuring the drapes",
		"after": 20.0,
		"weight": 1.2,
		"choices": [
			{
				"id": "muscle",
				"label": "Call every one of them personally",
				"detail": "Remind them what you have done for their districts.",
				"effects": {
					"politics.party": 9.0,
					"politics.capital": -5.0,
					"personal.stress": 5.0,
				},
				"resultText": "You spend two days on the phone. Nobody commits to anything, and nobody takes another meeting either.",
			},
			{
				"id": "let-them",
				"label": "Let them have their primary",
				"detail": "You have never lost a fight you did not take.",
				"effects": {
					"politics.party": -8.0,
					"politics.capital": 4.0,
					"personal.stress": -3.0,
				},
				"risk": 0.4,
				"onFail": {
					"politics.party": -6.0,
					"politics.media": -5.0,
				},
				"failText": "The challenge becomes real, and it becomes the story of the year. Every decision you make from here is read through it.",
				"resultText": "The governor looks at the numbers, decides the moment has passed, and announces for something else entirely.",
			},
			{
				"id": "buy-them",
				"label": "Find something for the governor to do",
				"detail": "An ambassadorship is cheaper than a primary.",
				"effects": {
					"politics.party": 4.0,
					"politics.capital": -8.0,
					"politics.media": -2.0,
				},
				"resultText": "There is a posting that suits them, and it is far away. The party settles, and everyone understands exactly what happened.",
			},
		],
	},
	{
		"id": "arc-unrest-organised",
		"source": "The Streets",
		"title": "The protests have organisers now",
		"after": 14.0,
		"weight": 1.4,
		"choices": [
			{
				"id": "meet",
				"label": "Meet their leadership, on the record",
				"detail": "It legitimises them. It also ends the standoff.",
				"effects": {
					"nation.unrest": -14.0,
					"politics.media": 3.0,
					"blocs.activists": 6.0,
					"blocs.traditionalists": -5.0,
				},
				"resultText": "You sit down with four people who have never been in the White House and will not forget it. Half the country calls it surrender. The other half stops marching.",
			},
			{
				"id": "police",
				"label": "Restore order first, talk later",
				"detail": "The polls say the country wants the streets clear.",
				"effects": {
					"nation.unrest": -8.0,
					"blocs.suburban": 5.0,
					"blocs.activists": -9.0,
					"blocs.young": -6.0,
					"politics.media": -4.0,
				},
				"resultText": "The streets are clear within a week. The footage is not, and it will be in every ad made about you for the rest of your life.",
			},
			{
				"id": "wait",
				"label": "Let it burn itself out",
				"detail": "Movements without a win lose momentum.",
				"effects": {
					"nation.unrest": 4.0,
					"politics.approval": -2.0,
				},
				"resultText": "It does not burn out. It gets smaller, and harder, and it is still there in the spring.",
			},
		],
	},
	{
		"id": "arc-rival-positioning",
		"source": "Your Own Cabinet",
		"title": "One of your secretaries is running for something",
		"after": 9.0,
		"weight": 1.5,
		"choices": [
			{
				"id": "let-them-run",
				"label": "Let them run, and keep them in the room",
				"detail": "A rival inside the tent is a rival you can see.",
				"effects": {
					"politics.capital": -4.0,
					"politics.party": -3.0,
					"personal.stress": 4.0,
				},
				"resultText": "They stay, and they are good at the job, and every meeting now has a second agenda in it that everybody can see and nobody says.",
			},
			{
				"id": "clip-them",
				"label": "Cut the travel budget and the press office",
				"detail": "Petty, effective, and they will know exactly what happened.",
				"effects": {
					"politics.capital": -2.0,
					"politics.party": 2.0,
					"personal.integrity": -2.0,
				},
				"risk": 0.3,
				"onFail": {
					"politics.scandal": 6.0,
					"politics.media": -6.0,
				},
				"failText": "A memo about their travel schedule reaches a reporter within the week. It reads exactly as small as it was.",
				"resultText": "The schedule thins out. They do not mention it and neither do you, and the temperature in the Cabinet Room drops four degrees for a month.",
			},
			{
				"id": "promote-them",
				"label": "Give them something big and public to own",
				"detail": "Ambition with a deliverable attached is just work.",
				"effects": {
					"politics.capital": -6.0,
					"politics.party": 4.0,
					"nation.standing": 2.0,
				},
				"resultText": "They take it, because it is too good to refuse, and because taking it means owning whatever it turns into. Both of you understand the trade.",
			},
		],
	},
	{
		"id": "arc-believer-ultimatum",
		"source": "Your Own Cabinet",
		"title": "The one who came for the agenda would like to see it",
		"after": 7.0,
		"weight": 1.4,
		"choices": [
			{
				"id": "commit",
				"label": "Promise them the floor this year, and mean it",
				"detail": "It is a real commitment and the Hill will read it as one.",
				"effects": {
					"politics.capital": -7.0,
					"politics.party": 3.0,
					"personal.integrity": 3.0,
				},
				"resultText": "They go back to work like somebody who has been given a date. You have just spent capital you have not raised yet, on a vote you have not counted.",
			},
			{
				"id": "level",
				"label": "Tell them the truth: the votes are not there",
				"detail": "Honest. It is also the thing they least want to hear.",
				"effects": {
					"politics.capital": 2.0,
					"personal.integrity": 2.0,
					"personal.stress": 3.0,
				},
				"resultText": "They take it better than you expected and worse than they let on. Something goes out of the way they argue in meetings after that.",
			},
			{
				"id": "stall",
				"label": "Tell them it is coming",
				"detail": "It might be. Next year is a year.",
				"effects": {
					"politics.capital": 3.0,
					"personal.integrity": -3.0,
				},
				"risk": 0.35,
				"onFail": {
					"politics.scandal": 5.0,
					"politics.party": -5.0,
				},
				"failText": "They repeat your timeline to somebody who writes it down, and now it is a promise with a date on it that you did not make.",
				"resultText": "They leave the room satisfied. You have bought about four months, and you have spent something you cannot put a number on.",
			},
		],
	},
	{
		"id": "arc-friend-cost",
		"source": "The West Wing",
		"title": "The job is taking somebody you brought with you",
		"after": 11.0,
		"weight": 1.3,
		"choices": [
			{
				"id": "let-them-go",
				"label": "Give them a way out with their dignity",
				"detail": "You lose a friend from the cabinet and keep one.",
				"effects": {
					"politics.capital": -4.0,
					"politics.media": -2.0,
					"personal.stress": -4.0,
					"personal.integrity": 3.0,
				},
				"resultText": "They argue for about ninety seconds and then they stop, which tells you they had been waiting for someone to say it. You get the friend back and the department gets somebody who is not tired.",
			},
			{
				"id": "lighten-it",
				"label": "Take some of it off them yourself",
				"detail": "There is only one place that work can go.",
				"effects": {
					"personal.stress": 9.0,
					"personal.health": -2.0,
					"politics.capital": 2.0,
				},
				"resultText": "You take three of their files and two of their meetings. They look better within a month. You do not.",
			},
			{
				"id": "say-nothing",
				"label": "Say nothing and let them decide",
				"detail": "They are an adult and this was their choice.",
				"effects": {
					"personal.stress": 4.0,
				},
				"risk": 0.4,
				"onFail": {
					"politics.capital": -6.0,
					"personal.stress": 8.0,
					"politics.media": -3.0,
				},
				"failText": "They keep going until they cannot, and it happens in front of people, and you knew and did nothing and both of you know that.",
				"resultText": "They pull out of it on their own over the winter. You never raise it, and neither do they, and it sits in the room with you for the rest of the term.",
			},
		],
	},
	{
		"id": "arc-institutionalist-paper",
		"source": "The Department",
		"title": "Somebody has started putting things in writing",
		"after": 8.0,
		"weight": 1.35,
		"choices": [
			{
				"id": "welcome-it",
				"label": "Tell them to keep doing it, and copy you in",
				"detail": "If the record is going to exist, it should be complete.",
				"effects": {
					"politics.scandal": -6.0,
					"personal.integrity": 4.0,
					"politics.capital": -2.0,
				},
				"resultText": "They are visibly surprised, which is the first time you have managed that. The memos keep coming and they start containing advice again rather than only dates.",
			},
			{
				"id": "stop-it",
				"label": "Make it clear the memos are not helping",
				"detail": "A paper trail is a paper trail whoever is keeping it.",
				"effects": {
					"politics.scandal": 4.0,
					"politics.media": -3.0,
					"personal.integrity": -4.0,
				},
				"risk": 0.32,
				"onFail": {
					"politics.scandal": 9.0,
					"politics.media": -7.0,
				},
				"failText": "The memo in which you asked them to stop writing memos is itself a memo. It is a very good one and somebody else has it now.",
				"resultText": "The memos stop. So does most of what they used to tell you before you asked, and you will not find out what you missed until later.",
			},
			{
				"id": "ignore-paper",
				"label": "Let them cover themselves",
				"detail": "They are not wrong to. That is the uncomfortable part.",
				"effects": {
					"personal.stress": 4.0,
					"politics.scandal": 1.0,
				},
				"resultText": "You read every memo and answer none of them. The file grows all year, accurate and unanswered, and one day it will be read by somebody who was not in the room.",
			},
		],
	},
	{
		"id": "arc-technocrat-starved",
		"source": "The Department",
		"title": "The department that works wants to know why it is last",
		"after": 9.0,
		"weight": 1.3,
		"choices": [
			{
				"id": "fund-it",
				"label": "Find the money out of the reserve",
				"detail": "It comes from somewhere, and somewhere is always a deficit.",
				"effects": {
					"nation.debtToGdp": 0.5,
					"politics.capital": -4.0,
					"nation.unrest": -3.0,
				},
				"resultText": "The money moves. Nothing visible happens for five months and then a number that had been getting worse quietly stops.",
			},
			{
				"id": "ask-for-cuts",
				"label": "Ask them to do it for the money they have",
				"detail": "Everybody is asked this. Most of them say yes.",
				"effects": {
					"politics.capital": 3.0,
					"nation.unrest": 2.0,
				},
				"resultText": "They send back a second note listing precisely what will not be done and when it will be noticed. It is dated, and they keep a copy.",
			},
			{
				"id": "read-it",
				"label": "Take the graph to the Cabinet Table yourself",
				"detail": "Make it the budget's problem rather than a note in a drawer.",
				"effects": {
					"politics.capital": -2.0,
					"politics.party": -2.0,
					"personal.stress": 3.0,
				},
				"resultText": "The graph goes up on the wall in the Cabinet Room. Three other secretaries recognise their own department in it, which is either very useful or the start of a much bigger argument.",
			},
		],
	},
	{
		"id": "arc-campaign-filing",
		"source": "The Campaign, Still",
		"title": "The October filing is back",
		"after": 6.0,
		"weight": 1.2,
		"choices": [
			{
				"id": "testify",
				"label": "Send counsel and answer everything",
				"detail": "A week of coverage, and then it is a thing that was answered.",
				"effects": {
					"politics.scandal": -7.0,
					"politics.media": 4.0,
					"politics.capital": -4.0,
					"personal.stress": 5.0,
				},
				"resultText": "Four hours of it, live. It is not a good week and it is the last week it is about this.",
			},
			{
				"id": "privilege",
				"label": "Assert privilege and fight the subpoena",
				"detail": "It buys months. It costs them in a particular way.",
				"effects": {
					"politics.scandal": 5.0,
					"politics.media": -5.0,
					"politics.capital": 3.0,
				},
				"risk": 0.3,
				"onFail": {
					"politics.scandal": 8.0,
					"politics.party": -4.0,
				},
				"failText": "The court is unimpressed and says so in a written opinion that is quoted for the rest of the term.",
				"resultText": "The fight runs long enough that the committee's own term runs out first. You win it on the calendar, which is a way of winning.",
			},
			{
				"id": "own-it",
				"label": "Go on television and talk about it yourself",
				"detail": "Unmediated, unscripted, and there is no second take.",
				"effects": {
					"politics.media": 6.0,
					"personal.integrity": 3.0,
					"personal.stress": 6.0,
				},
				"risk": 0.25,
				"onFail": {
					"politics.approval": -3.0,
					"politics.scandal": 4.0,
				},
				"failText": "You are asked a question you had not prepared for and you answer it honestly, and the honest answer is the clip.",
				"resultText": "Twenty-two minutes, no notes. The people who were against you are still against you, and the people in the middle stop asking.",
			},
		],
	},
	{
		"id": "arc-base-play-bill",
		"source": "The Base",
		"title": "They want the thing you promised in the primary",
		"after": 10.0,
		"weight": 1.3,
		"choices": [
			{
				"id": "deliver",
				"label": "Put it on the floor, whatever it costs",
				"detail": "It will not pass. Putting it there is the point.",
				"effects": {
					"politics.capital": -8.0,
					"politics.party": 8.0,
					"politics.approval": -2.0,
				},
				"resultText": "It fails by nine votes, on the record, with every name attached. Your base has never been happier with you and you have nothing to show for it but that.",
			},
			{
				"id": "half-measure",
				"label": "Give them an executive order instead",
				"detail": "Smaller, faster, and reversible by the next person to sit here.",
				"effects": {
					"politics.capital": -3.0,
					"politics.party": 3.0,
					"politics.media": -2.0,
				},
				"resultText": "They take it, and they say the right things about it, and the letter-writers all understand exactly what they were given instead.",
			},
			{
				"id": "move-on",
				"label": "Tell them the primary is over",
				"detail": "It is. That has never once made it easier to say.",
				"effects": {
					"politics.party": -9.0,
					"politics.capital": 5.0,
					"blocs.activists": -5.0,
				},
				"resultText": "The letter becomes an open letter, and then a group with a name, and by the spring it is somebody's campaign.",
			},
		],
	},
]
