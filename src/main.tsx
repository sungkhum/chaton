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
 * - `visualViewport` fires a `resize` event every time the on-screen keyboard
 *   opens, closes, or the browser chrome shows/hides. Its `height` reflects
 *   only the visible area above the keyboard, which is exactly what we need.
 * - Falls back to `window.innerHeight` on browsers without `visualViewport`.
 */
const setAppHeight = () => {
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${vh}px`);
};

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", setAppHeight);
} else {
  window.addEventListener("resize", setAppHeight);
}
setAppHeight();
