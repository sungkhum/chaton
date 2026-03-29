import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<App />);

// Remove the HTML splash screen once React has mounted
const splash = document.getElementById("splash");
if (splash) {
  splash.style.transition = "opacity 0.3s ease-out";
  splash.style.opacity = "0";
  splash.addEventListener("transitionend", () => splash.remove());
}

// Register service worker (built by @serwist/vite from src/sw.ts)
async function registerSW() {
  const { getSerwist } = await import("virtual:serwist");
  const serwist = await getSerwist();
  serwist?.register();
}
registerSW();

/*
 * Fixing weird behavior for height: 100vh on Safari Mobile
 * https://stackoverflow.com/questions/37112218/css3-100vh-not-constant-in-mobile-browser
 */
const setAppHeight = () => {
  document.documentElement.style.setProperty(
    "--app-height",
    `${window.innerHeight}px`
  );
};
window.addEventListener("resize", setAppHeight);
setAppHeight();
