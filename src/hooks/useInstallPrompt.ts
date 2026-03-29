import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type Platform = "ios" | "android" | "desktop";
export type Browser =
  | "safari"
  | "chrome"
  | "chrome-ios"
  | "firefox"
  | "edge"
  | "samsung"
  | "opera"
  | "unknown";

/**
 * What kind of install flow should we show?
 *
 * - `native`           – Chromium `beforeinstallprompt` is available
 * - `manual-ios`       – iOS Safari, show share→"Add to Home Screen" steps
 * - `manual-ios-other` – iOS in a non-Safari browser, ask them to open Safari
 * - `manual-firefox`   – Firefox Android menu instructions
 * - `manual-samsung`   – Samsung Internet menu (beforeinstallprompt is unreliable)
 * - `manual-macos`     – macOS Safari "Add to Dock"
 * - `none`             – Already installed, unsupported, or dismissed recently
 */
export type InstallType =
  | "native"
  | "manual-ios"
  | "manual-ios-other"
  | "manual-firefox"
  | "manual-samsung"
  | "manual-macos"
  | "none";

export interface InstallPromptState {
  platform: Platform;
  browser: Browser;
  installType: InstallType;
  isInstalled: boolean;
  /** Call this for `native` installs — triggers the browser prompt. */
  triggerNativeInstall: () => Promise<"accepted" | "dismissed" | null>;
  /** User tapped "Not now" — records dismissal with cooldown. */
  dismiss: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LS_DISMISS_KEY = "chaton-install-dismissed-at";
const LS_VISITS_KEY = "chaton-visit-count";
const DISMISS_COOLDOWN_DAYS = 14;
const MIN_VISITS = 2;

function getPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function getBrowser(): Browser {
  const ua = navigator.userAgent || "";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/Edg/i.test(ua)) return "edge";
  if (/OPR|Opera/i.test(ua)) return "opera";
  if (/CriOS/i.test(ua)) return "chrome-ios";
  if (/Chrome/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "unknown";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isDismissedRecently(): boolean {
  const ts = parseInt(localStorage.getItem(LS_DISMISS_KEY) || "0", 10);
  if (!ts) return false;
  const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_COOLDOWN_DAYS;
}

function getVisitCount(): number {
  return parseInt(localStorage.getItem(LS_VISITS_KEY) || "0", 10);
}

function incrementVisitCount(): void {
  localStorage.setItem(LS_VISITS_KEY, String(getVisitCount() + 1));
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useInstallPrompt(): InstallPromptState {
  const platform = getPlatform();
  const browser = getBrowser();
  const installed = isStandalone();

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(isDismissedRecently);
  const [visitCountReady, setVisitCountReady] = useState(
    () => getVisitCount() >= MIN_VISITS
  );

  // Increment visit count once per session (per page load).
  useEffect(() => {
    incrementVisitCount();
    if (getVisitCount() >= MIN_VISITS) setVisitCountReady(true);
  }, []);

  // Listen for beforeinstallprompt (Chromium only).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setNativeAvailable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      deferredPrompt.current = null;
      setNativeAvailable(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const triggerNativeInstall = useCallback(async () => {
    if (!deferredPrompt.current) return null;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setNativeAvailable(false);
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(LS_DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  // Determine install type.
  let installType: InstallType = "none";

  if (!installed && !dismissed && visitCountReady) {
    if (nativeAvailable) {
      installType = "native";
    } else if (platform === "ios" && browser === "safari") {
      installType = "manual-ios";
    } else if (platform === "ios") {
      installType = "manual-ios-other";
    } else if (platform === "android" && browser === "samsung") {
      // Samsung Internet's beforeinstallprompt is unreliable (known bug in v27+).
      // Fall back to manual instructions if the native event never fired.
      installType = "manual-samsung";
    } else if (platform === "android" && browser === "firefox") {
      installType = "manual-firefox";
    } else if (platform === "desktop" && browser === "safari") {
      installType = "manual-macos";
    }
    // Desktop Firefox dropped PWA support entirely — nothing to show.
  }

  return {
    platform,
    browser,
    installType,
    isInstalled: installed,
    triggerNativeInstall,
    dismiss,
  };
}
