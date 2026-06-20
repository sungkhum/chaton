/**
 * App theme (light / dark) preference.
 *
 * ChatOn is dark-first: the dark palette is the default and the brand identity.
 * Users can opt into a light theme from Settings. The preference is a per-device
 * choice persisted to localStorage (not on-chain) and applied as a class on
 * <html>, which re-themes the whole app via the CSS variables in index.css.
 *
 * Only the in-app messaging shell honors the preference — public/marketing
 * routes (landing, blog, legal, join, …) always render dark, matching the
 * brand site. See {@link isAppThemePath}.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "chaton:theme";

/** Browser chrome / status-bar color per theme (mirrors --app-bg in index.css). */
const THEME_COLOR: Record<Theme, string> = {
  dark: "#040609",
  light: "#eef2f8",
};

/** Read the persisted preference. Defaults to dark (the brand default). */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** Persist the preference. Best-effort — private-mode storage failures are ignored. */
export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode) — preference is session-only */
  }
}

/**
 * Routes that honor the user's theme. Everything else (marketing, blog, legal,
 * join, the logged-out landing page) stays dark regardless of preference.
 */
export function isAppThemePath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/chat/");
}

/**
 * Apply a theme to <html>: toggle the class and sync the color-scheme and
 * theme-color meta tags so native form controls and browser chrome match.
 */
export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);

  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}
