# Builds

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
