# President Simulator — Unreal Engine 5 foundation

This is a source-only UE 5.4+ project for an offline, first-person presidential leadership simulator. It does **not** include binary `.uasset` content, character assets, or an APK; those must be generated in Unreal Editor on a supported build machine.

## Editor bootstrap

1. Install Unreal Engine **5.4 or newer** with Android support if targeting Android. Right-click `PresidentSimulator.uproject` and choose **Generate Visual Studio project files** (or open it in Rider/Xcode).
2. Open the project and allow UE to compile `PresidentSimulator`. A source-only checkout starts on `/Engine/Maps/Entry`; `PresidentGameMode` creates the primitive complex automatically when no `ExecutiveComplexBuilder` is already in the world.
3. For an authored replacement, create `/Game/Maps/ExecutiveComplex`, make it the Editor Startup Map and Game Default Map, and place an `ExecutiveComplexBuilder`. Use **Build Complex** in Details to make the primitive blockout, or turn on **Build On Begin Play** for that placed actor. Do not both invoke **Build Complex** in the saved map and leave generated child actors in it.
4. Create `/Game/Input/IA_Move` and `IA_Look` (Axis2D), and `IA_Sprint`, `IA_Interact`, `IA_Dashboard` (Bool). Create `IMC_President`, map WASD/left stick, mouse/right stick, Shift, E, and Tab respectively. Create a Blueprint derived from `APresidentCharacter`, assign those assets, and set it as the GameMode pawn if needed.
5. Build UMG widgets that bind to `UPresidentialGameInstance::OnStateChanged`, `OnActionResolved`, and `OnCrisisRaised`. Bind station UI routing to `APresidentialStation::OnStationInteracted`; its category and interacting pawn identify the panel to open. The generated Oval contains Resolute Desk/Secure Line, the Cabinet Room has Cabinet/Budget and Staff/West Wing, and the remaining four stations occupy their named rooms. Portals are interactable and teleport to the paired room-side arrival transform.

## Character and conversation quality

Import only licensed/original characters. A high-quality path may use MetaHuman through Epic's permitted workflow, or licensed alternatives; it is not supplied here. Establish LODs for skeletal mesh, materials and hair cards/grooms, mobile material variants, retargeted locomotion and facial performance before shipping. `APresidentialNpcCharacter` exposes supporting-role tier, dialogue focus, and Blueprint facial-curve handoff points for Control Rig/Live Link. `UConversationDirectorComponent` supplies speaker/listener framing hooks. It does not claim to ship MetaHuman or Live Link assets.

## Android offline packaging

1. In UE Project Settings → Platforms → Android, configure the Android Studio SDK, NDK, JDK, and accepted SDK licenses matching your installed UE version. Use `com.neutralcivic.presidentsimulator` or your own legally controlled package identifier.
2. Keep Vulkan enabled and ES3.1 enabled as the compatibility fallback. Review device profiles, scalable renderer defaults, texture formats, and memory on target hardware.
3. Use **Platforms → Android → Package Project** for an installable APK during local/offline sideload testing. Use an AAB for Play Store delivery; Google Play generates device APKs from it.
4. Configure signing only in secure local/CI Android signing settings. Never commit keystores, passwords, or signing credentials. Distribution signing and store enrollment remain the publisher's responsibility.

After the Editor bootstrap and Android toolchain setup, repeatable command-line packaging is available in `Build/Android`:

```powershell
$env:UE_ROOT="C:\Program Files\Epic Games\UE_5.4"
.\Build\Android\PackageAndroid.ps1 -Configuration Development
```

Use `Shipping` only after configuring release signing securely outside source control. The scripts write packages to `Releases/Android` by default.

Run the source check without Unreal from this directory:

```sh
node scripts/validate-project.mjs
```

The blockout relies on engine primitives and is Blueprint-friendly. It is intentionally a foundation: authored data tables, UI assets, maps, input assets, imported architecture/furniture/audio, and final Android binaries remain Editor/build-machine work.