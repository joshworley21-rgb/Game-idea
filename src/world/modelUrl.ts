/**
 * Where the full Oval Office model lives.
 *
 * The model is fetched into public/models/ by `npm run assets` and bundled by
 * Vite, so it ships inside the APK and loads from the app package with no
 * network access. The procedural room remains the fallback if it is missing.
 *
 * The path is relative, not absolute. vite.config.ts sets `base: "./"` so the
 * build works from a subpath, and Capacitor serves the app from a WebView
 * whose document URL is not guaranteed to be the site root. An absolute
 * "/models/..." escapes the app root and 404s, which silently drops the game
 * back to the procedural room. assetLoader.ts resolves props the same way.
 */
export const MODEL_URL = "models/OvalOffice.glb";
