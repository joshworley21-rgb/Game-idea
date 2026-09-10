/**
 * Where the full Oval Office model lives.
 *
 * The model is fetched into public/models/ by `npm run assets` and bundled by
 * Vite, so it ships inside the APK and loads from the app package with no
 * network access. The procedural room remains the fallback if it is missing.
 */
export const MODEL_URL = "/models/OvalOffice.glb";
