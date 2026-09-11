/**
 * An on-screen banner for load failures.
 *
 * The game runs inside a Capacitor WebView on a phone, where there is no
 * console to read: a failed model load is a `console.error` nobody sees, and
 * the game silently falls back to the procedural room. That is exactly how the
 * Oval Office model shipped in the APK for several builds without ever being
 * displayed.
 *
 * This puts the failure on the screen instead, with the URL that failed and
 * the reason, so a sideloaded build can be diagnosed without a desktop.
 */

const BANNER_ID = "asset-error";

/** Shows a dismissible error banner. Repeated calls replace the message. */
export function showAssetError(title: string, detail: string): void {
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "alert");
    banner.style.cssText = [
      "position:fixed",
      "left:8px",
      "right:8px",
      "bottom:8px",
      "z-index:9999",
      "padding:10px 12px",
      "border-radius:10px",
      "background:rgba(120,20,20,0.94)",
      "color:#fff",
      "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
      "white-space:pre-wrap",
      "word-break:break-word",
      "box-shadow:0 6px 24px rgba(0,0,0,0.5)",
      "pointer-events:auto",
    ].join(";");

    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss");
    close.style.cssText = [
      "position:absolute",
      "top:2px",
      "right:6px",
      "background:none",
      "border:0",
      "color:#fff",
      "font-size:18px",
      "line-height:1",
      "padding:4px",
      "cursor:pointer",
    ].join(";");
    close.addEventListener("click", () => banner?.remove());

    const body = document.createElement("div");
    body.id = `${BANNER_ID}-body`;
    body.style.paddingRight = "18px";

    banner.append(body, close);
    document.body.append(banner);
  }

  const body = document.getElementById(`${BANNER_ID}-body`);
  if (body) body.textContent = `${title}\n${detail}`;
}

/** Removes the banner, if one is showing. */
export function clearAssetError(): void {
  document.getElementById(BANNER_ID)?.remove();
}
