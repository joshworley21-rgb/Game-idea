# Browser-to-Unreal port map

| Browser system | Unreal foundation |
|---|---|
| `GameState`, `Nation`, `Politics`, `Personal` | `FPresidentialGameState`, `FNationalState`, `FPoliticalState`, `FPersonalState` |
| Actions and station IDs | `FPresidentialAction`, `EStationCategory`, `APresidentialStation` |
| Engine action/bill/crisis/month flow | `UPresidentialGameInstance` |
| Save/load state | `UPresidentialSaveGame`, `UPresidentialSaveLibrary` |
| Room kit, doors and anchors | `AExecutiveComplexBuilder`, `ARoomPortal`, station actors |
| Character/station proximity | `APresidentCharacter` and `IPresidentialInteractable` |
| Conversation presentation | `UConversationDirectorComponent`, `APresidentialNpcCharacter` |

The browser catalog's authored bills, crisis choice text, faction/bloc calculation, news generator, and detailed modifiers should be migrated as DataTables or Primary Data Assets. The C++ layer provides authority and validation, not a claim of feature parity with every browser content record.