extends SceneTree
## Builds public/models/Suit_Male.glb and Suit_Female.glb.
##
##   godot --headless --path . --script godot/tools/build_suit_models.gd
##
## The repository has no character meshes -- the web build drew people from
## portraits, never from geometry -- so cabinet_room.gd had nothing to put in
## the chairs and every seat fell back to its stand-in capsule. Rather than
## leave the room empty until an artist is found, this authors the two bodies
## the room asks for out of primitives and exports them through Godot's own
## glTF writer, so what lands in public/models/ is an ordinary .glb that
## imports like every other model in the repository.
##
## The figures are seated, because that is the only pose the cabinet room uses,
## and they are built as a joint hierarchy rather than a skinned mesh. A skinned
## mesh would need weights authored by hand and would buy nothing here: nothing
## in the game deforms these bodies, so rigid joints animated as node transforms
## export cleanly to glTF and reimport with no skinning to go wrong.
##
## The bodies come out of here without a clip. append_from_scene() exports no
## animations at all -- measured on 4.3, 4.4 and 4.7.2, under every track type
## and library setup -- so scripts/add_sit_animation.py writes idle_sit into the
## .glb afterwards. Run this first, then that:

##   godot --headless --path . --script godot/tools/build_suit_models.gd
##   python3 scripts/add_sit_animation.py

const OUT_DIR := "res://public/models"

## Everything is in metres, measured from the chair seat, which is y = 0. The
## heights match the stand-in body in cabinet_room.gd (torso about 0.68, head
## about 1.22) so the camera framing it computes is right for a real body too.
const HIP_HEIGHT := 0.46
const TORSO_LEN := 0.44
const TORSO_R := 0.16
const SHOULDER_Y := 0.40
const SHOULDER_X := 0.21
const NECK_Y := 0.50
const HEAD_Y := 0.68
const HEAD_R := 0.105
const UPPER_ARM_LEN := 0.26
const FOREARM_LEN := 0.26
const THIGH_LEN := 0.42
const SHIN_LEN := 0.44

## A seated frame gets read at a glance in a moving camera, so the two bodies are
## separated by silhouette and not only by colour: narrower shoulders, longer
## hair, a slightly finer torso. Both still read as "someone in a dark suit",
## which is the point.
const VARIANTS := {
	"male": {
		"shoulder_x": SHOULDER_X,
		"torso_r": TORSO_R,
		"torso_len": TORSO_LEN,
		"suit": Color(0.13, 0.15, 0.20),
		"hair": Color(0.14, 0.12, 0.10),
		"hair_scale": Vector3(1.06, 0.72, 1.04),
		"hair_offset": Vector3(0.0, 0.035, -0.012),
		"arm_r": 0.049,
	},
	"female": {
		"shoulder_x": 0.172,
		"torso_r": 0.142,
		"torso_len": 0.42,
		"suit": Color(0.20, 0.17, 0.21),
		"hair": Color(0.26, 0.16, 0.11),
		"hair_scale": Vector3(1.10, 1.18, 1.10),
		"hair_offset": Vector3(0.0, 0.012, -0.018),
		"arm_r": 0.044,
	},
}

const SKIN := Color(0.85, 0.71, 0.60)
const SHIRT := Color(0.88, 0.89, 0.92)
const SHOE := Color(0.06, 0.06, 0.07)

var _variant: Dictionary = {}
var _root: Node3D


func _initialize() -> void:
	for kind in ["male", "female"]:
		_build(kind)
	quit(0)


func _build(kind: String) -> void:
	_variant = VARIANTS[kind]
	var root := Node3D.new()
	root.name = "Suit_%s" % kind.capitalize()
	_root = root

	# ---------------------------------------------------------------- the body
	var hips := _joint(root, "Hips", Vector3(0.0, HIP_HEIGHT, 0.0))

	var torso := _joint(hips, "Torso", Vector3.ZERO)
	_capsule(torso, "Chest", _variant["torso_r"], _variant["torso_len"],
		Vector3(0.0, _variant["torso_len"] * 0.5 - 0.04, 0.0), _variant["suit"])

	# A wedge of shirt above the jacket line, so the chest is not one flat block.
	_capsule(torso, "Shirt", _variant["torso_r"] * 0.62, 0.14,
		Vector3(0.0, _variant["torso_len"] - 0.20, 0.0), SHIRT)

	var neck := _joint(torso, "Neck", Vector3(0.0, NECK_Y, 0.0))
	_capsule(neck, "Throat", 0.045, 0.10, Vector3(0.0, -0.02, 0.0), SKIN)

	var head := _joint(neck, "Head", Vector3(0.0, HEAD_Y - NECK_Y, 0.0))
	_sphere(head, "Skull", HEAD_R, Vector3(0.0, 0.0, 0.01), SKIN)
	# Hair sits past the back of the skull, which is what tells the two heads
	# apart at any distance the camera actually uses.
	var hair: MeshInstance3D = _sphere(head, "Hair", HEAD_R,
		Vector3(0.0, 0.0, 0.0) + _variant["hair_offset"], _variant["hair"])
	hair.scale = _variant["hair_scale"]

	# ------------------------------------------------------------------- arms
	var upper_len: float = UPPER_ARM_LEN
	for side in [-1.0, 1.0]:
		var tag := "L" if side < 0.0 else "R"
		var arm := _joint(torso, "Shoulder_%s" % tag,
			Vector3(side * _variant["shoulder_x"], SHOULDER_Y, 0.0))
		# A touch of outward cant, so the arms clear the torso instead of
		# intersecting it along their whole length.
		arm.rotation = Vector3(0.0, 0.0, side * deg_to_rad(7.0))
		_capsule(arm, "UpperArm_%s" % tag, _variant["arm_r"], upper_len,
			Vector3(0.0, -upper_len * 0.5, 0.0), _variant["suit"])

		var elbow := _joint(arm, "Elbow_%s" % tag, Vector3(0.0, -upper_len, 0.0))
		# Forearms come forward to rest on the table, which is what makes the
		# pose read as "sat at a meeting" and not "standing in a chair".
		elbow.rotation = Vector3(deg_to_rad(-72.0), 0.0, 0.0)
		_capsule(elbow, "Forearm_%s" % tag, _variant["arm_r"] * 0.88, FOREARM_LEN,
			Vector3(0.0, -FOREARM_LEN * 0.5, 0.0), _variant["suit"])
		_sphere(elbow, "Hand_%s" % tag, 0.052, Vector3(0.0, -FOREARM_LEN - 0.01, 0.0), SKIN)

	# ------------------------------------------------------------------- legs
	for side in [-1.0, 1.0]:
		var tag := "L" if side < 0.0 else "R"
		var thigh := _joint(hips, "Hip_%s" % tag, Vector3(side * 0.085, 0.0, 0.02))
		# Built along -Y like every other limb, then laid forward. Rotating -90
		# about X sends local -Y to world +Z, which is the direction the occupant
		# faces, so the knee ends up out in front of the chair.
		thigh.rotation = Vector3(deg_to_rad(-90.0), 0.0, 0.0)
		_capsule(thigh, "Thigh_%s" % tag, 0.077, THIGH_LEN,
			Vector3(0.0, -THIGH_LEN * 0.5, 0.0), _variant["suit"])

		var knee := _joint(thigh, "Knee_%s" % tag, Vector3(0.0, -THIGH_LEN, 0.0))
		# Undo the thigh's rotation so the shin drops straight back down.
		knee.rotation = Vector3(deg_to_rad(90.0), 0.0, 0.0)
		_capsule(knee, "Shin_%s" % tag, 0.062, SHIN_LEN,
			Vector3(0.0, -SHIN_LEN * 0.5, 0.0), _variant["suit"])

		var foot := _mesh_box(knee, "Foot_%s" % tag, Vector3(0.085, 0.055, 0.20), SHOE)
		foot.position = Vector3(0.0, -SHIN_LEN + 0.02, 0.05)

	# The idle_sit clip is not built here: append_from_scene() drops animations
	# entirely, so scripts/add_sit_animation.py writes it into the .glb after
	# this has produced the bodies. See that script's header for the run order.
	_export(root, "Suit_%s" % kind.capitalize())


## A pose joint: an empty Node3D whose local transform is what the animation and
## the export carry. Nothing here is a bone -- the hierarchy is the rig.
func _joint(parent: Node3D, name: String, at: Vector3) -> Node3D:
	var node := Node3D.new()
	node.name = name
	node.position = at
	parent.add_child(node)
	return node


func _capsule(parent: Node3D, name: String, radius: float, length: float,
		at: Vector3, colour: Color) -> MeshInstance3D:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = maxf(length, radius * 2.0 + 0.001)
	mesh.radial_segments = 12
	mesh.rings = 4
	mesh.material = _material(colour)
	return _mesh(parent, name, mesh, at)


func _sphere(parent: Node3D, name: String, radius: float, at: Vector3,
		colour: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 16
	mesh.rings = 8
	mesh.material = _material(colour)
	return _mesh(parent, name, mesh, at)


func _mesh_box(parent: Node3D, name: String, size: Vector3,
		colour: Color) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(colour)
	return _mesh(parent, name, mesh, Vector3.ZERO)


func _mesh(parent: Node3D, name: String, mesh: Mesh, at: Vector3) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = name
	node.mesh = mesh
	node.position = at
	parent.add_child(node)
	return node


func _material(colour: Color) -> StandardMaterial3D:
	# Rough and unlit by metallic response: a suit under office lighting should
	# not have a specular highlight on it, and the room supplies the light.
	var mat := StandardMaterial3D.new()
	mat.albedo_color = colour
	mat.roughness = 0.85
	mat.metallic = 0.0
	return mat


func _export(root: Node3D, name: String) -> void:
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var err := doc.append_from_scene(root, state)
	if err != OK:
		printerr("build_suit_models: append_from_scene failed for %s (%d)" % [name, err])
		quit(1)
		return
	var path := "%s/%s.glb" % [OUT_DIR, name]
	err = doc.write_to_filesystem(state, path)
	if err != OK:
		printerr("build_suit_models: write failed for %s (%d)" % [path, err])
		quit(1)
		return
	print("wrote %s" % path)
	# Detached from any tree, so nothing else will collect it, and an uncollected
	# scene buries the run's output under a page of leak warnings.
	root.free()
