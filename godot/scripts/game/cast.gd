class_name Cast
extends RefCounted
## Who each person is, for the view layer: which body, and which portrait.
##
## The simulation does not store a gender, and this deliberately does not add
## one to the state. Cabinet secretaries and family members are drawn from fixed
## first-name pools (CoreData.FIRST_NAMES, SPOUSE_FIRST, CHILD_FIRST), the 57
## portraits were generated against those same pools, and the state Dictionary
## is compared value-for-value against the TypeScript by godot/tests/parity.gd.
## A field added to the state would have to be added to both engines and would
## change what the parity digest covers. Nothing here is simulated, so nothing
## here belongs in the state.
##
## The name is the join key instead: it picks the body model the room
## instantiates and the portrait the dossier shows.


const PORTRAIT_ROOT := "res://godot/assets/portraits"

## How each first name in the game's pools is presented.
##
## A name can appear in more than one pool -- Marcus, Priya, Ruth, Claire,
## Samuel, Rosa and Jonah are all in two -- so this is one flat table keyed by
## name. Every one of those overlaps agrees with itself, so a single lookup is
## enough and the caller never has to say which pool it drew from.
const GENDER := {
	# CoreData.FIRST_NAMES, the cabinet pool.
	"Margaret": "female", "Daniel": "male", "Ruth": "female", "Marcus": "male",
	"Eleanor": "female", "Priya": "female", "Thomas": "male", "Grace": "female",
	"Andre": "male", "Helen": "female", "Victor": "male", "Naomi": "female",
	"Charles": "male", "Rosa": "female", "Edward": "male", "Fiona": "female",
	"Malcolm": "male", "Diane": "female", "Samuel": "male", "Yusuf": "male",
	"Claire": "female", "Nathan": "male", "Imani": "female", "Walter": "male",
	# CoreData.SPOUSE_FIRST.
	"Elena": "female", "Nadia": "female", "David": "male", "Jonah": "male",
	"Michael": "male", "Ines": "female", "Adam": "male", "Leah": "female",
	"Nicholas": "male",
	# CoreData.CHILD_FIRST.
	"Maya": "female", "Theo": "male", "Aisha": "female", "Danny": "male",
	"Nora": "female", "Elliot": "male", "Sofia": "female", "Caleb": "male",
	"Cleo": "female", "Isaac": "male", "Mara": "female", "Owen": "male",
	"Nell": "female", "Felix": "male",
}


static func first_name(person: Dictionary) -> String:
	var parts := str(person.get("name", "")).split(" ", false)
	return parts[0] if parts.size() > 0 else ""


## "female", "male", or "unspecified" for a name this table has never seen.
static func gender_of(person: Dictionary) -> String:
	var known: String = GENDER.get(first_name(person), "")
	if known != "":
		return known
	# If the simulation ever grows a real field for this, it wins: the table is
	# a stand-in for data the game does not carry yet.
	var declared := str(person.get("gender", ""))
	return declared if declared != "" else "unspecified"


## Which portrait folder this person's face lives in.
static func category_of(person: Dictionary) -> String:
	if person.has("office"):
		return "chief" if str(person["office"]) == "chief" else "cabinet"
	if person.has("kind"):
		return "family"
	if person.has("role"):
		return "special"
	return ""


## "cabinet/priya", "chief/ruth-ellery", "special/press". Empty if unnameable.
static func portrait_key(person: Dictionary) -> String:
	var category := category_of(person)
	if category == "":
		return ""
	var name_part := ""
	match category:
		# The chief is the one person whose portrait is named for the whole
		# name, because "Ruth" is also a cabinet name and a child name.
		"chief":
			name_part = slug(str(person.get("name", "")))
		"special":
			name_part = slug(str(person.get("role", "")))
		_:
			name_part = slug(first_name(person))
	if name_part == "":
		return ""
	return category + "/" + name_part


static func portrait_path(person: Dictionary) -> String:
	var key := portrait_key(person)
	return "" if key == "" else PORTRAIT_ROOT + "/" + key + ".webp"


## The face, or null when this person has none yet.
##
## A null portrait is an ordinary outcome, not an error: the art covers the name
## pools rather than a hand-cast list, so a person drawn from a pool the
## portraits do not yet include simply has no face, and the dossier says so
## rather than showing an empty frame.
static func portrait(person: Dictionary) -> Texture2D:
	var path := portrait_path(person)
	if path == "" or not ResourceLoader.exists(path):
		return null
	return load(path) as Texture2D


static func slug(text: String) -> String:
	var lower := text.strip_edges().to_lower()
	var out := ""
	var pending_dash := false
	for i in lower.length():
		var c := lower[i]
		var keep := (c >= "a" and c <= "z") or (c >= "0" and c <= "9")
		if keep:
			if pending_dash and out != "":
				out += "-"
			out += c
			pending_dash = false
		else:
			pending_dash = true
	return out
