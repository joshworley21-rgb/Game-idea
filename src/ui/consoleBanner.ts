import { showAssetError } from "./assetError.ts";

/**
 * Surfaces console errors on screen.
 *
 * The game runs in a Capacitor WebView where there is no console to read, and
 * a failed model load is a `console.error` nobody sees. Patching the console
 * here means any thrown load error is shown as the same banner assetError
 * uses, without needing a per-callsite edit in the scene code.
 */

const originalError = console.error.bind(console);

console.error = (...args: unknown[]): void => {
  originalError(...args);
  const text = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
  showAssetError("Console error", text);
};

window.addEventListener("error", (event) => {
  showAssetError("Uncaught error", `${event.message}\n${event.filename}:${event.lineno}`);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  showAssetError("Unhandled rejection", reason);
});
