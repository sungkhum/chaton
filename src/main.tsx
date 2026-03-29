import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<App />);

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
