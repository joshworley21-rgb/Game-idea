# Builds

There are two Android builds of this game, from the same repository:
`oval-president-debug.apk` wraps the web build in Capacitor, and `Oval.apk`
is the Godot port. They are separate binaries and separate package names, so
both can be installed side by side.

## `Oval.apk` — the Godot build

Not committed: it is about 147 MB, over GitHub's 100 MB file limit. It is
built by `.github/workflows/build-godot-apk.yml` on every push that touches
the Godot project, and downloaded from that run's artifacts. To build it
yourself you need Godot 4.3, its export templates, and an Android SDK with
build-tools 34; the workflow is the reference for how those are wired up.

The size is the rooms, not the engine: a release export saves less than two
megabytes, because 82 MB of it is models and textures.

## `oval-president-debug.apk`

A sideloadable Android build of the game. Download it, allow installs from
your browser or file manager when Android asks, and open it.

**It is debug-signed.** That is fine for sideloading and for passing round, and
it is not fine for the Play Store or for anywhere a signature needs to mean
something: a debug key is a well-known key, so it proves nothing about who
built the file. For a real release, generate your own keystore and add a
`signingConfig` to `android/app/build.gradle` — no keystore or password belongs
in this repository.

Rebuild it with:

```bash
npm run android:apk
cp android/app/build/outputs/apk/debug/app-debug.apk releases/oval-president-debug.apk
```

Minimum Android 7.0 (API 24). The game runs entirely on-device; there is no
network call after install.
