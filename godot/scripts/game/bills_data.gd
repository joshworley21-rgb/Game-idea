class_name BillsData
extends RefCounted
## The bill catalog and floor maths.

const PASS_THRESHOLD := 50.0


static func bill_catalog() -> Array:
	var bills: Array = [
		{"id": "family-care", "title": "Universal Family Care Act", "summary": "Federal subsidy for childcare and long-term elder care, phased in over three years.", "ideology": "progressive", "cost": 220.0, "capitalCost": 28.0, "partisanship": 34.0, "onPass": {"nation.sectors.healthcare": 8, "politics.approval": 3, "nation.unrest": -3, "blocs.labour": 7, "blocs.young": 6, "blocs.seniors": 5, "blocs.business": -5, "blocs.traditionalists": -8}, "perMonth": {"nation.sectors.welfare": 0.12}},
		{"id": "green-grid", "title": "Green Grid Investment Act", "summary": "Rebuilds the national transmission grid around renewables and storage.", "ideology": "progressive", "cost": 160.0, "capitalCost": 22.0, "partisanship": 28.0, "onPass": {"nation.sectors.environment": 10, "nation.sectors.infrastructure": 3, "nation.standing": 4, "blocs.young": 9, "blocs.activists": 12, "blocs.rural": -7, "blocs.business": -3, "blocs.traditionalists": -6}, "perMonth": {"nation.growth": 0.012}},
		{"id": "min-wage", "title": "Fair Wage Act", "summary": "Raises the federal minimum wage and indexes it to inflation.", "ideology": "progressive", "cost": 0.0, "capitalCost": 20.0, "partisanship": 30.0, "onPass": {"nation.unemployment": 0.3, "nation.unrest": -5, "politics.approval": 3, "nation.sectors.welfare": 3, "blocs.labour": 12, "blocs.young": 5, "blocs.business": -10, "blocs.traditionalists": -5}},
		{"id": "student-debt", "title": "Student Debt Relief Act", "summary": "Cancels up to $20,000 of federal student loan debt per borrower.", "ideology": "progressive", "cost": 90.0, "capitalCost": 18.0, "partisanship": 26.0, "onPass": {"nation.sectors.education": 5, "politics.approval": 4, "politics.party": 4, "blocs.young": 14, "blocs.activists": 6, "blocs.seniors": -5, "blocs.rural": -6, "blocs.traditionalists": -7}},
		{"id": "wealth-surtax", "title": "Ultra-Wealth Surtax", "summary": "A surcharge on net worth above $50 million, aimed squarely at the deficit.", "ideology": "progressive", "cost": -180.0, "capitalCost": 26.0, "partisanship": 36.0, "onPass": {"nation.taxRate": 0.7, "politics.party": 5, "nation.growth": -0.15, "politics.approval": 1, "blocs.labour": 8, "blocs.activists": 11, "blocs.business": -14, "blocs.traditionalists": -9, "blocs.suburban": -3}},
		{"id": "prek", "title": "Universal Pre-K Act", "summary": "Free preschool for every four-year-old, run through the states.", "ideology": "progressive", "cost": 70.0, "capitalCost": 16.0, "partisanship": 22.0, "onPass": {"nation.sectors.education": 7, "nation.unemployment": -0.1, "politics.approval": 2, "blocs.young": 7, "blocs.suburban": 8, "blocs.labour": 5, "blocs.traditionalists": -5}},
		{"id": "infrastructure", "title": "National Infrastructure Renewal", "summary": "A decade of bridges, water systems, rail and broadband, built union.", "ideology": "centrist", "cost": 190.0, "capitalCost": 20.0, "partisanship": 14.0, "onPass": {"nation.sectors.infrastructure": 12, "nation.unemployment": -0.3, "politics.approval": 4, "blocs.labour": 9, "blocs.rural": 7, "blocs.business": 6, "blocs.suburban": 4}, "perMonth": {"nation.growth": 0.01}},
		{"id": "border-deal", "title": "Border Security & Immigration Compromise", "summary": "Enforcement funding traded for a path to status for long-term residents.", "ideology": "centrist", "cost": 45.0, "capitalCost": 24.0, "partisanship": 30.0, "onPass": {"nation.security": 6, "nation.unrest": -4, "politics.party": -4, "politics.media": 5, "politics.approval": 3, "blocs.suburban": 6, "blocs.business": 5, "blocs.rural": -6, "blocs.traditionalists": -11, "blocs.activists": -7}},
		{"id": "veterans", "title": "Veterans Care Overhaul", "summary": "Rebuilds VA hospitals and clears the disability claims backlog.", "ideology": "centrist", "cost": 55.0, "capitalCost": 12.0, "partisanship": 8.0, "onPass": {"nation.sectors.veterans": 12, "politics.approval": 3, "politics.media": 3, "blocs.rural": 8, "blocs.seniors": 6, "blocs.traditionalists": 5, "blocs.suburban": 3}},
		{"id": "pandemic", "title": "Pandemic Preparedness Act", "summary": "Standing vaccine capacity, stockpiles, and a rapid-response corps.", "ideology": "centrist", "cost": 40.0, "capitalCost": 12.0, "partisanship": 12.0, "onPass": {"nation.sectors.healthcare": 4, "nation.security": 3, "blocs.seniors": 6, "blocs.suburban": 4, "blocs.traditionalists": -3}},
		{"id": "elections", "title": "Election Integrity & Access Act", "summary": "National standards for voter access, audits, and campaign disclosure.", "ideology": "centrist", "cost": 15.0, "capitalCost": 22.0, "partisanship": 34.0, "onPass": {"nation.unrest": -6, "personal.integrity": 4, "politics.media": 5, "blocs.young": 6, "blocs.activists": 7, "blocs.rural": -5, "blocs.traditionalists": -9}},
		{"id": "deficit-framework", "title": "Deficit Reduction Framework", "summary": "Statutory caps and a slow trim to entitlement growth. Nobody will thank you.", "ideology": "centrist", "cost": -120.0, "capitalCost": 25.0, "partisanship": 24.0, "requires": "deficit", "onPass": {"nation.debtToGdp": -3, "politics.approval": -4, "nation.sectors.welfare": -3, "nation.growth": -0.1, "blocs.business": 12, "blocs.traditionalists": 8, "blocs.seniors": -9, "blocs.labour": -8, "blocs.activists": -10}},
		{"id": "chips-ai", "title": "AI & Semiconductor Initiative", "summary": "Domestic fabs, compute for universities, and a federal AI safety institute.", "ideology": "centrist", "cost": 85.0, "capitalCost": 14.0, "partisanship": 10.0, "onPass": {"nation.sectors.science": 10, "nation.growth": 0.15, "nation.standing": 3, "blocs.business": 8, "blocs.young": 5, "blocs.suburban": 4}},
		{"id": "corp-tax-cut", "title": "Corporate Competitiveness Act", "summary": "Cuts the corporate rate and expands capital expensing.", "ideology": "conservative", "cost": 0.0, "capitalCost": 24.0, "partisanship": 32.0, "onPass": {"nation.taxRate": -1.2, "nation.growth": 0.35, "politics.approval": -2, "blocs.business": 14, "blocs.traditionalists": 8, "blocs.labour": -9, "blocs.activists": -12, "blocs.young": -4}},
		{"id": "defense-mod", "title": "Defense Modernization Act", "summary": "Shipbuilding, missile defense, and a serious drone program.", "ideology": "conservative", "cost": 130.0, "capitalCost": 16.0, "partisanship": 18.0, "onPass": {"nation.sectors.defense": 9, "nation.security": 5, "nation.standing": 3, "blocs.rural": 8, "blocs.traditionalists": 11, "blocs.activists": -10, "blocs.young": -4}},
		{"id": "dereg", "title": "Regulatory Freedom Act", "summary": "Sunsets thousands of federal rules and puts a brake on new ones.", "ideology": "conservative", "cost": 0.0, "capitalCost": 18.0, "partisanship": 28.0, "onPass": {"nation.growth": 0.25, "nation.sectors.environment": -6, "politics.approval": -1, "blocs.business": 11, "blocs.traditionalists": 7, "blocs.activists": -12, "blocs.young": -6}},
		{"id": "public-safety", "title": "Police & Public Safety Act", "summary": "Hiring grants, body cameras, and mandatory minimums for gun crime.", "ideology": "conservative", "cost": 60.0, "capitalCost": 14.0, "partisanship": 24.0, "onPass": {"nation.sectors.justice": 9, "nation.unrest": -5, "personal.integrity": -2, "blocs.suburban": 8, "blocs.rural": 7, "blocs.seniors": 5, "blocs.activists": -12, "blocs.young": -6}},
		{"id": "energy-independence", "title": "Energy Independence Act", "summary": "Opens federal leases and fast-tracks pipelines and LNG terminals.", "ideology": "conservative", "cost": 70.0, "capitalCost": 18.0, "partisanship": 26.0, "onPass": {"nation.growth": 0.2, "nation.sectors.environment": -8, "nation.standing": -3, "nation.security": 4, "blocs.rural": 11, "blocs.business": 7, "blocs.traditionalists": 6, "blocs.activists": -14, "blocs.young": -8}},
		{"id": "emergency-relief", "title": "Emergency Relief Package", "summary": "Direct payments and state aid to steady a country coming apart.", "ideology": "centrist", "cost": 250.0, "capitalCost": 10.0, "partisanship": 8.0, "requires": "relief", "onPass": {"nation.unrest": -12, "nation.sectors.welfare": 5, "politics.approval": 5, "blocs.labour": 9, "blocs.seniors": 6, "blocs.young": 4, "blocs.business": -4, "blocs.traditionalists": -6}},
	]
	for b in bills:
		b["status"] = "available"
	return bills


static func bill_by_id(id: String) -> Dictionary:
	for b in bill_catalog():
		if b["id"] == id:
			return b
	return {}


static func bill_requires(state: Dictionary, bill: Dictionary) -> bool:
	var req: String = bill.get("requires", "")
	if req == "deficit":
		return state["nation"]["debtToGdp"] > 95.0
	if req == "relief":
		return state["nation"]["unrest"] > 55.0 or state["nation"]["unemployment"] > 7.0
	return true


static func party_ideology(state: Dictionary) -> String:
	return "progressive" if state["party"] == "blue" else "conservative"


static func forecast_vote(state: Dictionary, bill: Dictionary, capital_spent: float) -> Dictionary:
	var factions := CongressData.whip_count(state, bill, capital_spent)
	var score: float = CongressData.expected_votes(factions)
	var mine: String = party_ideology(state)
	var crosses_party: bool = bill["ideology"] != "centrist" and bill["ideology"] != mine
	var odds: float = clampf((score - PASS_THRESHOLD + 12.0) / 24.0, 0.03, 0.97)
	var read: String
	if odds > 0.85:
		read = "Locked up"
	elif odds > 0.62:
		read = "Likely to pass"
	elif odds > 0.38:
		read = "Too close to call"
	elif odds > 0.15:
		read = "Uphill"
	else:
		read = "Dead on arrival"
	return {"score": score, "odds": odds, "read": read, "crossesParty": crosses_party, "factions": factions}


static func hold_vote(state: Dictionary, bill: Dictionary, capital_spent: float, rng: Rng) -> Dictionary:
	var forecast := forecast_vote(state, bill, capital_spent)
	var roll: float = rng.range_float(-12.0, 12.0)
	var final_score: float = forecast["score"] + roll
	var passed: bool = final_score > PASS_THRESHOLD
	var margin: float = final_score - PASS_THRESHOLD
	var narrative: String
	if passed:
		if margin > 12.0:
			narrative = "It sails through both chambers with votes to spare."
		else:
			narrative = "It squeaks through after a night of arm-twisting on the floor."
	else:
		if margin > -5.0:
			narrative = "It dies two votes short. Two."
		else:
			narrative = "The whip count was never there. It never reaches the floor intact."
	return {"passed": passed, "margin": margin, "forecast": forecast, "narrative": narrative}


static func faction_aftermath(state: Dictionary, bill: Dictionary, passed: bool) -> void:
	var axis: float = CongressData.bill_axis(bill["ideology"])
	for def in CongressData.FACTIONS:
		if not state["factions"].has(def["key"]):
			continue
		var faction: Dictionary = state["factions"][def["key"]]
		var distance: float = absf(axis - def["axis"])
		var affinity: float = 1.0 - distance
		var shift: float
		if passed:
			shift = affinity * 5.0
		else:
			shift = -absf(affinity) * 1.5
		faction["mood"] = clampf(faction["mood"] + shift, 0.0, 100.0)


static func vote_aftermath(bill: Dictionary, result: Dictionary) -> Dictionary:
	var crosses_party: bool = result["forecast"]["crossesParty"]
	if result["passed"]:
		return {
			"politics.approval": 1.5, "politics.capital": 3.0,
			"politics.party": -6.0 if crosses_party else 3.0,
			"politics.media": 4.0 if crosses_party else 1.0,
			"nation.unrest": 2.0 if bill["partisanship"] > 28.0 else 0.0,
			"personal.stress": 3.0,
		}
	return {"politics.approval": -2.0, "politics.party": -3.0, "politics.media": -2.0, "personal.stress": 6.0}
