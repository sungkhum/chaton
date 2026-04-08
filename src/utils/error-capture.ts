export interface ErrorContext {
  code: string;
  message: string;
  stack?: string;
  component: string;
  route: string;
  timestamp: number;
  appVersion: string;
  userAgent: string;
  platform: "web" | "pwa" | "mobile-web";
}

const MOBILE_RE = /Mobi|Android/i;

export function getAppVersion(): string {
  if (typeof document === "undefined") return "0.0.0";
  return (
    (document.querySelector('meta[name="app-version"]') as HTMLMetaElement)
      ?.content || "0.0.0"
  );
}

export function getPlatform(): "web" | "pwa" | "mobile-web" {
  const isPWA =
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)")?.matches;
  const isMobile = MOBILE_RE.test(navigator.userAgent);
  return isPWA ? "pwa" : isMobile ? "mobile-web" : "web";
}

export function captureError(
  code: string,
  message: string,
  options?: { stack?: string; component?: string }
): ErrorContext {
  return {
    code,
    message,
    stack: options?.stack?.split("\n").slice(0, 20).join("\n"),
    component: options?.component || "unknown",
    route: window.location.pathname,
    timestamp: Date.now(),
    appVersion: getAppVersion(),
    userAgent: navigator.userAgent,
    platform: getPlatform(),
  };
}
