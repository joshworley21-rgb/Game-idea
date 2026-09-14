class_name CoreData
extends RefCounted
## Static game constants and low-level content (no references to other game scripts).

const TERM_MONTHS := 48
const MIDTERM_MONTH := 22
const ELECTION_MONTH := 46
const PASS_THRESHOLD := 50.0

const BUDGET_KEYS := ["defense", "healthcare", "education", "infrastructure", "environment", "science", "welfare", "justice", "veterans"]

const BUDGET_LABELS := {
	"defense": "Defense", "healthcare": "Health & Medicare", "education": "Education",
	"infrastructure": "Infrastructure", "environment": "Environment & Energy",
	"science": "Science & Research", "welfare": "Social Security & Welfare",
	"justice": "Justice & Policing", "veterans": "Veterans Affairs",
}

const SECTOR_NEED := {
	"defense": 833.0, "healthcare": 1963.0, "education": 321.0, "infrastructure": 304.0,
	"environment": 134.0, "science": 200.0, "welfare": 1650.0, "justice": 207.0, "veterans": 351.0,
}
const NEED_DRIFT := 0.003
const START_BUDGET := {
	"defense": 900.0, "healthcare": 1900.0, "education": 300.0, "infrastructure": 250.0,
	"environment": 110.0, "science": 210.0, "welfare": 1650.0, "justice": 200.0, "veterans": 340.0,
}

const MONTH_NAMES := ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const OUTLETS := ["The National Ledger", "Capitol Wire", "Channel 8 Nightly", "The Beacon", "Public Radio Morning", "The Standard"]

const BLOC_KEYS := ["labour", "business", "seniors", "young", "rural", "suburban", "activists", "traditionalists"]
const FACTION_KEYS := ["progressives", "liberals", "moderates", "conservatives", "hardliners"]
const CRISIS_TAGS := ["economy", "foreign", "war", "health", "security", "justice", "climate", "scandal", "labour", "politics", "personal"]

const BLOCS := [
	{"key": "labour", "name": "Unions and working families", "short": "Labour", "weight": 0.17, "volatility": 0.22, "lean": {"blue": 8.0, "red": -8.0}, "cares": "Jobs, wages, welfare, and whose side you take in a strike."},
	{"key": "business", "name": "Business and finance", "short": "Business", "weight": 0.13, "volatility": 0.3, "lean": {"blue": -7.0, "red": 7.0}, "cares": "Growth, the tax rate, the debt, and predictability."},
	{"key": "seniors", "name": "Older voters", "short": "Seniors", "weight": 0.19, "volatility": 0.16, "lean": {"blue": -3.0, "red": 3.0}, "cares": "Healthcare, prices, and the sense that things are under control."},
	{"key": "young", "name": "Younger voters", "short": "Young", "weight": 0.15, "volatility": 0.34, "lean": {"blue": 9.0, "red": -9.0}, "cares": "Education, climate, and whether anything ever changes."},
	{"key": "rural", "name": "Rural and small-town", "short": "Rural", "weight": 0.14, "volatility": 0.18, "lean": {"blue": -9.0, "red": 9.0}, "cares": "Security, energy, guns, and being noticed at all."},
	{"key": "suburban", "name": "Suburban moderates", "short": "Suburban", "weight": 0.16, "volatility": 0.28, "lean": {"blue": 1.0, "red": 1.0}, "cares": "Schools, crime, competence, and the absence of drama."},
	{"key": "activists", "name": "The activist left", "short": "Activists", "weight": 0.03, "volatility": 0.42, "lean": {"blue": 14.0, "red": -16.0}, "cares": "Climate, healthcare, and whether you fought or compromised."},
	{"key": "traditionalists", "name": "The traditionalist right", "short": "Traditionalists", "weight": 0.03, "volatility": 0.42, "lean": {"blue": -16.0, "red": 14.0}, "cares": "Defense, order, low taxes, and holding the line."},
]

const FACTIONS := [
	{"key": "progressives", "name": "The Progressive Caucus", "short": "Progressives", "axis": -1.0, "party": "blue", "backing": "activists", "fiscal": false, "blurb": "Small, loud, and willing to sink your bill to make a point."},
	{"key": "liberals", "name": "The Liberal Bloc", "short": "Liberals", "axis": -0.5, "party": "blue", "backing": "labour", "fiscal": false, "blurb": "The mainstream of the blue party. Reliable until they are not."},
	{"key": "moderates", "name": "The Moderates", "short": "Moderates", "axis": 0.0, "party": null, "backing": "suburban", "fiscal": true, "blurb": "Cross-party, cautious, and the reason anything passes at all."},
	{"key": "conservatives", "name": "The Conservative Bloc", "short": "Conservatives", "axis": 0.5, "party": "red", "backing": "business", "fiscal": true, "blurb": "Business-minded, allergic to deficits, open to a deal on the right terms."},
	{"key": "hardliners", "name": "The Hardliners", "short": "Hardliners", "axis": 1.0, "party": "red", "backing": "traditionalists", "fiscal": true, "blurb": "They did not come here to compromise and they will tell you so."},
]

const TEMPERAMENTS := {
	"believer": {"key": "believer", "label": "a true believer", "note": "Came for the agenda, not the job. Reads every compromise as a retreat.", "baseDrift": 0.9, "approvalWeight": 0.6, "scandalWeight": 1.3, "unrestWeight": 0.8, "floor": 22.0, "leakChance": 0.2, "crisisEdge": 0.0, "linesLoyal": ["says the thing you are all avoiding, and says it first", "has rewritten the proposal overnight, again, and it is better"], "linesSour": ["has stopped arguing with you, which is worse than when they did", "asks, carefully, what the plan was supposed to have been"], "parting": "leaves saying the administration lost its nerve, and is quoted saying it"},
	"operator": {"key": "operator", "label": "an operator", "note": "Was somebody before this and intends to be somebody after. Counts the room.", "baseDrift": 1.25, "approvalWeight": 1.8, "scandalWeight": 1.2, "unrestWeight": 0.9, "floor": 0.0, "leakChance": 0.78, "crisisEdge": -5.0, "linesLoyal": ["agrees with whatever the room has decided, a half-second after it decides", "has already told three reporters this was your idea"], "linesSour": ["is taking meetings that are not on the schedule", "has begun saying the President's decision where they used to say we"], "parting": "resigns to spend time with a family nobody has met, and takes the file with them"},
	"institutionalist": {"key": "institutionalist", "label": "an institutionalist", "note": "Thirty years in the building. Serves the office, and is not confused about which one.", "baseDrift": 0.75, "approvalWeight": 0.2, "scandalWeight": 2.0, "unrestWeight": 0.7, "floor": 30.0, "leakChance": 0.1, "crisisEdge": 7.0, "linesLoyal": ["notes, without emphasis, that this has been tried twice before", "has the precedent, the memo and the date it went wrong"], "linesSour": ["has started putting things in writing", "asks for the instruction in a signed document, which is not a question"], "parting": "resigns on principle, in a letter the whole country reads"},
	"rival": {"key": "rival", "label": "a rival", "note": "Wanted this desk, nearly got it, and took the department instead.", "baseDrift": 1.35, "approvalWeight": 1.6, "scandalWeight": 0.9, "unrestWeight": 1.1, "floor": 0.0, "leakChance": 0.7, "crisisEdge": 4.0, "linesLoyal": ["disagrees with you fluently, in front of people, and is often right", "runs their department like a campaign, because it is one"], "linesSour": ["has a speech scheduled in a state that votes early", "praised you this morning in a way that will be clipped"], "parting": "resigns without warning, and books the Sunday shows for the weekend"},
	"friend": {"key": "friend", "label": "an old friend", "note": "Knew you before the motorcade. Tells you the truth and takes the hit for it.", "baseDrift": 0.7, "approvalWeight": 0.4, "scandalWeight": 0.7, "unrestWeight": 0.7, "floor": 34.0, "leakChance": 0.0, "crisisEdge": -3.0, "linesLoyal": ["asks how you are, and waits for the real answer", "stays behind after the room empties, the way they always have"], "linesSour": ["looks tired in a way that is about this building rather than the hours", "has stopped saying the thing they used to say to you in private"], "parting": "steps down quietly for health reasons, and means it"},
	"technocrat": {"key": "technocrat", "label": "a technocrat", "note": "Here for the work. Your approval rating is weather, and they brought a coat.", "baseDrift": 0.85, "approvalWeight": 0.3, "scandalWeight": 0.8, "unrestWeight": 2.2, "floor": 26.0, "leakChance": 0.28, "crisisEdge": 9.0, "linesLoyal": ["has brought a chart nobody asked for and everybody needed", "answers the question that was asked, which startles the room"], "linesSour": ["has stopped bringing the chart", "gives you the number and no longer tells you what it means"], "parting": "returns to the university, and publishes within the year"},
}

const OFFICES := [
	{"key": "chief", "title": "Chief of Staff", "domain": "politics"},
	{"key": "treasury", "title": "Treasury Secretary", "domain": "economy"},
	{"key": "state", "title": "Secretary of State", "domain": "foreign"},
	{"key": "defense", "title": "Defense Secretary", "domain": "security"},
	{"key": "justice", "title": "Attorney General", "domain": "justice"},
	{"key": "health", "title": "Health Secretary", "domain": "health"},
]

const CHIEF_NAME := "Ruth Ellery"

const FIRST_NAMES := ["Margaret", "Daniel", "Ruth", "Marcus", "Eleanor", "Priya", "Thomas", "Grace", "Andre", "Helen", "Victor", "Naomi", "Charles", "Rosa", "Edward", "Fiona", "Malcolm", "Diane", "Samuel", "Yusuf", "Claire", "Nathan", "Imani", "Walter"]
const LAST_NAMES := ["Halloran", "Nakamura", "Beaumont", "Osei", "Lindqvist", "Marchetti", "Whitfield", "Okonkwo", "Petrov", "Calderon", "Ashworth", "Dubois", "Ferreira", "Kowalski", "Sandoval", "Brennan", "Vasquez", "Ellery", "Rasmussen", "Tanaka"]

const SPOUSE_FIRST := ["Elena", "Marcus", "Nadia", "David", "Priya", "Jonah", "Claire", "Samuel", "Rosa", "Michael", "Ines", "Adam", "Leah", "Nicholas"]
const CHILD_FIRST := ["Maya", "Theo", "Aisha", "Danny", "Nora", "Elliot", "Sofia", "Caleb", "Ruth", "Jonah", "Cleo", "Isaac", "Mara", "Owen", "Nell", "Felix"]
const SPOUSE_LIVES := ["a paediatric surgery practice, now down to one clinic a month", "a law school deanship, deferred until the term is over", "a novel that has been three chapters from finished for two years", "an architecture firm they still call into at seven every morning", "a career in public health they left the week you announced", "a restaurant they opened at thirty and handed to a manager at fifty"]
const CHILD_LIVES := [
	{"min": 7, "max": 12, "lines": ["third grade, and a school run that now involves two vehicles", "obsessed with astronomy and unimpressed by your job", "learning the cello badly and with total commitment", "the only kid at school whose friends get background checks"]},
	{"min": 13, "max": 17, "lines": ["eleventh grade, and furious about the security detail", "captain of a team you have seen play twice", "applying to colleges and refusing all help from you", "in a band that rehearses in a room with a Secret Service agent in it"]},
	{"min": 18, "max": 23, "lines": ["second year at a university that will not stop calling you", "on a gap year, somewhere with poor phone reception", "studying marine biology and living with three strangers", "working a bar job under their mother's surname"]},
	{"min": 24, "max": 32, "lines": ["a junior architect who has never once asked you for anything", "a nurse working nights, which is when you are free", "teaching in a district your budget just cut", "starting a company you have politely not offered to help with"]},
]
const STRAINS := [
	{"id": "spouse-erasure", "kind": "spouse", "label": "losing themselves in the role", "detail": "Every introduction this month began with your name and ended with theirs.", "weight": 1.2},
	{"id": "spouse-work", "kind": "spouse", "label": "the career on hold", "detail": "They turned down something they wanted, again, and did not tell you until after.", "weight": 1.1},
	{"id": "spouse-alone", "kind": "spouse", "label": "eating alone", "detail": "Four dinners in the residence this month. You made one of them.", "weight": 1.3},
	{"id": "spouse-press", "kind": "spouse", "label": "under the lens", "detail": "A profile ran that was really about their weight, and everyone pretended otherwise.", "weight": 0.8},
	{"id": "child-school", "kind": "child", "label": "coming apart at school", "detail": "Two teachers have called the residence. Neither call reached you.", "ages": [7, 18], "weight": 1.2},
	{"id": "child-bullied", "kind": "child", "label": "a target because of you", "detail": "Your last speech is being quoted back at them in a corridor every day.", "ages": [7, 18], "weight": 1.1},
	{"id": "child-detail", "kind": "child", "label": "at war with the detail", "detail": "They gave their agents the slip on Friday. Nobody has said so officially.", "ages": [14, 24], "weight": 1.2},
	{"id": "child-drinking", "kind": "child", "label": "drinking more than they say", "detail": "The residence staff have stopped restocking one particular shelf.", "ages": [17, 30], "weight": 1.0},
	{"id": "child-distance", "kind": "child", "label": "not picking up", "detail": "Three calls, three voicemails, and a text saying they are fine.", "ages": [16, 32], "weight": 1.4},
	{"id": "child-money", "kind": "child", "label": "trading on the name", "detail": "Someone is paying them well for work that is mostly their surname.", "ages": [21, 32], "weight": 0.9},
	{"id": "child-health", "kind": "child", "label": "not well", "detail": "There is a specialist appointment on the calendar you have not asked about.", "ages": [7, 32], "weight": 0.8},
]
