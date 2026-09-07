# Content layout and import manifest

Create these folders in the Unreal Editor: `Content/Maps`, `Input`, `Architecture`, `Furniture`, `Characters`, `Animations`, `Audio`, `UI`, and `Materials`.

| Folder | Import only |
|---|---|
| Architecture | Licensed or original room shells, trim, doors, exterior meshes |
| Furniture | Licensed/original desks, chairs, podiums, papers, props |
| Characters | Skeletal meshes, approved clothing, groom/hair card assets |
| Animations | Retargeted locomotion, gestures, facial animation data |
| Audio | Licensed dialogue, ambience, music, UI cues |

No third-party or proprietary assets are included in this source project. The C++ `ExecutiveComplexBuilder` intentionally uses only `/Engine/BasicShapes/Cube` for a replaceable blockout.