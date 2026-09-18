# Model credits

## Rooms

**SituationRoom.glb** — the White House Situation Room (the JFK Conference
Room), modelled in SketchUp by **Hlostoops**, supplied by the project owner
along with its six textures. Converted from COLLADA with
`node scripts/convert-collada-room.mjs`, which is where the whole conversion —
and the reasons for each step of it — is written down. 617k triangles and
62 MB as exported; 135k and 1.6 MB as shipped.

**BriefingRoom.glb** — the James S. Brady Press Briefing Room, from a Unity
asset pack modelled in 3ds Max and supplied by the project owner. Converted from
the `.unitypackage` with `node scripts/convert-unity-room.mjs`, which is where
the whole conversion — and the reasons for each step of it — is written down.
149 placed prefabs and 259k triangles as packed; 145k and 4.1 MB as shipped. One
texture, `water 4.png`, is missing from the pack itself.

**BR_*.glb** — the same pack's sixteen parts as standalone props, which is how
the briefing room was dressed before the whole room was converted. Thirteen of
them ship; the Floor and Ceiling slabs are 8 x 21m, the wrong shape for the
procedural room they dress, and Door_1 is 1.33m tall, too short to read as a
door. Converted with `node scripts/convert-fbx-props.mjs`. 17,454 triangles,
768 KB. They are what the procedural briefing room is still built from, and so
what you see if BriefingRoom.glb does not load.

**CR_*.glb** — the Cabinet Room, from a "Conference Room" Unreal Engine 4 pack
supplied by the project owner. It arrived twice: once as a `.uproject` of
`.uasset` files, which only Unreal can open, and once as source — 22 FBX meshes
and 43 TGA/PNG textures, which is the copy that was used. Converted with `node
scripts/convert-conference-room.mjs`, which is where the conversion and every
decision in it is written down. 22 pieces, 38,162 triangles and 2.1 MB as
shipped, from 63,010 triangles and 588 MB of textures as supplied.

The layout is not in any of it. The room's arrangement existed only in the
pack's Unreal `.umap`, so the pieces are modelled around their own origins and
`godot/scenes/cabinet_room.tscn` places them by hand, off measurements taken
from the meshes.

Two pieces are deliberately not converted: `Light_Blocking`, a lightmass shell
that would simply hide the room in Godot, and `Speaker`, a 20,188-triangle
floor-standing tower whose grille is built as hundreds of separate closed
shells — the same thing that stops meshoptimizer touching the Situation Room's
chair casters, and for the same reason it cannot be reduced.

**The licence has not been established.** The pack looks like Unreal Marketplace
content, and Epic's content licence generally covers use in projects built with
Unreal Engine rather than in a Godot game. Settle that before shipping this.

**OvalOffice.glb** is not in the repo: at ~12 MB it lives as a GitHub release
asset and `npm run assets` fetches it.

## Props

Every prop here comes from [Poly Haven](https://polyhaven.com), released under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/): free for any use, no
attribution required. Credited anyway, because the people who made them deserve it.

Rebuild or extend the set with `npm run assets`.

| Model | Author(s) |
| --- | --- |
| [Sofa 01](https://polyhaven.com/a/Sofa_01) | Kirill Sannikov |
| [Arm Chair 01](https://polyhaven.com/a/ArmChair_01) | Kirill Sannikov |
| [Coffee Table 01](https://polyhaven.com/a/CoffeeTable_01) | Fernando Quinn |
| [Classic Console 01](https://polyhaven.com/a/ClassicConsole_01) | Kirill Sannikov |
| [Shelf 01](https://polyhaven.com/a/Shelf_01) | Gabriel Radić |
| [Wooden Table 02](https://polyhaven.com/a/WoodenTable_02) | Fran Calvente |
| [Fancy Picture Frame 01](https://polyhaven.com/a/fancy_picture_frame_01) | Rob Tuytel, Rico Cilliers |
| [Vintage Grandfather Clock 01](https://polyhaven.com/a/vintage_grandfather_clock_01) | Yann Kervran, James Ray Cock |
| [Chandelier 01](https://polyhaven.com/a/Chandelier_01) | Kirill Sannikov |
| [Book Encyclopedia Set 01](https://polyhaven.com/a/book_encyclopedia_set_01) | John Malcolm |
| [Potted Plant 01](https://polyhaven.com/a/potted_plant_01) | Rico Cilliers |
