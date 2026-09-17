class_name OvalOffice
extends Node3D
## The Oval Office: an advisor walks in from the door and stops at the desk.
##
## The player does not walk here either, the advisor does. The room owns one
## Path3D that runs from the door to the desk; a PathFollow3D rides it, carrying
## the character model. advisor_enters(role) plays that model's walk clip while
## a Tween drives the follower's progress_ratio from 0.0 to 1.0, then swaps the
## model to idle_stand and opens the briefing card.
##
## The nodes this expects, all resolvable by name if the exports are left unset:
##
##   OvalOffice              this script
##   |- Room                 the imported room model
##   |- Camera3D             optional; the camera that watches the walk
##   |- AdvisorPath          Path3D, door -> desk
##   |   `- Advisor          PathFollow3D, the rider
##   |       `- ...          the generic suit model, one or more Node3D deep
##   `- BriefingCard         CanvasLayer running the briefing card script
##
## The follower is authored with the model already in it; this script never
## instantiates a body. It only needs to find an AnimationPlayer somewhere under
## the follower, so whatever .glb the scene drops in there is the one that walks.


## The advisor started walking in. Fired when advisor_enters() runs, before the
## tween has moved anything.
signal advisor_entered(role: String, person: Dictionary)
## The advisor reached the desk and switched to idle_stand.
signal advisor_arrived(role: String, person: Dictionary)
## The briefing card was handed the role and person.
signal briefing_opened(role: String, person: Dictionary)

@export var walk_path: Path3D
@export var follower: PathFollow3D
@export var briefing_card: Node
## How long the walk from door to desk takes, in seconds.
@export var walk_seconds: float = 3.0

## The animation clips the model is expected to carry. Looked up by name with a
## contains fallback, like cabinet_room.gd, because exported clip names are
## rarely exactly what the artist named them.
const WALK_CLIP := "walk"
const IDLE_CLIP := "idle_stand"

var _state: Dictionary = {}
var _current_role: String = ""
var _current_person: Dictionary = {}
var _tween: Tween
var _warned_missing_path := false


func _ready() -> void:
	_resolve_nodes()


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


## Make an advisor walk from the door to the desk.
##
## `role` is the same key the rest of the game uses: "chief" (or any office
## key) names someone in the cabinet, "press" and "ally" name the two specials.
func advisor_enters(role: String) -> void:
	_current_role = role.strip_edges()
	_current_person = _person_for_role(_current_role)
	advisor_entered.emit(_current_role, _current_person)

	if follower == null:
		# No path to walk: the card still has to open, and the scene still has
		# to behave, rather than sit there having swallowed the call.
		if not _warned_missing_path:
			_warned_missing_path = true
			push_warning("OvalOffice: no PathFollow3D found, so the advisor cannot walk. Add an AdvisorPath with an Advisor PathFollow3D child.")
		_on_arrived()
		return

	follower.progress_ratio = 0.0
	_play_walk()
	_kill_tween()
	_tween = create_tween()
	_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_property(follower, "progress_ratio", 1.0, walk_seconds)
	_tween.finished.connect(_on_arrived, CONNECT_ONE_SHOT)


# ------------------------------------------------------------------- the walk

func _on_arrived() -> void:
	# Stop the walking cycle before it loops over the desk, and stand.
	_play_idle_stand()
	advisor_arrived.emit(_current_role, _current_person)
	_open_briefing()


func _play_walk() -> void:
	_play_clip(WALK_CLIP)


func _play_idle_stand() -> void:
	_play_clip(IDLE_CLIP)


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
	if briefing_card == null:
		briefing_card = get_node_or_null("BriefingCard")
