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

/**
 * The Situation Room model.
 *
 * Unlike the Oval's, this one is committed: at 1.6 MB it is the size of a
 * prop, not of an estate, so it goes in the repo with the Poly Haven furniture
 * rather than living in a GitHub release and being fetched by `npm run assets`.
 */
export const SITROOM_MODEL_URL = "models/SituationRoom.glb";

/**
 * The Briefing Room model.
 *
 * Committed like the Situation Room's. At 4.1 MB it is the biggest thing in
 * the repo that is not the Oval, but it is a whole room — 149 placed pieces,
 * 145,000 triangles and fifty textures — and fetching it at runtime would mean
 * the press room is the one room in the game that needs a network.
 */
export const BRIEFING_MODEL_URL = "models/BriefingRoom.glb";
