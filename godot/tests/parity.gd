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

	print("")
	if _failures == 0:
		print("parity: all checks passed")
		quit(0)
	else:
		printerr("parity: %d check(s) failed" % _failures)
		quit(1)
