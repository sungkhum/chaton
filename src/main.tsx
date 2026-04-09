import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<App />);

// Register service worker (built by @serwist/vite from src/sw.ts)
async function registerSW() {
  const { getSerwist } = await import("virtual:serwist");
  const serwist = await getSerwist();
  serwist?.register();
}
registerSW();

/*
 * Reliable mobile viewport height that accounts for virtual keyboard.
 *
 * On iOS, the keyboard doesn't resize the layout viewport — only the visual
 * viewport shrinks. iOS also scrolls the page to keep the focused input
 * visible, which shifts `visualViewport.offsetTop`. We track both values
 * and use a CSS transform on `.App` to stay pinned to the visible area.
 *
 * Falls back to `window.innerHeight` on browsers without `visualViewport`.
 */
const isInputFocused = () => {
  const a = document.activeElement;
  return (
    a instanceof HTMLTextAreaElement ||
    a instanceof HTMLInputElement ||
    (a instanceof HTMLElement && a.isContentEditable)
  );
};

let _vpRaf = 0;
const updateViewport = () => {
  cancelAnimationFrame(_vpRaf);
  _vpRaf = requestAnimationFrame(() => {
    const vv = window.visualViewport;
    if (vv) {
      // Guard against 0 height — can happen on PWA resume from suspension
      // on some iOS/Android versions, causing content to be invisible.
      const h =
        vv.height > 0 ? vv.height : window.innerHeight || window.screen.height;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
      // Only trust offsetTop when a text input is focused (keyboard is open).
      // iOS Safari can report stale non-zero offsetTop after keyboard dismiss,
      // especially when DOM mutations trigger visualViewport scroll events.
      const offset = isInputFocused() ? vv.offsetTop : 0;
      document.documentElement.style.setProperty("--app-offset", `${offset}px`);
    } else {
      const h = window.innerHeight || window.screen.height;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
      document.documentElement.style.setProperty("--app-offset", "0px");
    }
  });
};

/*
 * On iOS, keyboard show/hide animates the visual viewport. The resize/scroll
 * events fire during the animation, but the rAF-debounced handler may capture
 * an intermediate state. A single debounced 300ms retry after the last event
 * ensures we read the final settled values (height + offsetTop).
 */
let _vpRetryTimer = 0;
const updateViewportAndRetry = () => {
  updateViewport();
  clearTimeout(_vpRetryTimer);
  _vpRetryTimer = window.setTimeout(updateViewport, 300);
};

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateViewportAndRetry);
  window.visualViewport.addEventListener("scroll", updateViewportAndRetry);
} else {
  window.addEventListener("resize", updateViewport);
}
updateViewport();

/*
 * Force a clean viewport reset when the keyboard dismisses.
 *
 * iOS Safari can leave visualViewport.offsetTop and height in a stale state
 * after keyboard dismiss. When focus leaves a text input, wait for the
 * keyboard animation to finish, then force --app-offset to 0 and re-read
 * the height. The 400ms delay covers the iOS keyboard close animation.
 */
document.addEventListener("focusout", (e) => {
  if (
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLInputElement
  ) {
    setTimeout(() => {
      if (!isInputFocused()) {
        document.documentElement.style.setProperty("--app-offset", "0px");
        updateViewport();
      }
    }, 400);
  }
});

/*
 * Fix stale keyboard height on app resume.
 *
 * When the PWA is backgrounded with the keyboard open, iOS can report a stale
 * (keyboard-reduced) visualViewport.height when the app comes back. Blur the
 * active element to dismiss any lingering keyboard state, then force a
 * viewport recalculation. A short delay is needed because iOS doesn't update
 * visualViewport synchronously on resume.
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Only blur if the viewport looks stale (keyboard height still baked in).
    // A >150px gap between screen height and visualViewport suggests the OS
    // is still reporting the keyboard-reduced height from before backgrounding.
    const vv = window.visualViewport;
    const screenH = window.innerHeight || window.screen.height;
    const looksStale = vv && screenH - vv.height > 150;

    if (looksStale) {
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      ) {
        active.blur();
      }
    }
    // iOS needs a moment to update visualViewport after resume
    updateViewport();
    setTimeout(updateViewport, 100);
    setTimeout(updateViewport, 300);
  }
});
