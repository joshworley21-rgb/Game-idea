extends SceneTree
## Checks the GDScript port still agrees with the TypeScript it came from.
##
##   npm run godot:test          (GODOT=/path/to/godot if it is not on PATH)
##
## Exits 0 when everything matches, 1 on the first mismatch, so it can gate a
## build.
##
## Why this exists. The port is a translation, and the thing a translation
## quietly loses is determinism: the same seed has to produce the same game in
## both engines, or the balance work done against the TypeScript — every
## number in crises, arcs and bills was tuned by running it — means nothing
## here. Two things break that without breaking anything visible:
##
##   The PRNG. mulberry32 leans on Math.imul returning a *signed* 32-bit
##   product and on >>> being an unsigned shift. GDScript has 64-bit signed
##   ints and no unsigned shift, so a faithful-looking port can drift on the
##   first draw whose high bit is set.
##
##   The draw order. create_initial_state pulls about forty jittered values
##   from one stream. Reordering two fields changes every value after them
##   while leaving each one individually plausible, so nothing looks wrong.
##
## The golden values below were produced by the TypeScript, and they are the
## point: they are not what the GDScript happens to do, they are what it has to
## do. Regenerate them only when the TypeScript itself changes, with
##
##   node --experimental-strip-types --no-warnings <<'EOF'
##   import { Rng } from "./src/core/rng.ts";
##   import { createInitialState } from "./src/game/state.ts";
##   ...
##   EOF

var _failures := 0


func _check(what: String, got, want) -> void:
	if str(got) == str(want):
		print("  ok    %s" % what)
		return
	_failures += 1
	printerr("  FAIL  %s\n          got  %s\n          want %s" % [what, str(got), str(want)])


func _f(v) -> String:
	return "%.6f" % float(v)


## Every number under `node`, as "path=value", in sorted-key order.
func _walk(node, path: String, out: Array[String]) -> void:
	if node is float or node is int:
		out.append("%s=%.6f" % [path, float(node)])
	elif node is Array:
		for i in node.size():
			_walk(node[i], "%s[%d]" % [path, i], out)
	elif node is Dictionary:
		var keys: Array = node.keys()
		keys.sort()
		for k in keys:
			_walk(node[k], "%s.%s" % [path, k], out)


## Every leaf under `node`, as "path<sigil>value", in sorted-key order. Unlike
## _walk this covers strings and bools, because the generated crisis table is
## mostly text and a digest over only its numbers would not notice a title
## going missing.
func _walk_all(node, path: String, out: Array[String]) -> void:
	if node is float or node is int:
		out.append("%s#%.6f" % [path, float(node)])
	elif node is String or node is StringName:
		out.append("%s$%s" % [path, str(node)])
	elif node is bool:
		out.append("%s?%s" % [path, "true" if node else "false"])
	elif node == null:
		out.append("%s!" % path)
	elif node is Array:
		for i in node.size():
			_walk_all(node[i], "%s[%d]" % [path, i], out)
	elif node is Dictionary:
		var keys: Array = node.keys()
		keys.sort()
		for k in keys:
			_walk_all(node[k], "%s.%s" % [path, k], out)

## The state's leaves, on a basis the TypeScript can be compared against.
##
## One key has to come out. A bill's `requires` is a function in the
## TypeScript and a named string here, because a GDScript Dictionary cannot
## hold a function — so the walk sees two leaves on this side that do not
## exist on the other. That is a representational difference, not a
## behavioural one, and excluding it is what makes the digest a comparison
## rather than a record of what this engine happens to do. The requirements
## themselves are checked by name in _bills, so nothing goes unwatched.
func _comparable(state: Dictionary) -> Array[String]:
	var all: Array[String] = []
	_walk_all(state, "", all)
	var out: Array[String] = []
	for leaf in all:
		if not leaf.contains(".requires$"):
			out.append(leaf)
	return out

## One outcome, as a single number: its title, tone, text and the effect list
## exactly as the player is shown it. The effect list is ordered, and the
## order is part of what is being checked — describe_effects walks the effects
## Dictionary in insertion order, so a verb that assembles its "shown" map in
## the wrong order reads differently on screen even with identical numbers.
func _outcome_hash(o: Dictionary) -> int:
	if o.is_empty():
		return 0
	var bits: Array[String] = []
	for e in (o["effects"] as Array):
		bits.append("%s/%s" % [e["text"], "true" if e["good"] else "false"])
	return _fnv1a("%s|%s|%s|%s" % [o["title"], o["tone"], o["text"], ",".join(bits)])

## FNV-1a, 32-bit, matching the JavaScript reference.
func _fnv1a(text: String) -> int:
	var h := 0x811c9dc5
	for byte in text.to_utf8_buffer():
		h ^= byte
		h = (h * 0x01000193) & 0xFFFFFFFF
	return h


func _init() -> void:
	_rng()
	_rounding()
	_state()
	_blocs()
	_actions()
	_fiscal()
	_sim()
	_family()
	_news()
	_news_distressed()
	_month_flow()
	_endings()
	_crises()
	_arcs()
	_bills()
	_term()
	_play()
	_engine()
	print("")
	if _failures == 0:
		print("parity: all checks passed")
		quit(0)
	else:
		printerr("parity: %d check(s) failed" % _failures)
		quit(1)



func _rng() -> void:
	print("rng: mulberry32 sequence from seed 12345")
	var rng := Rng.new(12345)
	var golden := [
		"0.979728", "0.306752", "0.484205", "0.817934", "0.509428", "0.347472",
	]
	for i in golden.size():
		_check("draw %d" % i, _f(rng.next()), golden[i])


func _state() -> void:
	print("state: every number in the opening position, hashed")
	# A digest, not a handful of fields.
	#
	# The first version of this checked a dozen named values and passed a
	# deliberate swap of two adjacent draws: exchanging nation.unrest with
	# nation.standing changes only those two numbers, consumes the same draws,
	# and leaves everything after them untouched -- so a spot-check that does
	# not happen to name either one sees nothing. Walking every number in key
	# order and hashing the lot has no such blind spot.
	for case in [{"party": "blue", "seed": 12345, "digest": 3068621650},
			{"party": "red", "seed": 777, "digest": 1852892754}]:
		var st := StateData.create_initial_state(case["party"], "President Vance", case["seed"])
		var numbers: Array[String] = []
		_walk(st, "", numbers)
		_check("%s/%d numbers" % [case["party"], case["seed"]], numbers.size(), 78)
		_check("%s/%d digest" % [case["party"], case["seed"]],
			_fnv1a(";".join(numbers)), case["digest"])


func _blocs() -> void:
	print("blocs: ten months of drift against a worsening economy")
	# The blocs are where the economy becomes politics: each of the eight wants
	# something different, and approval is their weighted sum. The eight target
	# expressions were dropped in the first pass of the port -- a Dictionary
	# cannot hold the TypeScript's target(s) function -- which left driftBlocs
	# with nothing to drift toward, so unemployment could rise and nobody
	# minded. Ten months with the economy deteriorating exercises all eight.
	var b := StateData.create_initial_state("blue", "", 2024)
	var lines: Array[String] = []
	for _m in 10:
		BlocsData.drift_blocs(b)
		b["nation"]["unemployment"] = float(b["nation"]["unemployment"]) + 0.15
		b["nation"]["inflation"] = float(b["nation"]["inflation"]) + 0.1
		b["nation"]["growth"] = float(b["nation"]["growth"]) - 0.08
		var row: Array[String] = []
		for k in CoreData.BLOC_KEYS:
			row.append("%.6f" % float(b["blocs"][k]))
		lines.append(" ".join(row) + "|" + ("%.6f" % BlocsData.coalition_approval(b)))
	var weak: Array[String] = []
	for def in BlocsData.weakest_blocs(b, 3):
		weak.append(str(def["key"]))
	lines.append(",".join(weak))
	_check("ten-month drift digest", _fnv1a(";".join(lines)), 304653099)


func _actions() -> void:
	print("actions: how many each station offers in month 1, seed 4242")
	var a := StateData.create_initial_state("blue", "", 4242)
	var want := {"desk": 3, "press": 2, "budget": 0, "staff": 2, "floor": 1, "phone": 3, "rest": 5}
	for station in ["desk", "press", "budget", "staff", "floor", "phone", "rest"]:
		_check(station, ActionsData.actions_for(a, station).size(), want[station])


func _fiscal() -> void:
	print("fiscal: the budget arithmetic on the opening position, seed 9001")
	var f := StateData.create_initial_state("blue", "", 9001)
	_check("revenue", _f(StateData.annual_revenue(f)), "4900.000000")
	_check("debt service", _f(StateData.debt_service(f)), "891.795063")
	_check("discretionary", _f(StateData.total_discretionary(f["enacted"])), "5789.000000")
	_check("deficit", _f(StateData.annual_deficit(f)), "1780.795063")
	_check("approval target", _f(Sim.approval_target(f)), "50.808796")
	_check("potential growth", _f(Sim.potential_growth(f)), "1.933208")


func _sim() -> void:
	print("sim: two years of the country, hashed month by month")
	# The month tick is where every ported module finally has to agree at once:
	# the economy feeds the blocs, the blocs feed approval, approval feeds
	# stress, stress feeds the family, and the family feeds back into stress
	# next month. A single transposed coefficient anywhere in that loop is
	# invisible for a month or two and then compounds, which is exactly the
	# failure a one-month check does not catch -- so this runs twenty-four.
	#
	# It also pins the draw order across modules. simulate_month takes three
	# draws for the economic shock and then however many drift_family needs,
	# and drift_family's count depends on how many family members are already
	# under strain. Get the shock draws wrong and the family diverges; get the
	# family wrong and every later month's shock does.
	var rng2 := Rng.new(9001)
	var st2 := StateData.create_initial_state("blue", "", 9001)
	st2["cabinet"] = People.create_cabinet(rng2)
	st2["family"] = People.create_family(rng2, float(st2["personal"]["age"]))
	var ctx := Sim.create_sim_context(rng2, 1)
	_check("cycle phase", _f(ctx["cyclePhase"]), "5.255719")

	var months: Array[String] = []
	for m in range(1, 25):
		var report: Dictionary = Sim.simulate_month(st2, ctx, rng2, m % 3)
		var nums: Array[String] = []
		_walk(st2, "", nums)
		months.append("|".join([
			"m%d" % m,
			"n%d" % nums.size(),
			"d%.6f" % float(report["deficit"]),
			"r%.6f" % float(report["revenue"]),
			"x%d" % (report["deltas"] as Array).size(),
			"t%d" % (report["notes"] as Array).size(),
			str(_fnv1a(";".join(nums))),
		]))
		st2["month"] = int(st2["month"]) + 1
	_check("twenty-four month digest", _fnv1a("\n".join(months)), 1764891405)

	var tail: Array[String] = []
	_walk(st2, "", tail)
	_check("final numbers", tail.size(), 111)
	_check("final digest", _fnv1a(";".join(tail)), 1603674458)
	# Named as well as hashed, so a failure says something about the country
	# rather than only that it differs.
	_check("final approval", _f(st2["politics"]["approval"]), "52.499586")
	_check("final unrest", _f(st2["nation"]["unrest"]), "26.299752")
	_check("final debt/GDP", _f(st2["nation"]["debtToGdp"]), "107.180516")
	_check("final marriage", _f(st2["personal"]["marriage"]), "47.026654")


func _family() -> void:
	print("family: the month a difficulty resolves")
	# A narrow case the twenty-four month run never reaches, because a strain
	# only shrinks when you have been attending to the person and it takes
	# several visits to push severity under zero.
	#
	# It is here because the bond target reads `member.strain?.severity ?? 0`,
	# and the obvious GDScript for that -- binding the strain Dictionary once
	# at the top of the loop -- keeps reading the *erased* strain's severity,
	# which is now negative. Subtracting a negative raises the bond, so the
	# month a difficulty resolves would quietly pay a bonus the TypeScript
	# never gives. Nothing about that looks wrong in a log.
	var fs := StateData.create_initial_state("blue", "", 4242)
	var frng := Rng.new(4242)
	fs["family"] = People.create_family(frng, float(fs["personal"]["age"]))
	var sp: Dictionary = fs["family"][0]
	sp["strain"] = {"id": "spouse-alone", "label": "eating alone", "detail": "x",
		"severity": 1.0, "months": 3}
	sp["since"] = 0
	sp["bond"] = 55.0
	fs["personal"]["stress"] = 60.0
	fs["politics"]["scandal"] = 10.0
	var fnotes: Array[String] = []
	People.drift_family(fs, frng, fnotes)
	_check("bond the month it settles", _f(sp["bond"]), "59.532000")
	_check("strain cleared", not sp.has("strain"), true)
	_check("marriage follows the spouse", _f(fs["personal"]["marriage"]), "59.532000")
	_check("note", ";".join(fnotes), "Things have settled down for Samuel.")


func _news() -> void:
	print("news: the headlines a term actually prints")
	# Run alongside the same twenty-four months, because generate_news draws
	# from the shared stream: get the headline count wrong in one month and
	# every later month of the simulation is on different numbers.
	var nrng := Rng.new(9001)
	var ns := StateData.create_initial_state("blue", "", 9001)
	ns["cabinet"] = People.create_cabinet(nrng)
	ns["family"] = People.create_family(nrng, float(ns["personal"]["age"]))
	var nctx := Sim.create_sim_context(nrng, 1)
	NewsData.push_news(ns, NewsData.generate_news(ns, nrng))
	for m in range(1, 25):
		Sim.simulate_month(ns, nctx, nrng, m % 3)
		ns["month"] = int(ns["month"]) + 1
		NewsData.push_news(ns, NewsData.generate_news(ns, nrng))
	# Four, not forty-eight: the dedupe window is the last four headlines and
	# a settled country only matches the four-line "quiet week" template, so
	# most months genuinely print nothing new. That is the TypeScript's
	# behaviour, and pinning the count is what would catch a port that
	# accidentally made it generous.
	_check("headlines kept", (ns["news"] as Array).size(), 4)
	var nrows: Array[String] = []
	for n in (ns["news"] as Array):
		nrows.append("%d|%s|%s|%s" % [int(n["month"]), n["tone"], n["source"], n["headline"]])
	_check("news digest", _fnv1a("\n".join(nrows)), 3541467704)


func _news_distressed() -> void:
	print("news: a country in trouble, where the numbers get printed")
	# The calm run never fills a placeholder, so it never tests the
	# formatting. This one does, and one of its numbers -- unemployment at
	# exactly 7.25 -- is the tie where JavaScript's toFixed rounds up to
	# "7.3" and C's printf rounds to even and gives "7.2". A plain
	# "%.1f" prints the wrong headline here.
	var ds := StateData.create_initial_state("blue", "", 55)
	ds["politics"]["approval"] = 31.5
	ds["politics"]["scandal"] = 62.0
	ds["nation"]["unemployment"] = 7.25
	ds["nation"]["inflation"] = 5.5
	ds["nation"]["growth"] = -1.5
	ds["nation"]["unrest"] = 71.0
	ds["nation"]["debtToGdp"] = 141.5
	ds["nation"]["standing"] = 28.0
	ds["nation"]["sectors"]["healthcare"] = 25.0
	ds["nation"]["sectors"]["infrastructure"] = 22.0
	ds["personal"]["marriage"] = 21.0
	ds["personal"]["health"] = 33.0
	var drng := Rng.new(55)
	var drows: Array[String] = []
	for m in range(1, 7):
		ds["month"] = m
		var items := NewsData.generate_news(ds, drng)
		NewsData.push_news(ds, items)
		for n in items:
			drows.append("%d|%s|%s|%s" % [int(n["month"]), n["tone"], n["source"], n["headline"]])
	_check("distressed rows", drows.size(), 12)
	_check("distressed digest", _fnv1a("\n".join(drows)), 506102734)
	_check("the 7.25 tie", drows[3].ends_with("7.3%; manufacturing towns hit hardest"), true)


func _month_flow() -> void:
	print("month flow: the things a month does outside the economy")
	# Five paths that only fire under conditions a normal run reaches rarely,
	# so each is set up deliberately rather than waited for. The rng seeds are
	# chosen to make the rare branch fire -- that is the point of them.

	var blank_report := func() -> Dictionary:
		return {"month": 1, "deltas": [], "deficit": 0.0, "revenue": 0.0, "notes": []}

	# A budget you did not sign.
	var sg := StateData.create_initial_state("blue", "", 700)
	sg["month"] = 13
	MonthFlow.run_stopgap(sg)
	_check("stopgap approval", _f(sg["politics"]["approval"]), "46.818752")
	_check("stopgap capital", _f(sg["politics"]["capital"]), "57.130581")
	_check("stopgap flag", sg["flags"].get("budget13", false), true)
	_check("stopgap news", (sg["news"] as Array).size(), 1)
	_check("stopgap log", sg["log"][0]["text"],
		"No budget signed; the government runs on a continuing resolution.")

	# A first family that is never in the same room.
	var rs := StateData.create_initial_state("blue", "", 700)
	rs["personal"]["marriage"] = 20.0
	rs["personal"]["family"] = 24.0
	rs["family"] = People.create_family(Rng.new(1), 55.0)
	rs["family"][0]["since"] = 7
	var rrep: Dictionary = blank_report.call()
	MonthFlow.run_residence(rs, rrep)
	_check("absent traditionalists", _f(rs["blocs"]["traditionalists"]), "52.793978")
	_check("absent suburban", _f(rs["blocs"]["suburban"]), "46.658642")
	_check("who is waiting", ";".join(rrep["notes"]),
		"Rosa has been waiting 7 months for an evening.")

	# And one that is visibly close.
	var cs := StateData.create_initial_state("blue", "", 700)
	cs["personal"]["marriage"] = 82.0
	cs["personal"]["family"] = 80.0
	MonthFlow.run_residence(cs, blank_report.call())
	_check("close traditionalists", _f(cs["blocs"]["traditionalists"]), "54.193978")
	_check("close media", _f(cs["politics"]["media"]), "48.176989")

	# The midterms, where seats actually change hands.
	var ms := StateData.create_initial_state("blue", "", 700)
	ms["month"] = 22
	ms["politics"]["approval"] = 44.0
	var mres := MonthFlow.run_midterms(ms, Rng.new(31))
	_check("midterm swing", _f(mres["swing"]), "-5.921951")
	_check("midterm won", mres["won"], false)
	_check("midterm house", _f(ms["politics"]["house"]), "43.682576")
	_check("midterm senate", _f(ms["politics"]["senate"]), "43.958014")
	_check("midterm log", ms["log"][0]["text"], "Midterm elections: losses of 5.9 points.")
	var fnums: Array[String] = []
	_walk(ms["factions"], "", fnums)
	_check("seats after the swing", " ".join(fnums),
		".conservatives.mood=34.024752 .conservatives.seats=27.960976"
		+ " .hardliners.mood=32.600666 .hardliners.seats=17.960976"
		+ " .liberals.mood=66.542167 .liberals.seats=23.039024"
		+ " .moderates.mood=56.727730 .moderates.seats=22.000000"
		+ " .progressives.mood=56.897846 .progressives.seats=9.039024")

	# A cabinet coming apart: one resignation and one leak in the same month.
	# This also re-tests make_secretary, because the replacement is drawn from
	# the same paired-name loop the draw-order bug was hiding in.
	var cb := StateData.create_initial_state("blue", "", 700)
	cb["cabinet"] = People.create_cabinet(Rng.new(700))
	cb["politics"]["approval"] = 20.0
	cb["politics"]["scandal"] = 80.0
	cb["nation"]["unrest"] = 80.0
	for person in (cb["cabinet"] as Array):
		if person["office"] != "chief":
			person["loyalty"] = 12.0
	var crep: Dictionary = blank_report.call()
	MonthFlow.run_cabinet(cb, Rng.new(6), crep)
	_check("cabinet notes", ";".join(crep["notes"]),
		"Imani Kowalski resigns on principle, in a letter the whole country reads."
		+ " Priya Rasmussen takes the department."
		+ ";Someone in the room is talking to the press.")
	_check("resignations", int(cb["counters"].get("resignations", 0)), 1)
	_check("leaks", int(cb["counters"].get("leaks", 0)), 1)
	var cnames: Array[String] = []
	for person in (cb["cabinet"] as Array):
		cnames.append(str(person["name"]))
	_check("cabinet after", ", ".join(cnames),
		"Ruth Ellery, Yusuf Marchetti, Priya Rasmussen, Claire Calderon,"
		+ " Charles Sandoval, Samuel Brennan")
	var cnums: Array[String] = []
	_walk(cb, "", cnums)
	_check("cabinet numbers", cnums.size(), 102)
	_check("cabinet digest", _fnv1a(";".join(cnums)), 975896108)

	# The body, when it has had enough.
	var bd := StateData.create_initial_state("blue", "", 700)
	bd["personal"]["sleepDebt"] = 95.0
	bd["personal"]["health"] = 20.0
	bd["personal"]["stress"] = 95.0
	var brep: Dictionary = blank_report.call()
	var bev := MonthFlow.run_body(bd, Rng.new(7), brep)
	_check("episode fired", bev.get("title", ""), "Walter Reed")
	_check("episode health", _f(bd["personal"]["health"]), "11.000000")
	_check("episode sleep debt", _f(bd["personal"]["sleepDebt"]), "60.000000")
	_check("a week of the month gone", int(bd["ap"]), 2)
	_check("episode note", ";".join(brep["notes"]),
		"You lost a week of the month to a hospital bed.")
	_check("episode text", _fnv1a(str(bev["text"])), 439316693)

	# The physical, which can only find what you let it look at.
	var ph := StateData.create_initial_state("blue", "", 700)
	ph["month"] = 5
	ph["actionHistory"]["physical"] = 4
	ph["personal"]["age"] = 68.0
	ph["personal"]["fitness"] = 20.0
	ph["personal"]["sleepDebt"] = 80.0
	ph["personal"]["health"] = 40.0
	var prep: Dictionary = blank_report.call()
	var pev := MonthFlow.run_body(ph, Rng.new(6), prep)
	_check("physical fired", pev.get("title", ""), "The Physical")
	_check("what it found", ph["personal"].get("condition", ""), "atrial fibrillation")
	_check("physical note", ";".join(prep["notes"]),
		"The physical found something: atrial fibrillation.")
	_check("physical text", _fnv1a(str(pev["text"])), 2735608622)


func _endings() -> void:
	print("endings: what the term was worth, and how it closed")
	# The legacy score and the margin, measured on a lived-in state rather
	# than the opening position: twenty-four months of the same seed 9001 run
	# the sim section uses.
	var es := StateData.create_initial_state("blue", "", 9001)
	var erng := Rng.new(9001)
	es["cabinet"] = People.create_cabinet(erng)
	es["family"] = People.create_family(erng, float(es["personal"]["age"]))
	var ectx := Sim.create_sim_context(erng, 1)
	for m in range(1, 25):
		Sim.simulate_month(es, ectx, erng, m % 3)
		es["month"] = int(es["month"]) + 1
	var lg := EndingsData.score_legacy(es)
	var lg_parts: Array[String] = []
	for k in ["economy", "society", "standing", "politics", "personal", "total"]:
		lg_parts.append("%s=%s" % [k, _f(lg[k])])
	_check("legacy breakdown", " ".join(lg_parts),
		"economy=54.523232 society=52.041286 standing=54.574699"
		+ " politics=41.696525 personal=52.303780 total=51.227491")
	_check("grade", EndingsData.grade_for(float(lg["total"])), "C")
	_check("election margin", _f(EndingsData.election_margin(es)), "11.477600")
	var dec: Array[String] = []
	for row in EndingsData.decisive_blocs(es):
		dec.append("%s:%s" % [row["name"], _f(row["support"])])
	_check("who decided it", " ".join(dec),
		"Labour:68.056179 Traditionalists:36.009750 Young:56.061877")
	_check("no fail state", EndingsData.check_fail_state(es).is_empty(), true)
	_check("term not over at 25", EndingsData.is_term_over(es), false)

	# Grade boundaries, on the boundary and just under it.
	for pair in [[88.0, "A+"], [80.0, "A"], [72.0, "B+"], [64.0, "B"], [56.0, "C+"],
			[48.0, "C"], [40.0, "D"], [0.0, "F"], [87.9999, "A"], [39.9999, "F"]]:
		_check("grade %s" % str(pair[0]), EndingsData.grade_for(pair[0]), pair[1])

	# The danger streak resets the moment the country stops being on fire.
	var ds := StateData.create_initial_state("blue", "", 1)
	ds["politics"]["approval"] = 20.0
	ds["nation"]["unrest"] = 80.0
	EndingsData.update_danger_streak(ds)
	EndingsData.update_danger_streak(ds)
	_check("streak after two bad months", int(ds["dangerStreak"]), 2)
	ds["nation"]["unrest"] = 10.0
	EndingsData.update_danger_streak(ds)
	_check("streak after a good one", int(ds["dangerStreak"]), 0)

	# The three ways a term ends early.
	var fails := [
		["health", {"personal.health": 5.0}, "health", 30, 1647706808],
		["impeachment", {"politics.scandal": 90.0, "personal.integrity": 20.0},
			"impeachment", 30, 1028836189],
		["collapse", {"dangerStreak": 4}, "collapse", 33, 3016900912],
	]
	for row in fails:
		var x := StateData.create_initial_state("blue", "", 9001)
		x["family"] = People.create_family(Rng.new(9001), 55.0)
		for path in (row[1] as Dictionary):
			if path == "dangerStreak":
				x["dangerStreak"] = row[1][path]
			else:
				var bits: PackedStringArray = str(path).split(".")
				x[bits[0]][bits[1]] = row[1][path]
		var fail := EndingsData.check_fail_state(x)
		var e := EndingsData.build_ending(x, Rng.new(5), fail)
		_check("%s id" % row[0], e["id"], row[2])
		_check("%s legacy" % row[0], int(e["legacy"]), row[3])
		_check("%s grade" % row[0], e["grade"], "F")
		_check("%s reelected" % row[0], e["reelected"], false)
		_check("%s blurb" % row[0], _fnv1a(str(e["blurb"])), row[4])

	# And the three ways a full term ends.
	var finishes := [
		["reelected", "won", "reelected", "Four More Years", 56, 2917928044],
		["defeated", "lost", "single-term", "A Single Term", 52, 1571371688],
		["stood down", "none", "single-term", "One Term, By Choice", 55, 2145684193],
	]
	for row in finishes:
		var x := StateData.create_initial_state("blue", "", 9001)
		x["family"] = People.create_family(Rng.new(9001), 55.0)
		x["personal"]["marriage"] = 72.0
		x["personal"]["family"] = 76.0
		x["personal"]["health"] = 66.0
		if row[1] == "won":
			x["politics"]["approval"] = 68.0
			for k in (x["blocs"] as Dictionary):
				x["blocs"][k] = 68.0
		elif row[1] == "lost":
			x["politics"]["approval"] = 32.0
			for k in (x["blocs"] as Dictionary):
				x["blocs"][k] = 40.0
		else:
			x["runningForReelection"] = false
		var e := EndingsData.build_ending(x, Rng.new(11), {})
		_check("%s id" % row[0], e["id"], row[2])
		_check("%s title" % row[0], e["title"], row[3])
		_check("%s legacy" % row[0], int(e["legacy"]), row[4])
		_check("%s grade" % row[0], e["grade"], "C")
		_check("%s blurb" % row[0], _fnv1a(str(e["blurb"])), row[5])
	# Standing down is not the same as losing: reelected is null, not false,
	# so the ending screen can say "by choice" rather than "defeated".
	var sd := StateData.create_initial_state("blue", "", 9001)
	sd["family"] = People.create_family(Rng.new(9001), 55.0)
	sd["runningForReelection"] = false
	_check("stood down reelected is null",
		EndingsData.build_ending(sd, Rng.new(11), {})["reelected"] == null, true)

	# Ties, which decide more of these orderings than they look like they
	# should: a bloc nobody has touched sits at exactly 50, so an all-tied
	# board is the ordinary opening position, not a contrived one.
	#
	# The TypeScript leans on Array.sort being stable, which it has been
	# required to be since ES2019. sort_custom is documented as unstable, so
	# both comparators fall back to the declaration index. Removing that
	# fallback does not currently fail these checks -- Godot 4.3 sorts eight
	# elements with an insertion sort that happens to preserve order -- so
	# the tiebreak is defensive rather than a fix for a live bug. It stays
	# because "happens to" is doing the work otherwise, and it stops being
	# true if the list grows or the engine changes its sort. These checks
	# pin the order either way.
	var tie := StateData.create_initial_state("blue", "", 1)
	for k in (tie["blocs"] as Dictionary):
		tie["blocs"][k] = 50.0
	var tie_names: Array[String] = []
	for row in EndingsData.decisive_blocs(tie):
		tie_names.append(str(row["name"]))
	_check("decisive, all tied", " ".join(tie_names), "Labour Business Seniors")
	var weak_names: Array[String] = []
	for def in BlocsData.weakest_blocs(tie, 3):
		weak_names.append(str(def["short"]))
	_check("weakest, all tied", " ".join(weak_names), "Labour Business Seniors")

	# A partial tie: two blocs equally far above the middle, two equally far
	# below, and four sitting on it.
	var part := StateData.create_initial_state("blue", "", 1)
	for k in (part["blocs"] as Dictionary):
		part["blocs"][k] = 50.0
	part["blocs"]["suburban"] = 62.0
	part["blocs"]["business"] = 62.0
	part["blocs"]["activists"] = 38.0
	part["blocs"]["young"] = 38.0
	var part_names: Array[String] = []
	for row in EndingsData.decisive_blocs(part):
		part_names.append("%s:%d" % [row["name"], int(row["support"])])
	_check("decisive, partly tied", " ".join(part_names),
		"Business:62 Young:38 Suburban:62")
	var part_weak: Array[String] = []
	for def in BlocsData.weakest_blocs(part, 4):
		part_weak.append(str(def["short"]))
	_check("weakest, partly tied", " ".join(part_weak),
		"Young Activists Labour Seniors")

	# Every branch of the closing paragraph about the family, by name. The
	# coda is the last thing the player reads, so each of the six is pinned.
	var codas := [
		["both gone", 20.0, 25.0, 5.0, "", 2496496697],
		["separation", 28.0, 60.0, 5.0, "", 404532644],
		["children", 60.0, 25.0, 5.0, "", 1790932302],
		["health", 60.0, 60.0, 30.0, "atrial fibrillation", 3200155895],
		["all three", 80.0, 80.0, 70.0, "", 2894474750],
		["tired", 60.0, 60.0, 60.0, "", 911213444],
	]
	for row in codas:
		var x := StateData.create_initial_state("blue", "", 9001)
		x["family"] = People.create_family(Rng.new(9001), 55.0)
		x["personal"]["marriage"] = row[1]
		x["personal"]["family"] = row[2]
		x["personal"]["health"] = row[3]
		if not str(row[4]).is_empty():
			x["personal"]["condition"] = row[4]
		var e := EndingsData.build_ending(x, Rng.new(1),
			{"id": "x", "title": "x", "blurb": "B"})
		_check("coda: %s" % row[0], _fnv1a(str(e["blurb"]).substr(3)), row[5])


func _crises() -> void:
	print("crises: the generated table, and the half that could not be generated")
	# The table in CrisesTable is produced by scripts/export-crises.mjs from
	# the TypeScript module itself, so it cannot drift by transcription. What
	# it CAN do is drift by the generator being run against an older source
	# and never run again, so the digest covers every leaf of all 34 crises --
	# titles, briefs, choice labels, every effect number, every line of result
	# text. 1,467 leaves. Regenerate the table if this fails; do not edit it.
	var leaves: Array[String] = []
	_walk_all(CrisesTable.CRISES, "", leaves)
	_check("crisis count", CrisesTable.CRISES.size(), 34)
	_check("table leaves", leaves.size(), 1467)
	_check("table digest", _fnv1a("\n".join(leaves)), 913708655)

	# Pressure, on a lived-in state: the same twenty-four months seed 9001.
	var cs := StateData.create_initial_state("blue", "", 9001)
	var crng := Rng.new(9001)
	cs["cabinet"] = People.create_cabinet(crng)
	cs["family"] = People.create_family(crng, float(cs["personal"]["age"]))
	cs["bills"] = BillsData.bill_catalog()
	var cctx := Sim.create_sim_context(crng, 1)
	for m in range(1, 25):
		Sim.simulate_month(cs, cctx, crng, m % 3)
		cs["month"] = int(cs["month"]) + 1
	var rows: Array[String] = []
	for c in CrisesTable.CRISES:
		rows.append("%s=%s" % [c["id"], _f(CrisesData.crisis_pressure(cs, c))])
	_check("all 34 pressures", _fnv1a(";".join(rows)), 1575922842)

	var elig: Array[String] = []
	for c in CrisesData.eligible_crises(cs):
		elig.append(str(c["id"]))
	_check("eligible", " ".join(elig),
		"hurricane bank-run standoff cyberattack opioid strike outbreak court-vacancy"
		+ " leak marriage child spouse-career child-not-well anniversary border-surge"
		+ " ally-attacked wildfire cabinet-resignation shooting primary-threat")
	# The ten gated crises are absent on purpose: they are consequences, and
	# return zero pressure until something unlocks them.
	_check("gated stay out", elig.has("war-casualties") or elig.has("impeachment-push"), false)

	# Cooldown keeps one out even while its pressure is real.
	cs["crisisHistory"]["hurricane"] = int(cs["month"]) - 3
	var elig2: Array[String] = []
	for c in CrisesData.eligible_crises(cs):
		elig2.append(str(c["id"]))
	_check("hurricane on cooldown", elig2.has("hurricane"), false)
	_check("and nothing else changed", elig2.size(), elig.size() - 1)
	cs["crisisHistory"].erase("hurricane")

	# The eight briefs that name somebody in your family.
	var briefs := {"marriage": 2076935971, "child": 2716673880,
		"spouse-career": 2482107676, "child-school-call": 2433425294,
		"child-name-trading": 2285538489, "child-not-well": 2722143800,
		"anniversary": 346414679, "exhaustion": 3507180463}
	for id in briefs:
		_check("brief: %s" % id, _fnv1a(CrisesData.brief_for(id, cs)), briefs[id])

	# And again with the family carrying something, so the strain clauses --
	# "they have been carrying the career on hold on their own" -- actually
	# fire. Those clauses are the reason these eight are functions at all.
	cs["family"][0]["strain"] = {"id": "spouse-work", "label": "the career on hold",
		"detail": "d", "severity": 40.0, "months": 3}
	cs["family"][0]["since"] = 1
	cs["family"][1]["strain"] = {"id": "child-school", "label": "struggling at school",
		"detail": "d", "severity": 55.0, "months": 2}
	cs["personal"]["condition"] = "atrial fibrillation"
	var strained := {"marriage": 3402546549, "child": 2716673880,
		"spouse-career": 2482107676, "child-school-call": 2433425294,
		"child-name-trading": 2285538489, "child-not-well": 173851782,
		"anniversary": 346414679, "exhaustion": 3455344510}
	for id in strained:
		_check("strained brief: %s" % id, _fnv1a(CrisesData.brief_for(id, cs)), strained[id])
	var srows: Array[String] = []
	for c in CrisesTable.CRISES:
		srows.append("%s=%s" % [c["id"], _f(CrisesData.crisis_pressure(cs, c))])
	_check("pressures under strain", _fnv1a(";".join(srows)), 701637822)

	print("crises: the gate, the feed and the heat")
	# These three are what crisis_pressure adds on top of a crisis's own
	# expression, and all three were missing from the first port: it treated
	# crisis_pressure as nothing but the expression. Nothing caught it,
	# because a term where no crisis is ever answered never unlocks anything
	# and never accumulates heat — so the ten gated crises, which are the
	# consequences of the war you started and the cover-up you authorised,
	# were simply unreachable, and the Godot build could not contain them.
	var g := func() -> Dictionary:
		return StateData.create_initial_state("blue", "", 500)
	var war := CrisesData.by_id("war-casualties")

	# Untouched, a gated crisis is not in the pool at all.
	var gs: Dictionary = g.call()
	_check("gated, untouched", _f(CrisesData.crisis_pressure(gs, war)), "0.000000")
	var pool_has := func(state: Dictionary, id: String) -> bool:
		for c in CrisesData.eligible_crises(state):
			if c["id"] == id:
				return true
		return false
	_check("gated, out of the pool", pool_has.call(gs, "war-casualties"), false)

	# Unlocked by something the player did, it gets the flat 0.85 to fire on:
	# at that point it is not waiting on the country drifting anywhere.
	gs = g.call()
	gs["unlocked"].append("war-casualties")
	_check("unlocked", _f(CrisesData.crisis_pressure(gs, war)), "0.850000")
	_check("unlocked, in the pool", pool_has.call(gs, "war-casualties"), true)

	# Or fed by a situation that is still running, without any unlock: a war
	# names the three crises it makes likelier, and at intensity 60 each
	# picks up 60/45 on top of the gated 0.85.
	gs = g.call()
	gs["threads"].append({"id": "war", "label": "The War", "intensity": 60.0,
		"drift": -1.0, "tags": ["war"], "age": 0,
		"feeds": ["war-casualties", "anti-war-protests", "coalition-strain"]})
	_check("fed at 60", _f(CrisesData.crisis_pressure(gs, war)), "2.183333")
	_check("fed: anti-war-protests",
		_f(CrisesData.crisis_pressure(gs, CrisesData.by_id("anti-war-protests"))), "2.183333")
	_check("fed: coalition-strain",
		_f(CrisesData.crisis_pressure(gs, CrisesData.by_id("coalition-strain"))), "2.183333")
	# A gated crisis the war does not name stays shut.
	_check("not fed: inquiry",
		_f(CrisesData.crisis_pressure(gs, CrisesData.by_id("inquiry"))), "0.000000")

	# Heat multiplies rather than adds, so trouble clusters in a domain that
	# has already been in the news instead of arriving evenly.
	gs = g.call()
	var hurricane := CrisesData.by_id("hurricane")
	_check("hurricane, cold", _f(CrisesData.crisis_pressure(gs, hurricane)), "3.898351")
	gs["heat"]["climate"] = 70.0
	_check("hurricane, climate heat 70", _f(CrisesData.crisis_pressure(gs, hurricane)),
		"7.796703")
	gs["heat"]["climate"] = 140.0
	_check("hurricane, heat 140", _f(CrisesData.crisis_pressure(gs, hurricane)),
		"11.695054")

	gs = g.call()
	gs["unlocked"].append("war-casualties")
	gs["heat"]["war"] = 35.0
	gs["heat"]["security"] = 70.0
	gs["threads"].append({"id": "war", "label": "w", "intensity": 90.0, "drift": 0.0,
		"tags": ["war"], "age": 0, "feeds": ["war-casualties"]})
	# war-casualties is tagged war and foreign, so only the war heat counts.
	_check("unlocked, fed and hot", _f(CrisesData.crisis_pressure(gs, war)), "3.275000")

	# Negative heat is floored at zero per tag, not subtracted.
	gs = g.call()
	gs["heat"]["climate"] = -50.0
	_check("negative heat does not reduce", _f(CrisesData.crisis_pressure(gs, hurricane)),
		"3.898351")

	# apply_consequence, all five levers, including starting a situation that
	# is already running -- which deepens it rather than stacking a second.
	var cc := StateData.create_initial_state("blue", "", 9001)
	var thread := {"id": "war", "label": "The War", "intensity": 40.0, "drift": -2.0,
		"tags": ["war"], "perMonth": {"personal.stress": 2.0}}
	CrisesData.apply_consequence(cc, {"startsThread": thread.duplicate(true),
		"unlocks": ["war-casualties"], "heats": {"war": 30.0}})
	CrisesData.apply_consequence(cc, {"startsThread": thread.duplicate(true)})
	CrisesData.apply_consequence(cc, {"escalates": {"id": "war", "by": 15.0}})
	CrisesData.apply_consequence(cc, {"eases": {"id": "war", "by": 5.0}})
	CrisesData.apply_consequence(cc, {"unlocks": ["war-casualties", "inquiry"],
		"heats": {"war": 90.0}})
	_check("one situation, not two", (cc["threads"] as Array).size(), 1)
	_check("intensity after deepen, escalate, ease", _f(cc["threads"][0]["intensity"]),
		"70.000000")
	_check("age set on start", int(cc["threads"][0]["age"]), 0)
	_check("unlocks do not duplicate", ",".join(cc["unlocked"]), "war-casualties,inquiry")
	_check("heat is capped", _f(cc["heat"]["war"]), "100.000000")


func _arcs() -> void:
	print("arcs: the consequences that arrive with a face on them")
	# Same arrangement as the crises: the 12 arcs are generated into ArcsTable
	# and pinned by a digest over every leaf, while the two fields per arc
	# that are functions -- `when` and `brief` -- are hand-ported into
	# ArcsData and tested one at a time.
	var leaves: Array[String] = []
	_walk_all(ArcsTable.ARCS, "", leaves)
	_check("arc count", ArcsTable.ARCS.size(), 12)
	_check("arc leaves", leaves.size(), 343)
	_check("arc table digest", _fnv1a("\n".join(leaves)), 1239688672)

	# A presidency where nearly every arc is live at once: a cabinet that has
	# stopped trusting you, a child who has stopped coming home, a party out
	# of patience, and two campaign promises with receipts.
	var a := StateData.create_initial_state("blue", "", 3300)
	var arng := Rng.new(3300)
	a["cabinet"] = People.create_cabinet(arng)
	a["family"] = People.create_family(arng, float(a["personal"]["age"]))
	a["month"] = 20
	a["politics"]["scandal"] = 48.0
	a["politics"]["approval"] = 34.0
	a["politics"]["party"] = 38.0
	a["nation"]["unrest"] = 70.0
	a["personal"]["stress"] = 70.0
	a["nation"]["sectors"]["education"] = 30.0
	for c in (a["cabinet"] as Array):
		if c["office"] != "chief":
			c["loyalty"] = 40.0
	for m in (a["family"] as Array):
		if m["kind"] == "child":
			m["since"] = 7
	a["flags"]["campaign:get-ahead"] = true
	a["flags"]["campaign:base-play"] = true

	var conds: Array[String] = []
	for arc in ArcsTable.ARCS:
		conds.append("%s=%s" % [arc["id"],
			"true" if ArcsData.when_for(str(arc["id"]), a) else "false"])
	_check("every condition", " ".join(conds),
		"arc-treasury-feud=true arc-leak-source=true arc-child-away=true"
		+ " arc-primary-challenge=true arc-unrest-organised=true"
		+ " arc-rival-positioning=true arc-believer-ultimatum=true"
		+ " arc-friend-cost=false arc-institutionalist-paper=true"
		+ " arc-technocrat-starved=true arc-campaign-filing=true"
		+ " arc-base-play-bill=true")
	# arc-friend-cost is the one that stays shut: this cabinet has no friend
	# in it, and an arc about somebody you have known twenty years cannot
	# fire when there is nobody it could be about.
	var elig: Array[String] = []
	for arc in ArcsData.eligible_arcs(a):
		elig.append(str(arc["id"]))
	_check("eligible", " ".join(elig),
		"arc-treasury-feud arc-leak-source arc-child-away arc-primary-challenge"
		+ " arc-unrest-organised arc-rival-positioning arc-believer-ultimatum"
		+ " arc-institutionalist-paper arc-technocrat-starved arc-campaign-filing"
		+ " arc-base-play-bill")

	var briefs := [192523125, 146140831, 3408502186, 3255875673, 55283713,
		2735687730, 1652067517, 2194568306, 1932378450, 2518330695, 2379255567,
		823340661]
	for i in ArcsTable.ARCS.size():
		_check("brief: %s" % ArcsTable.ARCS[i]["id"],
			_fnv1a(ArcsData.brief_for(str(ArcsTable.ARCS[i]["id"]), a)), briefs[i])

	# Every fallback: no cabinet, no family, so each brief takes the branch
	# that has nobody to name. These are the lines a save from before the
	# cabinet existed would hit, and they are easy to get wrong because
	# nothing in ordinary play reaches them.
	var bare := StateData.create_initial_state("blue", "", 3300)
	bare["month"] = 20
	bare["flags"]["campaign:lawyer-up"] = true
	var bare_hashes: Array[String] = []
	for arc in ArcsTable.ARCS:
		bare_hashes.append(str(_fnv1a(ArcsData.brief_for(str(arc["id"]), bare))))
	_check("fallback briefs", ",".join(bare_hashes),
		"1968178543,57865131,3182846434,2917325184,80861380,901817905,"
		+ "3663650606,2194568306,3703664083,2475063508,1558314328,823340661")
	# The filing arc has three briefs behind one id, by which promise you made.
	var cst := StateData.create_initial_state("blue", "", 3300)
	cst["flags"]["campaign:counterstory"] = true
	_check("filing brief, counterstory branch",
		_fnv1a(ArcsData.brief_for("arc-campaign-filing", cst)), 4220491846)

	# Roughly one month in three, and weighted when it does fire.
	var picks: Array[String] = []
	for i in 12:
		var rolled := ArcsData.roll_arcs(a, Rng.new(i))
		picks.append(str(rolled["id"]) if not rolled.is_empty() else "-")
	_check("twelve rolls", " ".join(picks),
		"arc-treasury-feud - - - - - - arc-treasury-feud arc-believer-ultimatum"
		+ " arc-campaign-filing - -")

	# The hook path end to end: fire, block the month, answer, unblock.
	var h := StateData.create_initial_state("blue", "", 3300)
	h["cabinet"] = a["cabinet"]
	h["family"] = a["family"]
	h["month"] = 20
	h["politics"]["scandal"] = 48.0
	h["politics"]["approval"] = 34.0
	h["politics"]["party"] = 38.0
	h["nation"]["unrest"] = 70.0
	h["personal"]["stress"] = 70.0
	h["nation"]["sectors"]["education"] = 30.0
	h["flags"]["campaign:get-ahead"] = true
	h["flags"]["campaign:base-play"] = true
	_check("month is not blocked yet", ArcsData.arc_blocks_month(h), false)
	var fired := ArcsData.roll_month_arcs(h, Rng.new(0))
	_check("an arc fired", fired.get("id", ""), "arc-treasury-feud")
	_check("it is pending", h["pendingArc"], "arc-treasury-feud")
	_check("and it blocks the month", ArcsData.arc_blocks_month(h), true)
	_check("pending_arc finds it", ArcsData.pending_arc(h).get("id", ""), "arc-treasury-feud")
	# At most one at a time: two consequences in one month reads as noise.
	_check("no second arc", ArcsData.roll_month_arcs(h, Rng.new(0)).is_empty(), true)

	var choice: Dictionary = fired["choices"][0]
	_check("first choice", choice["id"], "repair")
	var res := ArcsData.answer_arc(h, Rng.new(2), str(choice["id"]))
	_check("it did not backfire", res["failed"], false)
	_check("result text", _fnv1a(str(res["text"])), 2405129693)
	_check("marked spent", h["flags"].get("arc:arc-treasury-feud", false), true)
	_check("counted", int(h["counters"]["arcsAnswered"]), 1)
	_check("month unblocked", h["pendingArc"], null)
	_check("capital after", _f(h["politics"]["capital"]), "55.597890")
	# One shot. An arc that has been answered does not come back.
	_check("cannot answer twice", ArcsData.answer_arc(h, Rng.new(2), str(choice["id"])).is_empty(), true)
	_check("cannot resolve a spent arc",
		ArcsData.resolve_arc(h, Rng.new(2), "arc-treasury-feud", str(choice["id"])).is_empty(), true)


func _term() -> void:
	print("the whole term: forty-eight months through EngineMonth.end_month")
	# The one that matters. Every other section tests a piece; this runs a
	# complete presidency from the swearing-in to the concession or the
	# second inaugural, through the same entry point the engine calls, and
	# hashes the entire state after every single month.
	#
	# It is set up exactly as engine.newGame does, in engine.newGame's order,
	# because the order is load-bearing: the run's Rng is seeded from the
	# state's seed and then drawn on by the sim context, the bill catalogue,
	# the cabinet, the family and the first headlines before the first month
	# begins. Move any of those and every month after it differs.
	#
	# Nothing answers the crises, so they pile up on the desk exactly as they
	# would for a president who never opens it. That is deliberate: it keeps
	# the run free of the verb layer, which is not ported yet, while still
	# exercising the crisis roll, the pressure weighting and the way an
	# unanswered crisis feeds next month's stress.
	var s := StateData.create_initial_state("blue", "", 24601)
	var rng := Rng.new(int(s["seed"]))
	var ctx := Sim.create_sim_context(rng)
	s["bills"] = BillsData.bill_catalog()
	s["cabinet"] = People.create_cabinet(rng)
	s["family"] = People.create_family(rng, float(s["personal"]["age"]))
	NewsData.push_news(s, NewsData.generate_news(s, rng))
	_check("a budget is due in month 1", EngineMonth.is_budget_pending(s), true)

	var rows: Array[String] = []
	var ending := {}
	var with_arc: Array[String] = []
	var asked: Array[String] = []
	var with_outcome: Array[String] = []
	var with_crisis := 0
	var seen_crises := {}
	for i in 60:
		if not ending.is_empty():
			break
		var r := EngineMonth.end_month(s, ctx, rng)
		var ids: Array[String] = []
		for c in (r["crises"] as Array):
			ids.append(str(c["id"]))
			seen_crises[c["id"]] = true
		var leaves := _comparable(s)
		var month_label := "m%d" % int(r["report"]["month"])
		var outcomes: Array = r["outcomes"]
		var arc: Dictionary = r["arc"]
		rows.append("|".join([
			month_label,
			"o%d" % outcomes.size(),
			"c" + ("+".join(ids) if not ids.is_empty() else "-"),
			"a" + str(arc.get("id", "-")),
			"q%s" % ("true" if r["askReelection"] else "false"),
			"n%d" % (r["report"]["notes"] as Array).size(),
			"d%d" % (r["report"]["deltas"] as Array).size(),
			"f%.6f" % float(r["report"]["deficit"]),
			"h%d" % _fnv1a("\n".join(leaves)),
		]))
		if not arc.is_empty():
			with_arc.append(month_label)
		if r["askReelection"]:
			asked.append(month_label)
		if not outcomes.is_empty():
			with_outcome.append("%so%d" % [month_label, outcomes.size()])
		if not ids.is_empty():
			with_crisis += 1
		if not (r["ending"] as Dictionary).is_empty():
			ending = r["ending"]

	_check("a full term ran", rows.size(), 48)
	_check("term digest", _fnv1a("\n".join(rows)), 1586125103)
	_check("phase", s["phase"], "ended")
	_check("month after the term", int(s["month"]), 49)

	# The shape of the presidency this seed produced, named rather than only
	# hashed, so a failure says what changed about the country.
	_check("months with a crisis", with_crisis, 35)
	var kinds: Array = seen_crises.keys()
	kinds.sort()
	_check("distinct crises", " ".join(kinds),
		"anniversary bank-run border-surge child child-name-trading cyberattack"
		+ " health-scare hurricane marriage opioid outbreak primary-threat shooting"
		+ " spouse-career standoff strike wildfire")
	_check("the one arc that arrived", " ".join(with_arc), "m9")
	# Asked once, in the month s.month crosses 34, and never again.
	_check("asked about re-election", " ".join(asked), "m33")
	# m21 is the midterms (they run once s.month has rolled to 22); m37 is a
	# week at Walter Reed.
	_check("months with something to show", " ".join(with_outcome), "m21o1 m37o1")
	_check("one health episode", int(s["counters"].get("healthEpisodes", 0)), 1)

	_check("ending id", ending["id"], "reelected")
	_check("ending title", ending["title"], "Four More Years")
	_check("ending legacy", int(ending["legacy"]), 46)
	_check("ending grade", ending["grade"], "D")
	_check("re-elected", ending["reelected"], true)
	_check("ending blurb", _fnv1a(str(ending["blurb"])), 545854312)

	var final_leaves := _comparable(s)
	_check("final leaves", final_leaves.size(), 1027)
	_check("final digest", _fnv1a("\n".join(final_leaves)), 2125011318)
	_check("news is capped at 60", (s["news"] as Array).size(), 60)
	_check("a month of history each", (s["history"] as Array).size(), 48)


func _bills() -> void:
	print("bills: the two that are gated on the state of the country")
	# The TypeScript writes these as `requires: (s) => ...` functions; the
	# port names the requirement and evaluates it in bill_requires. That is
	# the one place the two catalogues differ in shape, so it is the one
	# place that needs saying out loud.
	var cat := BillsData.bill_catalog()
	var gated: Array[String] = []
	for b in cat:
		if not str(b.get("requires", "")).is_empty():
			gated.append("%s:%s" % [b["id"], b["requires"]])
	_check("which bills are gated", " ".join(gated),
		"deficit-framework:deficit emergency-relief:relief")

	var b_def := {}
	var b_rel := {}
	for b in cat:
		if b["id"] == "deficit-framework":
			b_def = b
		elif b["id"] == "emergency-relief":
			b_rel = b

	var s := StateData.create_initial_state("blue", "", 7)
	# The deficit framework needs debt over 95% of GDP.
	s["nation"]["debtToGdp"] = 95.0
	_check("deficit gate, at the line", BillsData.bill_requires(s, b_def), false)
	s["nation"]["debtToGdp"] = 95.01
	_check("deficit gate, over it", BillsData.bill_requires(s, b_def), true)

	# Relief needs unrest over 55 OR unemployment over 7 -- either, not both.
	s["nation"]["unrest"] = 55.0
	s["nation"]["unemployment"] = 7.0
	_check("relief gate, neither", BillsData.bill_requires(s, b_rel), false)
	s["nation"]["unrest"] = 55.01
	_check("relief gate, unrest alone", BillsData.bill_requires(s, b_rel), true)
	s["nation"]["unrest"] = 20.0
	s["nation"]["unemployment"] = 7.01
	_check("relief gate, unemployment alone", BillsData.bill_requires(s, b_rel), true)

	# An ungated bill is always available.
	var plain := {}
	for b in cat:
		if str(b.get("requires", "")).is_empty():
			plain = b
			break
	_check("an ungated bill is open", BillsData.bill_requires(s, plain), true)


func _play() -> void:
	print("playing: a president who actually does the job, for a full term")
	# _term runs a presidency where nothing is ever answered. This one runs
	# the other kind, through Verbs: the budget signed every year it is due,
	# every crisis on the desk answered, a meeting taken whenever one is open,
	# a bill sent to the floor whenever there is capital for it, and the
	# leftover action points spent.
	#
	# It is the only test that exercises the verbs against a state that has
	# been through the month tick, which is where they actually run. A verb
	# tested on a fresh state proves the arithmetic; this proves the two
	# halves still fit together after four years of each changing the other.
	var s := StateData.create_initial_state("blue", "", 31337)
	var rng := Rng.new(int(s["seed"]))
	var ctx := Sim.create_sim_context(rng)
	s["bills"] = BillsData.bill_catalog()
	s["cabinet"] = People.create_cabinet(rng)
	s["family"] = People.create_family(rng, float(s["personal"]["age"]))
	NewsData.push_news(s, NewsData.generate_news(s, rng))

	var rows: Array[String] = []
	var ending := {}

	for month in 60:
		if not ending.is_empty():
			break

		if EngineMonth.is_budget_pending(s):
			var budget := {}
			for k in CoreData.BUDGET_KEYS:
				budget[k] = roundf(float(s["enacted"][k]) * 1.02)
			var o := Verbs.sign_budget(s, budget, float(s["nation"]["taxRate"]) + 0.25)
			rows.append("budget|%d|%d" % [int(s["month"]), _outcome_hash(o)])

		# Crises, cheapest affordable choice each time.
		var guard := 0
		while not (s["pendingCrises"] as Array).is_empty() and guard < 6:
			guard += 1
			var crisis := CrisesData.by_id(str(s["pendingCrises"][0]))
			var choice: Dictionary = crisis["choices"][0]
			for c in (crisis["choices"] as Array):
				if Verbs.affordable(s, crisis, c):
					choice = c
					break
			var r := Verbs.resolve_crisis(s, rng, crisis, str(choice["id"]))
			var started: Array = r.get("startedThreads", [])
			rows.append("crisis|%d|%s|%s|%d|%s" % [int(s["month"]), crisis["id"],
				choice["id"], _outcome_hash(r.get("outcome", {})), "+".join(started)])

		# A meeting, if one is open and affordable.
		for conv in ConversationsTable.CONVERSATIONS:
			if not ConversationsData.available_for(str(conv["id"]), s):
				continue
			if ActionsData.action_cooldown_left(s, conv) > 0:
				continue
			if int(s["ap"]) < int(conv["ap"]):
				continue
			var started_conv := Verbs.start_conversation(s, str(conv["id"]))
			if started_conv.is_empty():
				continue
			var active := Verbs.active_conversation(started_conv["conversation"],
				started_conv["beat"])
			var steps := 0
			var res := {}
			while steps < 10:
				steps += 1
				var opts := ConversationsData.options_for(str(conv["id"]), active["beat"],
					active["path"])
				if opts.is_empty():
					break
				# Always the first option the meeting offers, so the path is
				# the same in both engines without a second random stream.
				res = Verbs.choose_conversation_option(s, rng, active, str(opts[0]["id"]))
				if res.is_empty() or not (res["beat"] as Dictionary).is_empty():
					if res.is_empty():
						break
					continue
				break
			var path_str := ">".join(res.get("path", []) as Array) if not res.is_empty() else "undefined"
			var failed_str := ("true" if res["failed"] else "false") if not res.is_empty() else "undefined"
			rows.append("meet|%d|%s|%s|%s|%d" % [int(s["month"]), conv["id"], path_str,
				failed_str, _outcome_hash(res.get("outcome", {}))])
			break

		# A bill, if there is capital for one.
		var bill := {}
		for b in (s["bills"] as Array):
			if b.get("status", "") == "passed":
				continue
			if not BillsData.bill_requires(s, b):
				continue
			if float(s["politics"]["capital"]) < float(b["capitalCost"]) + 5.0:
				continue
			if int(s["ap"]) < 1:
				continue
			bill = b
			break
		if not bill.is_empty():
			var o := Verbs.propose_bill(s, rng, str(bill["id"]), 5.0)
			rows.append("bill|%d|%s|%d" % [int(s["month"]), bill["id"], _outcome_hash(o)])

		# Whatever action points are left. These three ids are real ones from
		# the catalogue, which is worth saying because they were not at first:
		# an earlier version spent its leftover points on "brief",
		# "rest-sleep" and "call-donors", none of which exist. Both engines
		# agreed on finding nothing, so the test passed while exercising only
		# the not-found path.
		for id in ["intel-brief", "sleep", "fundraiser"]:
			if int(s["ap"]) < 1:
				break
			var r := Verbs.perform_action(s, rng, id)
			if not r.is_empty():
				rows.append("act|%d|%s|%d" % [int(s["month"]), id,
					_outcome_hash(r["outcome"])])

		var mr := EngineMonth.end_month(s, ctx, rng)
		var ids: Array[String] = []
		for c in (mr["crises"] as Array):
			ids.append(str(c["id"]))
		rows.append("month|%d|%s|%s|h%d" % [int(mr["report"]["month"]),
			"+".join(ids) if not ids.is_empty() else "-",
			str((mr["arc"] as Dictionary).get("id", "-")),
			_fnv1a("\n".join(_comparable(s)))])
		if not (mr["ending"] as Dictionary).is_empty():
			ending = mr["ending"]

	_check("events", rows.size(), 186)
	_check("play digest", _fnv1a("\n".join(rows)), 4223038482)

	# What four years of actually governing produced, named as well as hashed.
	_check("bills passed", int(s["counters"]["billsPassed"]), 6)
	_check("bills failed", int(s["counters"]["billsFailed"]), 12)
	_check("crises handled", int(s["counters"]["crisesHandled"]), 30)
	_check("legislated spending", _f(s["counters"]["legislatedSpending"]), "500.000000")
	var passed: Array[String] = []
	for b in (s["bills"] as Array):
		if b.get("status", "") == "passed":
			passed.append(str(b["id"]))
	_check("which bills", " ".join(passed),
		"green-grid student-debt prek veterans pandemic chips-ai")
	var flags: Array = s["flags"].keys()
	flags.sort()
	_check("flags set", " ".join(flags),
		"addressed:house budget1 budget13 budget25 budget37 budget:signed"
		+ " met:cabinet reelectionAsked")
	var threads: Array[String] = []
	for t in (s["threads"] as Array):
		threads.append("%s@%.1f" % [t["id"], float(t["intensity"])])
	_check("situations still running", " ".join(threads), "fire-season@84.6")

	_check("ending id", ending["id"], "reelected")
	_check("ending legacy", int(ending["legacy"]), 58)
	_check("ending grade", ending["grade"], "C+")
	_check("ending blurb", _fnv1a(str(ending["blurb"])), 3467858252)
	_check("final month", int(s["month"]), 49)
	var final_leaves := _comparable(s)
	_check("final leaves", final_leaves.size(), 1214)
	_check("final digest", _fnv1a("\n".join(final_leaves)), 323144867)


func _engine() -> void:
	print("engine: the seam between the rules and the screen")
	# GameEngine is deliberately thin — a guard, a call and a signal — so what
	# is worth testing is not the arithmetic (every other section does that)
	# but that the signals fire, in the right order, with the right payloads,
	# and that the guards actually guard.
	var e := GameEngine.new("blue", "President Vance", 8080)
	var log_: Array[String] = []
	e.state_changed.connect(func(_s): log_.append("state"))
	e.outcome_shown.connect(func(o): log_.append("outcome:%s" % o["title"]))
	e.crisis_arrived.connect(func(c): log_.append("crisis:%s" % c["id"]))
	e.arc_arrived.connect(func(a): log_.append("arc:%s" % a["id"]))
	e.month_reported.connect(func(r): log_.append("report:%d" % int(r["month"])))
	e.term_ended.connect(func(x): log_.append("ended:%s" % x["id"]))
	e.reelection_asked.connect(func(): log_.append("reelection"))

	_check("a new game is sworn in", int(e.state["month"]), 1)
	_check("with a cabinet", (e.state["cabinet"] as Array).size(), 6)
	_check("and a family", (e.state["family"] as Array).size(), 3)
	_check("the swearing-in is logged", e.state["log"][1]["text"],
		"You are sworn in as President of the United States.")
	_check("so is the cabinet", str(e.state["log"][0]["text"]).begins_with("Cabinet confirmed:"),
		true)
	_check("three action points", int(e.state["ap"]), 3)
	_check("a budget is waiting", e.budget_pending(), true)

	# Every verb emits state after its outcome, so a listener that redraws on
	# state never paints a screen the outcome has not reached yet.
	log_.clear()
	_check("an action runs", e.perform_action("sleep"), true)
	_check("and says so", " ".join(log_).begins_with("outcome:"), true)
	_check("state follows the outcome", log_[log_.size() - 1], "state")
	_check("an action point is spent", int(e.state["ap"]), 2)
	# The same action twice in a month is a cooldown, not a second briefing.
	log_.clear()
	_check("no repeat", e.perform_action("sleep"), false)
	_check("and nothing was emitted", log_.size(), 0)
	_check("nor spent", int(e.state["ap"]), 2)
	_check("an action that does not exist", e.perform_action("no-such-action"), false)

	# The budget guard: it can only be signed in the month it is due.
	var budget := {}
	for k in CoreData.BUDGET_KEYS:
		budget[k] = float(e.state["enacted"][k])
	log_.clear()
	_check("the budget signs", e.sign_budget(budget, 18.0), true)
	_check("once", e.sign_budget(budget, 18.0), false)
	_check("and it is recorded", e.budget_pending(), false)

	# A crisis on the desk stops the month.
	e.state["pendingCrises"] = ["hurricane"]
	var blocked := e.can_end_month()
	_check("the month is blocked", blocked["ok"], false)
	_check("and says why", blocked["reason"],
		"There is a decision on your desk that cannot wait.")
	log_.clear()
	e.end_month()
	_check("end_month does nothing while blocked", log_.size(), 0)
	_check("a crisis not on the desk cannot be answered",
		e.resolve_crisis("bank-run", "backstop"), false)
	_check("nor a choice that is not on the crisis",
		e.resolve_crisis("hurricane", "no-such-choice"), false)
	_check("the real one can", e.resolve_crisis("hurricane", "delegate"), true)
	_check("the desk is clear", (e.state["pendingCrises"] as Array).size(), 0)
	_check("and it is on the record", int(e.state["counters"]["crisesHandled"]), 1)
	_check("the month is free", e.can_end_month()["ok"], true)

	# An arc blocks it for the same reason, and with its own wording.
	e.state["pendingArc"] = "arc-leak-source"
	_check("an arc blocks too", e.can_end_month()["reason"],
		"Something you did has caught up with you.")
	_check("the wrong arc id is refused", e.resolve_arc("arc-child-away", "confront"), false)
	e.state["pendingArc"] = null

	# A meeting, beat by beat.
	log_.clear()
	var started := e.start_conversation("first-cabinet")
	_check("a meeting starts", started.is_empty(), false)
	_check("at its opening beat", started["beat"], started["conversation"]["beats"]["open"])
	_check("it cannot be started twice", e.start_conversation("first-cabinet").is_empty(), true)
	var steps := 0
	var res := {}
	while steps < 10:
		steps += 1
		var opts := e.options_for(started["beat"] if steps == 1 else res["beat"], 
			res.get("path", []))
		if opts.is_empty():
			break
		res = e.choose_conversation_option(str(opts[0]["id"]))
		if res.is_empty() or (res["beat"] as Dictionary).is_empty():
			break
	_check("the meeting closes", (res["beat"] as Dictionary).is_empty(), true)
	_check("and sets its flag", e.state["flags"].get("met:cabinet", false), true)
	_check("which closes it for good",
		ConversationsData.available_for("first-cabinet", e.state), false)
	_check("an option outside a meeting does nothing",
		e.choose_conversation_option("anything").is_empty(), true)

	# Standing down is a decision with a price and a payment.
	var capital_before := float(e.state["politics"]["capital"])
	e.set_reelection(false)
	_check("not running", e.state["runningForReelection"], false)
	_check("which buys you room", float(e.state["politics"]["capital"]) > capital_before, true)
	_check("and is logged", e.state["log"][0]["text"], "You will not seek a second term.")

	print("save: a run written out and read back")
	# The save has to survive a JSON round-trip without changing the game. It
	# is not enough for the numbers to look the same: the run has to continue
	# identically, which is what the two engines are compared on everywhere
	# else and is the only thing that actually matters here.
	var a := GameEngine.new("red", "President Marsh", 4321)
	for i in 4:
		a.end_month()
	var snapshot := SaveGame.serialize(a.state)
	# Through JSON and back, which is what a real save does.
	var round_tripped: Dictionary = SaveGame.restore(JSON.parse_string(JSON.stringify(snapshot)))

	_check("month survives as a whole number", typeof(round_tripped["month"]), TYPE_INT)
	_check("and is right", int(round_tripped["month"]), int(a.state["month"]))
	_check("the seed survives", int(round_tripped["seed"]), 4321)
	_check("bills are stored thin", (round_tripped["bills"][0] as Dictionary).keys().size(), 2)

	var b := GameEngine.new("blue", "", 1)
	b.load_from(round_tripped)
	_check("bills come back whole", (b.state["bills"] as Array).size(),
		(a.state["bills"] as Array).size())
	_check("with their text", b.state["bills"][0].has("title"), true)
	_check("the president is still theirs", b.state["presidentName"], "President Marsh")
	_check("and the party", b.state["party"], "red")

	# The real test: play both on from here and see if they stay together.
	for i in 6:
		a.end_month()
		b.end_month()
	_check("a loaded run continues identically",
		_fnv1a("\n".join(_comparable(b.state))), _fnv1a("\n".join(_comparable(a.state))))
	_check("to the same month", int(b.state["month"]), int(a.state["month"]))


func _rounding() -> void:
	print("rounding: the two JavaScript rules the whole port prints through")
	# Every number the player reads goes through one of these, so getting
	# either wrong is wrong text on every screen. Both were wrong at first,
	# and neither was visible in the arithmetic — only in the words.
	#
	# toFixed and "%.1f" round the same double and disagree on one thing: a
	# genuine tie. 0.25 is exactly representable, and JavaScript rounds it
	# away from zero while C's printf rounds it to even — "0.3" against
	# "0.2". An effect of exactly +0.25 is ordinary in the crisis tables.
	#
	# 0.15 is the other half of it, and the reason js_fixed1 reads the
	# decimal expansion rather than scaling by ten: 0.15 is really
	# 0.1499999999999999944 and rounds DOWN, but 0.15 * 10.0 lands on exactly
	# 1.5 on the way and rounds up.
	var fixed := {
		0.05: "0.1", 0.15: "0.1", 0.25: "0.3", 0.35: "0.3", 0.45: "0.5",
		0.55: "0.6", 0.65: "0.7", 0.75: "0.8", 0.85: "0.8", 0.95: "0.9",
		0.1: "0.1", 0.2: "0.2", 0.3: "0.3", 0.125: "0.1", 0.0: "0.0",
		1.05: "1.1", 2.25: "2.3", -0.25: "-0.3", -0.15: "-0.1",
		-0.35: "-0.3", -0.05: "-0.1", -2.5: "-2.5", 0.999: "1.0",
		0.9999: "1.0",
	}
	for v in fixed:
		_check("toFixed(1) of %s" % String.num(v, 17), Effects.js_fixed1(v), fixed[v])

	# Math.round breaks a tie toward positive infinity, not away from zero:
	# Math.round(-2.5) is -2 where GDScript's round(-2.5) is -3. A -2.5 to
	# approval is an ordinary crisis cost, so this one shows up in play.
	var rounded := {
		2.5: 3, -2.5: -2, 3.5: 4, -3.5: -3, 1.5: 2, -1.5: -1, 0.5: 1,
		-0.5: 0, 0.49999999999999994: 0, 2.4999999999999996: 2,
		-0.4: 0, 0.4: 0, 99.5: 100, -99.5: -99, 0.0: 0, 7.0: 7,
	}
	for v in rounded:
		_check("Math.round of %s" % String.num(v, 17), Effects.js_round(v), rounded[v])

	# And the two in place, which is where they are actually read.
	_check("an effect of exactly a quarter",
		Effects.describe_effects({"nation.growth": 0.25})[0]["text"], "Growth +0.3")
	_check("and of fifteen hundredths",
		Effects.describe_effects({"nation.growth": 0.15})[0]["text"], "Growth +0.1")
	_check("a negative half-integer",
		Effects.describe_effects({"politics.approval": -2.5})[0]["text"], "Approval -2")
