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


## FNV-1a, 32-bit, matching the JavaScript reference.
func _fnv1a(text: String) -> int:
	var h := 0x811c9dc5
	for byte in text.to_utf8_buffer():
		h ^= byte
		h = (h * 0x01000193) & 0xFFFFFFFF
	return h


func _init() -> void:
	print("rng: mulberry32 sequence from seed 12345")
	var rng := Rng.new(12345)
	var golden := [
		"0.979728", "0.306752", "0.484205", "0.817934", "0.509428", "0.347472",
	]
	for i in golden.size():
		_check("draw %d" % i, _f(rng.next()), golden[i])

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

	print("actions: how many each station offers in month 1, seed 4242")
	var a := StateData.create_initial_state("blue", "", 4242)
	var want := {"desk": 3, "press": 2, "budget": 0, "staff": 2, "floor": 1, "phone": 3, "rest": 5}
	for station in ["desk", "press", "budget", "staff", "floor", "phone", "rest"]:
		_check(station, ActionsData.actions_for(a, station).size(), want[station])

	print("fiscal: the budget arithmetic on the opening position, seed 9001")
	var f := StateData.create_initial_state("blue", "", 9001)
	_check("revenue", _f(StateData.annual_revenue(f)), "4900.000000")
	_check("debt service", _f(StateData.debt_service(f)), "891.795063")
	_check("discretionary", _f(StateData.total_discretionary(f["enacted"])), "5789.000000")
	_check("deficit", _f(StateData.annual_deficit(f)), "1780.795063")
	_check("approval target", _f(Sim.approval_target(f)), "50.808796")
	_check("potential growth", _f(Sim.potential_growth(f)), "1.933208")

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

	print("")
	if _failures == 0:
		print("parity: all checks passed")
		quit(0)
	else:
		printerr("parity: %d check(s) failed" % _failures)
		quit(1)
