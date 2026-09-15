class_name Rooms
extends RefCounted
## The rooms, and where you stand in them.
##
## Every number here was measured out of the model rather than eyeballed in an
## editor. The measuring script is scripts/measure-rooms.mjs; the bounds each
## room's seats are derived from are quoted above it.
##
## Seats are an eye point and a look-at point, never a transform. The Briefing
## Room's markers were originally authored as nine floats in a .tscn and were
## silently transposed, which put the president facing a drape a metre away
## with the seal filling the screen. A look-at point cannot be transposed: it
## is a place in the room, and it is obvious when it is wrong.

## Which room a station is in.
##
## Five of these are honest stopgaps. The web build has seven rooms — it
## builds the Cabinet Room, the Capitol, the Residence and the Private Study
## procedurally — and only three exist here as models. Until the other four
## are built, the stations that belong in them happen in the Oval Office,
## which is at least a room the president is plausibly in.
const STATION_ROOM := {
	"desk": "oval",
	"phone": "oval",
	"press": "press",
	"brief": "sitroom",
	"watch": "sitroom",
	# Pending their own rooms:
	"budget": "oval",
	"staff": "oval",
	"floor": "oval",
	"family": "oval",
	"rest": "oval",
}

## eye/look are metres in the model's own space; `label` is what the HUD says.
##
## oval: Interior01 measures x -4.80..4.80, y 0..4.80, z -5.64..5.65. The
##   Resolute Desk sits at the -z end (z -3.64..-2.41) with the curtained
##   windows behind it (z -5.63..-3.95), and the fireplace at +z (z 5.16).
##
## sitroom: the room is x -3.64..3.67, y 0..2.60, z -4.85..5.08, with the
##   conference table down the middle (z -3.75..4.12) under a 2.51 ceiling.
##
## press: the Briefing Room's own wall mesh runs x -4.22..4.14, z -10.41..
##   10.39 with the floor at y 0.02 — the same measurements the three.js
##   build's briefingModelLayout.ts derives its podium and seating from.
const ROOMS := {
	"oval": {
		"name": "The Oval Office",
		"model": "res://public/models/OvalOffice.glb",
		"ceiling": 4.8,
		"seats": [
			{"id": "desk", "label": "Behind the desk",
				"eye": Vector3(0.0, 1.22, -3.95), "look": Vector3(0.0, 1.05, 1.5)},
			{"id": "sofas", "label": "The sitting area",
				"eye": Vector3(0.0, 1.20, 1.60), "look": Vector3(0.0, 1.00, -3.0)},
			{"id": "fire", "label": "By the fireplace",
				"eye": Vector3(0.0, 1.58, 4.30), "look": Vector3(0.0, 1.10, -2.5)},
		],
		# A big room with 4.8m of ceiling and a wall of curtained window
		# behind the desk, so the key comes from -z and the fill is warm.
		"lights": [
			{"kind": "sun", "from": Vector3(-1.0, 6.0, -8.0), "to": Vector3(0.0, 1.0, 2.0),
				"colour": Color(1.0, 0.972, 0.918), "energy": 1.05, "shadow": true},
			{"kind": "omni", "at": Vector3(0.0, 4.30, 0.0),
				"colour": Color(1.0, 0.945, 0.867), "energy": 2.2, "range": 14.0},
			{"kind": "omni", "at": Vector3(0.0, 2.60, -3.0),
				"colour": Color(1.0, 0.925, 0.831), "energy": 1.1, "range": 7.0},
			{"kind": "omni", "at": Vector3(0.0, 2.20, 4.6),
				"colour": Color(1.0, 0.784, 0.573), "energy": 1.3, "range": 6.0},
		],
		"ambient": Color(0.573, 0.596, 0.651),
		"ambient_energy": 0.42,
	},
	"sitroom": {
		"name": "The Situation Room",
		"model": "res://public/models/SituationRoom.glb",
		"ceiling": 2.55,
		"seats": [
			{"id": "head", "label": "The head of the table",
				"eye": Vector3(-0.1, 1.18, 3.90), "look": Vector3(-0.1, 0.95, -3.2)},
			{"id": "screens", "label": "Facing the screens",
				"eye": Vector3(-0.1, 1.45, -3.90), "look": Vector3(-0.1, 1.30, 4.0)},
		],
		# Windowless and low, and the ceiling is the whole problem with it.
		#
		# The ceiling mesh is a 0.91 grey at 2.51m and it is what the camera
		# sees most of from a seat at the table, so it sets how the room
		# reads. It tracks AMBIENT, not the lamps: raising the lamps barely
		# moved it and dropping them did not either. So the ambient is kept
		# low and the lamps do the work, hung at head height rather than
		# under the ceiling where they scorch it.
		#
		# Worth knowing before adjusting any of this: the model has gaps
		# where the walls meet the ceiling. They are invisible against a dark
		# background and obvious against a light one, which is one reason the
		# background is a flat near-black rather than a sky.
		"lights": [
			{"kind": "omni", "at": Vector3(0.0, 1.95, 0.0),
				"colour": Color(0.902, 0.929, 1.0), "energy": 1.9, "range": 8.0},
			{"kind": "omni", "at": Vector3(0.0, 1.95, -3.4),
				"colour": Color(0.902, 0.929, 1.0), "energy": 1.3, "range": 7.0},
			{"kind": "omni", "at": Vector3(0.0, 1.95, 3.6),
				"colour": Color(0.902, 0.929, 1.0), "energy": 1.3, "range": 7.0},
			# The wall of screens, as a cold wash rather than as geometry.
			{"kind": "omni", "at": Vector3(0.0, 1.60, -4.2),
				"colour": Color(0.596, 0.749, 1.0), "energy": 1.4, "range": 4.5},
		],
		"ambient": Color(0.451, 0.494, 0.588),
		"ambient_energy": 0.16,
	},
	"press": {
		"name": "The Briefing Room",
		"model": "res://public/models/BriefingRoom.glb",
		"ceiling": 4.3,
		"seats": [
			{"id": "podium", "label": "Behind the lectern",
				"eye": Vector3(-0.08, 2.01, -7.81), "look": Vector3(-0.08, 1.50, 2.0)},
			{"id": "press", "label": "A seat in the room",
				"eye": Vector3(1.07, 1.27, -1.04), "look": Vector3(-0.08, 1.60, -7.5)},
			{"id": "camera", "label": "The broadcast platform",
				"eye": Vector3(0.79, 2.14, 7.49), "look": Vector3(-0.08, 1.70, -7.5)},
		],
		# Carried over from the rig that was tuned against this room: a weak
		# sun through the glazed -x wall, a key on the lectern, a wash on the
		# drape so the seal reads from the back, and the recessed cans.
		"lights": [
			{"kind": "sun", "from": Vector3(-6.0, 6.0, 0.0), "to": Vector3(0.0, 1.5, 0.0),
				"colour": Color(1.0, 0.968, 0.906), "energy": 0.45, "shadow": true},
			{"kind": "spot", "at": Vector3(-0.08, 3.52, -4.59),
				"to": Vector3(-0.08, 1.30, -7.60),
				"colour": Color(1.0, 0.957, 0.886), "energy": 3.2, "range": 11.0,
				"angle": 38.0, "shadow": true},
			{"kind": "spot", "at": Vector3(-0.08, 3.82, -8.01),
				"to": Vector3(-0.08, 1.80, -10.2),
				"colour": Color(0.863, 0.902, 1.0), "energy": 2.2, "range": 8.0,
				"angle": 46.0},
			{"kind": "omni", "at": Vector3(-0.04, 3.42, -3.91),
				"colour": Color(1.0, 0.941, 0.847), "energy": 1.0, "range": 11.0},
			{"kind": "omni", "at": Vector3(-0.04, 3.42, 0.09),
				"colour": Color(1.0, 0.941, 0.847), "energy": 1.0, "range": 11.0},
			{"kind": "omni", "at": Vector3(-0.04, 3.42, 4.09),
				"colour": Color(1.0, 0.941, 0.847), "energy": 1.0, "range": 11.0},
			{"kind": "omni", "at": Vector3(-0.04, 3.42, 7.59),
				"colour": Color(1.0, 0.941, 0.847), "energy": 1.0, "range": 11.0},
		],
		"ambient": Color(0.588, 0.639, 0.718),
		"ambient_energy": 0.35,
	},
}


static func room_for(station: String) -> String:
	return str(STATION_ROOM.get(station, "oval"))


## The seat a station puts you in. Stations that share a room do not share a
## seat: the desk is behind the Resolute Desk and the secure line is not.
const STATION_SEAT := {
	"desk": "desk",
	"phone": "desk",
	"budget": "sofas",
	"staff": "sofas",
	"floor": "sofas",
	"family": "fire",
	"rest": "fire",
	"press": "podium",
	"brief": "head",
	"watch": "screens",
}


static func seat_for(station: String) -> String:
	return str(STATION_SEAT.get(station, ""))
