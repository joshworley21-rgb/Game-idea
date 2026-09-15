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

## FNV-1a, 32-bit, matching the JavaScript reference.
func _fnv1a(text: String) -> int:
	var h := 0x811c9dc5
	for byte in text.to_utf8_buffer():
		h ^= byte
		h = (h * 0x01000193) & 0xFFFFFFFF
	return h


func _init() -> void:
	_rng()
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
