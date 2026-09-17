class_name OvalOffice
extends Node3D
## The Oval Office: the camera cuts to an advisor standing at the desk.
##
## The player does not move here, and neither does the advisor. advisor_enters()
## places the body on its standing mark, stands it up, and moves the camera onto
## it over cut_seconds; when the camera settles the briefing card opens.
##
## It used to walk them in, down a Path3D from the door, and that is worth
## writing down because the path is still here and still what marks the spot.
## The suit models carry one clip, idle_sit, and no walk cycle, so a body
## carried across the room arrived with its legs perfectly still -- a glide.
## Given the choice between inventing a walk cycle and not showing one, the
## room now cuts. The path survives as the two marks it always was: point one
## is the door, the last point is where an advisor stands to brief.
##
## The nodes this expects, all resolvable by name if the exports are left unset:
##
##   OvalOffice              this script
##   |- Room                 the imported room model
##   |- Camera3D             the camera that cuts
##   |- BriefingCamera       optional Marker3D; where that camera settles
##   |- AdvisorPath          Path3D, door -> desk
##   |   `- Advisor          PathFollow3D, parked at the desk end
##   |       `- ...          the generic suit model, one or more Node3D deep
##   `- BriefingCard         CanvasLayer running the briefing card script
##
## The follower is authored with the model already in it; this script never
## instantiates a body. It only needs to find the model, and an AnimationPlayer
## under it if there is one, so whatever .glb the scene drops in there is the
## one that stands at the desk.


## An advisor is coming in. Fired when advisor_enters() runs, before the body
## has been placed or the camera has moved.
signal advisor_entered(role: String, person: Dictionary)
## The camera has settled on the advisor, who is standing at the desk. This is
## the cue the briefing is ready to be read.
signal advisor_arrived(role: String, person: Dictionary)
## The briefing card was handed the role and person.
signal briefing_opened(role: String, person: Dictionary)

@export var walk_path: Path3D
@export var follower: PathFollow3D
@export var briefing_card: Node
## The camera that cuts to the advisor. Resolved by name when left unset.
@export var camera: Camera3D
## An authored vantage for the briefing shot. Optional: with no marker the
## camera stands off the advisor by the two numbers below.
@export var briefing_mark: Marker3D

## How long the cut to the advisor takes. Short on purpose -- this is a cut
## with a little travel on it, not a move the player waits through.
@export var cut_seconds: float = 0.3
## Where the camera ends up when no briefing_mark is authored: this far in
## front of the advisor, this high, looking at their head.
@export var briefing_distance: float = 1.25
@export var briefing_height: float = 1.45

## The clip a standing advisor plays, looked up by name with a contains
## fallback, like cabinet_room.gd, because exported clip names are rarely
## exactly what the artist named them.
##
## There is no walk clip any more and no WALK_CLIP to look for. The suit models
## carry only idle_sit, so asking for one found nothing and the advisor slid
## down the path with their legs still -- a glide is worse than a cut, and a
## cut needs no animation to look deliberate.
const IDLE_CLIP := "idle_stand"

var _state: Dictionary = {}
var _current_role: String = ""
var _current_person: Dictionary = {}
var _tween: Tween
var _warned_missing_path := false


func _ready() -> void:
	_resolve_nodes()
	_park_at_desk()


## Put the follower on the standing mark, and keep it there.
##
## Not left to the scene file: progress_ratio is derived from the curve's baked
## length, and when a .tscn assigns it the follower is not yet under its Path3D,
## so the length is 0, the assignment is 1.0 * 0, and the value is silently
## lost. Setting it here, after the tree is built, is the only place it sticks.
##
## loop goes off with it. A looping follower wraps its progress, so the far end
## of the path and the near end are the same place to it -- and the far end is
## exactly where this room wants to sit.
func _park_at_desk() -> void:
	if follower == null:
		return
	follower.loop = false
	follower.progress_ratio = 1.0


## Hand the room a run to resolve a role against. Safe to call before the node
## enters the tree, like cabinet_room.gd's set_state().
func set_state(state: Dictionary) -> void:
	_state = state


func current_state() -> Dictionary:
	return _state


## The role that most recently walked in, or "" before the first one.
func advisor_role() -> String:
	return _current_role


## The person that role resolved to, or {} when the role is unknown.
func advisor_person() -> Dictionary:
	return _current_person


## The body riding the path, or null when the follower is missing. The first
## Node3D child of the follower, or the follower itself when it has none.
func advisor_model() -> Node3D:
	if follower == null:
		return null
	for child in follower.get_children():
		if child is Node3D and not (child is CollisionShape3D):
			return child as Node3D
	return follower


## Where the rider currently is along the path, 0.0 at the door to 1.0 at the
## desk. -1.0 when there is no follower to ask.
func progress() -> float:
	return follower.progress_ratio if follower != null else -1.0


## Bring an advisor in, by cutting to them rather than walking them in.
##
## `role` is the same key the rest of the game uses: "chief" (or any office
## key) names someone in the cabinet, "press" and "ally" name the two specials.
##
## The advisor is placed at the desk standing, and the camera makes a short
## move onto them; when it settles the briefing card opens. Nothing translates
## across the room, which is the point: the models have no walk cycle, so a
## body carried down the path arrived with its legs perfectly still. Direction
## is cheaper than animation and does not lie about what the art can do.
func advisor_enters(role: String) -> void:
	_current_role = role.strip_edges()
	_current_person = _person_for_role(_current_role)
	advisor_entered.emit(_current_role, _current_person)

	if follower == null:
		# No path means nowhere authored to stand. The card still has to open,
		# and the scene still has to behave, rather than sit there having
		# swallowed the call.
		if not _warned_missing_path:
			_warned_missing_path = true
			push_warning("OvalOffice: no PathFollow3D found, so there is nowhere to place the advisor. Add an AdvisorPath with an Advisor PathFollow3D child.")
		_on_arrived()
		return

	# The far end of the path is the standing mark: it already carries both the
	# position at the desk and the facing, so placing the advisor is one call
	# rather than a second set of coordinates to keep in step.
	_park_at_desk()
	_stand()
	_cut_to_advisor()


# ------------------------------------------------------------------ the entry

## Move the camera onto the standing advisor, then open the briefing.
func _cut_to_advisor() -> void:
	var cam := _camera()
	if cam == null:
		# Nothing to cut with: the briefing still opens, immediately.
		_on_arrived()
		return

	_kill_tween()
	var target := _briefing_transform(cam)
	if cut_seconds <= 0.0:
		cam.global_transform = target
		_on_arrived()
		return

	_tween = create_tween()
	_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(cam, "global_transform", target, cut_seconds)
	_tween.finished.connect(_on_arrived, CONNECT_ONE_SHOT)


## Where the camera settles. An authored briefing_mark wins; otherwise stand
## off the advisor by briefing_distance at briefing_height, looking at their
## head.
##
## "In front of" is the follower's own -Z, which is the way it faces at the end
## of the path -- and at the desk that is the desk, so the shot is the one the
## player is meant to have: their own side of the Resolute, looking up at
## whoever has come to brief them.
func _briefing_transform(cam: Camera3D) -> Transform3D:
	if briefing_mark != null:
		return briefing_mark.global_transform

	var stand := follower.global_position
	var facing := -follower.global_transform.basis.z.normalized()
	var head := stand + Vector3(0.0, briefing_height, 0.0)
	var eye := head + facing * maxf(briefing_distance, 0.05)

	var look := Transform3D(Basis.IDENTITY, eye)
	if absf((head - eye).normalized().dot(Vector3.UP)) > 0.999:
		return Transform3D(cam.global_transform.basis, eye)
	return look.looking_at(head, Vector3.UP)


func _on_arrived() -> void:
	advisor_arrived.emit(_current_role, _current_person)
	_open_briefing()


## Put the advisor on their feet.
##
## Plays idle_stand when the model has one. None of them do yet -- the suits
## carry only idle_sit -- and the rest pose they fall back on is itself a
## seated one: build_suit_models.gd lays the thighs forward and the shins down,
## so an unposed body at the desk is sitting on nothing. So when there is no
## clip, the seated offsets are undone instead.
func _stand() -> void:
	if _play_idle_stand():
		return
	_stand_pose(advisor_model())


func _play_idle_stand() -> bool:
	return _play_clip(IDLE_CLIP)


## Straightens the legs and drops the arms, then lifts the body so the feet
## land on the floor.
##
## This is the rig's own seated offsets removed, not a pose invented for it:
## the hips, knees and elbows are the three joints build_suit_models.gd rotates
## to sit a figure down, and zeroing them leaves the limbs hanging along the
## bone as they were built. The lift is measured off the leg chain rather than
## hardcoded, so a model built to different proportions still lands on the
## floor.
func _stand_pose(body: Node3D) -> void:
	if body == null:
		return
	for joint_name in ["Hip_L", "Hip_R", "Knee_L", "Knee_R", "Elbow_L", "Elbow_R"]:
		var joint := _joint(body, joint_name)
		if joint != null:
			joint.rotation = Vector3.ZERO

	# With every rotation in the chain zeroed the offsets simply add, so the
	# sole's height is the sum of their local y and needs no transform flush.
	var drop := 0.0
	for joint_name in ["Hips", "Hip_L", "Knee_L", "Foot_L"]:
		var joint := _joint(body, joint_name)
		if joint != null:
			drop += joint.position.y
	if drop < 0.0:
		body.position.y -= drop


## First descendant Node3D with this name, or null. The joints sit a few levels
## down and how deep is the modeller's business.
func _joint(node: Node, wanted: String) -> Node3D:
	if node is Node3D and node.name == wanted:
		return node as Node3D
	for child in node.get_children():
		var hit := _joint(child, wanted)
		if hit != null:
			return hit
	return null


## Play the first clip under the follower whose name matches `wanted`, looping
## it. Returns true when a player had the clip.
func _play_clip(wanted: String) -> bool:
	var root := advisor_model()
	if root == null:
		return false
	for player in _animation_players(root):
		var clip := _find_clip(player, wanted)
		if clip == "":
			continue
		var animation := player.get_animation(clip)
		if animation != null:
			# Both clips are loops: the walk has to cycle for the whole three
			# seconds, and the stand has to hold until something else happens.
			animation.loop_mode = Animation.LOOP_LINEAR
		player.play(clip)
		return true
	return false


func _animation_players(root: Node) -> Array[AnimationPlayer]:
	var out: Array[AnimationPlayer] = []
	for child in root.get_children():
		if child is AnimationPlayer:
			out.append(child as AnimationPlayer)
		out.append_array(_animation_players(child))
	return out


func _find_clip(player: AnimationPlayer, wanted: String) -> String:
	var clips := player.get_animation_list()
	if clips.is_empty():
		return ""
	var want := wanted.to_lower()
	# Exact match first, then the closest thing, for the same reason
	# cabinet_room.gd does: "walk" must not lose to "walking_briskly".
	for clip in clips:
		if str(clip).to_lower() == want:
			return str(clip)
	for clip in clips:
		if str(clip).to_lower().contains(want):
			return str(clip)
	return ""


func _kill_tween() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()


# ------------------------------------------------------------------- the role

func _person_for_role(role: String) -> Dictionary:
	var key := role.to_lower()
	for person in _cabinet():
		if str(person.get("office", "")).to_lower() == key:
			return person
	# The two specials are not in the cabinet list -- the web build treats them
	# as conversation speakers, not simulated people -- but they are the other
	# faces the game can send in here, and the portraits cover them.
	match key:
		"press":
			return {"role": "press", "name": "The correspondent", "title": "Political correspondent"}
		"ally":
			return {"role": "ally", "name": "The Prime Minister", "title": "Head of government"}
	return {}


func _cabinet() -> Array:
	var cabinet = _state.get("cabinet", [])
	return cabinet if cabinet is Array else []


# ------------------------------------------------------------------ the card

func _open_briefing() -> void:
	var card := _briefing()
	if card == null:
		return
	# call() rather than a typed reference: the card is a plain node in the
	# scene, and this room should not refuse to open for a card that is a
	# variant of the one shipped here.
	if card.has_method("open_briefing"):
		card.call("open_briefing", _current_role, _current_person, Cast.portrait(_current_person))
	elif card.has_method("open_card"):
		card.call("open_card", _current_person, Cast.portrait(_current_person))
	else:
		push_warning("OvalOffice: BriefingCard has neither open_briefing() nor open_card().")
		return
	briefing_opened.emit(_current_role, _current_person)


## The camera to cut, resolved late so a scene that adds one after _ready()
## still gets a cut rather than a jump.
func _camera() -> Camera3D:
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D
	return camera


func _briefing() -> Node:
	if briefing_card == null:
		briefing_card = get_node_or_null("BriefingCard")
	return briefing_card


# -------------------------------------------------------------------- resolve

func _resolve_nodes() -> void:
	if walk_path == null:
		walk_path = get_node_or_null("AdvisorPath") as Path3D
		if walk_path == null:
			walk_path = get_node_or_null("Path3D") as Path3D
	if follower == null:
		if walk_path != null:
			follower = walk_path.get_node_or_null("Advisor") as PathFollow3D
			if follower == null:
				for child in walk_path.get_children():
					if child is PathFollow3D:
						follower = child as PathFollow3D
						break
	if camera == null:
		camera = get_node_or_null("Camera3D") as Camera3D
	if briefing_mark == null:
		briefing_mark = get_node_or_null("BriefingCamera") as Marker3D
	if briefing_card == null:
		briefing_card = get_node_or_null("BriefingCard")
