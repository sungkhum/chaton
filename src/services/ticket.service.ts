import { identity } from "deso-protocol";
import { useStore } from "../store";
import type { ErrorContext } from "../utils/error-capture";
import { getAppVersion, getPlatform } from "../utils/error-capture";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

interface BugReportInput {
  description: string;
  frequency: "first-time" | "sometimes" | "every-time";
  extra?: string;
}

/** User-initiated bug report from the feedback menu (no auto-captured error context). */
interface ManualBugReportInput {
  whatWentWrong: string;
  whatWereDoing: string;
  frequency: "first-time" | "sometimes" | "every-time";
  screenshotUrl?: string;
}

export async function submitBugReport(
  errorCtx: ErrorContext,
  input: BugReportInput
): Promise<void> {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check;
  if (!publicKey) throw new Error("Not logged in");
  if (!RELAY_URL) throw new Error("Relay not configured");

  const nonce = crypto.randomUUID();

  const jwt = await identity.jwt();

  const res = await fetch(`${RELAY_URL}/tickets/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      errorCode: errorCtx.code,
      errorMessage: errorCtx.message,
      stackTrace: errorCtx.stack || null,
      component: errorCtx.component,
      route: errorCtx.route,
      timestamp: errorCtx.timestamp,
      appVersion: errorCtx.appVersion,
      userAgent: errorCtx.userAgent,
      platform: errorCtx.platform,
      userDescription: input.description,
      frequency: input.frequency,
      additionalContext: input.extra || null,
      submitterPublicKey: publicKey,
      reporterUsername: appUser.ProfileEntryResponse?.Username || null,
      signature: jwt,
      nonce,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
}

/** Submit a user-initiated bug report (from the feedback menu, no auto-captured context). */
export async function submitManualBugReport(
  input: ManualBugReportInput
): Promise<void> {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check;
  if (!publicKey) throw new Error("Not logged in");
  if (!RELAY_URL) throw new Error("Relay not configured");

  const nonce = crypto.randomUUID();
  const jwt = await identity.jwt();

  const res = await fetch(`${RELAY_URL}/tickets/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      errorCode: "unknown",
      errorMessage: input.whatWentWrong.slice(0, 200),
      stackTrace: null,
      component: "user-reported",
      route: window.location.pathname,
      timestamp: Date.now(),
      appVersion: getAppVersion(),
      userAgent: navigator.userAgent,
      platform: getPlatform(),
      userDescription: input.whatWereDoing,
      frequency: input.frequency,
      additionalContext: input.whatWentWrong,
      screenshotUrl: input.screenshotUrl || null,
      submitterPublicKey: publicKey,
      reporterUsername: appUser.ProfileEntryResponse?.Username || null,
      signature: jwt,
      nonce,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
}
