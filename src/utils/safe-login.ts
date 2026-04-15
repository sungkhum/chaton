import { configure, identity } from "deso-protocol";
import { toast } from "sonner";
import { DESO_NETWORK, getTransactionSpendingLimits } from "./constants";

/**
 * Detect environments where popups don't work reliably.
 * - Standalone PWA: window.open() opens a new browser tab, breaking postMessage
 * - Mobile: in-app browsers and iOS Safari aggressively block popups
 * - In-app browsers: WebViews from social apps block popups entirely
 *
 * Exported so App.tsx can use it for the initial configure() call.
 */
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isInAppBrowser =
  /FBAN|FBAV|Instagram|Twitter|LinkedInApp|Line\/|MicroMessenger|WeChat|Snapchat|TikTok|BytedanceWebview|Telegram/i.test(
    navigator.userAgent
  );
export const useRedirectFlow = isStandalone || isMobile || isInAppBrowser;

const POPUP_TIMEOUT_MS = 4000;

/**
 * Login wrapper with popup-blocker detection and redirect fallback.
 *
 * On mobile/PWA/in-app browsers: uses redirect flow directly (already configured).
 * On desktop: tries popup first. The deso-protocol SDK has no popup-blocker
 * detection — when blocked, window.open() returns null and the login promise
 * hangs forever. We race against a 4s timeout and show a toast with a redirect
 * fallback button if the popup didn't open.
 */
export function safeLogin(): void {
  if (useRedirectFlow) {
    identity.login().catch(() => {
      toast.error("Login failed. Please try again.");
    });
    return;
  }

  // Desktop: try popup, detect if blocked via timeout
  let settled = false;

  const timeoutId = setTimeout(() => {
    if (!settled) {
      toast.error("Login popup may be blocked by your browser.", {
        duration: 20000,
        description:
          "Check your popup blocker settings, or use the button below.",
        action: {
          label: "Open login page",
          onClick: () => {
            toast.dismiss();
            loginViaRedirect();
          },
        },
      });
    }
  }, POPUP_TIMEOUT_MS);

  identity
    .login()
    .then(() => {
      settled = true;
      clearTimeout(timeoutId);
    })
    .catch((err: any) => {
      settled = true;
      clearTimeout(timeoutId);
      const msg = err?.message || err?.toString?.() || "";
      if (msg.includes("user cancelled") || msg.includes("WINDOW_CLOSED")) {
        return;
      }
      toast.error("Login failed. Please try again.");
    });
}

/**
 * Fallback: reconfigure with redirectURI and trigger redirect-based login.
 * The page navigates to identity.deso.org, and on return App.tsx calls
 * identity.handleRedirectURI() to complete the flow.
 */
function loginViaRedirect(): void {
  configure({
    identityURI: import.meta.env.VITE_IDENTITY_URL,
    nodeURI: import.meta.env.VITE_NODE_URL,
    network: DESO_NETWORK,
    spendingLimitOptions: getTransactionSpendingLimits(""),
    redirectURI: window.location.origin + window.location.pathname,
  });
  identity.login();
}
