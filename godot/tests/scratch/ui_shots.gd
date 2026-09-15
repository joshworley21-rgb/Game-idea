extends Node
## Opens each panel in turn and saves a frame, so the layouts get looked at
## rather than assumed. Run with:
##
##   godot --path . --rendering-driver opengl3 godot/tests/scratch/ui_shots.tscn
##
## Writes panel-*.png next to the project. Scratch tooling, not a test.

var _root: GameRoot
var _step := 0
var _out := "res://"


func _ready() -> void:
	_out = OS.get_environment("UI_SHOT_DIR")
	if _out.is_empty():
		_out = "user://"
	# No background fill: there is a real room behind the overlay now, and a
	# ColorRect added outside a CanvasLayer draws on top of the 3D viewport.
	_root = GameRoot.new()
	add_child(_root)


func _process(_delta: float) -> void:
	_step += 1
	match _step:
		2: _root._open_station("desk")
		3: _root.panels.close()
		4: _save("room-oval")
		5: _root._open_station("brief")
		6: _root.panels.close()
		7: _save("room-sitroom")
		8: _root._open_station("press")
		9: _root.panels.close()
		10: _save("room-press")
		11: _root._open_station("family")
		12: _root.panels.close()
		13: _save("room-fire")
		14: _root._open_station("desk")
		22: _save("station")
		23: _root.panels.close()
		26: _root.panels.crisis(_root.engine.state, CrisesData.by_id("hurricane"))
		30: _save("crisis")
		31: _root.panels.close()
		34:
			var rng := Rng.new(5)
			var ctx := Sim.create_sim_context(rng)
			_root.panels.report(_root.engine.state,
				Sim.simulate_month(_root.engine.state, ctx, rng, 1))
		38: _save("report")
		39: _root.panels.close()
		40: _root._open_station("press")
		42: _save("press")
		43: _root._start_meeting("interview")
		46: _save("meeting")
		47: _root._take_a_line("counterattack")
		49: _save("meeting2")
		50: _root.panels.close()
		52: _root.panels.arc(_root.engine.state, ArcsData.by_id("arc-leak-source"))
		56: _save("arc")
		57: _root.panels.close()
		60: _root.panels.ending(EndingsData.build_ending(_root.engine.state, Rng.new(3), {}))
		64:
			_save("ending")
			get_tree().quit(0)


func _save(shot_name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	var path := "%s/panel-%s.png" % [_out.rstrip("/"), shot_name]
	var err := img.save_png(path)
	print("saved ", path, " err=", err)
