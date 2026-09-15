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
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.13, 0.16, 0.19)
	add_child(bg)
	_root = GameRoot.new()
	add_child(_root)


func _process(_delta: float) -> void:
	_step += 1
	match _step:
		4: _root._open_station("desk")
		8: _save("station")
		9: _root.panels.close()
		12: _root.panels.crisis(_root.engine.state, CrisesData.by_id("hurricane"))
		16: _save("crisis")
		17: _root.panels.close()
		20:
			var rng := Rng.new(5)
			var ctx := Sim.create_sim_context(rng)
			_root.panels.report(_root.engine.state,
				Sim.simulate_month(_root.engine.state, ctx, rng, 1))
		24: _save("report")
		25: _root.panels.close()
		26: _root._open_station("press")
		28: _save("press")
		29: _root._start_meeting("interview")
		32: _save("meeting")
		33: _root._take_a_line("counterattack")
		35: _save("meeting2")
		36: _root.panels.close()
		38: _root.panels.arc(_root.engine.state, ArcsData.by_id("arc-leak-source"))
		42: _save("arc")
		43: _root.panels.close()
		46: _root.panels.ending(EndingsData.build_ending(_root.engine.state, Rng.new(3), {}))
		50:
			_save("ending")
			get_tree().quit(0)


func _save(shot_name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	var path := "%s/panel-%s.png" % [_out.rstrip("/"), shot_name]
	var err := img.save_png(path)
	print("saved ", path, " err=", err)
