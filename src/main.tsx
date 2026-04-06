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
      document.documentElement.style.setProperty(
        "--app-offset",
        `${vv.offsetTop}px`
      );
    } else {
      const h = window.innerHeight || window.screen.height;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
      document.documentElement.style.setProperty("--app-offset", "0px");
    }
  });
};

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateViewport);
  window.visualViewport.addEventListener("scroll", updateViewport);
} else {
  window.addEventListener("resize", updateViewport);
}
updateViewport();
