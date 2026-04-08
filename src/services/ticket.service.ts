import { identity } from "deso-protocol";
import { useStore } from "../store";
import type { ErrorContext } from "../utils/error-capture";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

interface BugReportInput {
  description: string;
  frequency: "first-time" | "sometimes" | "every-time";
  extra?: string;
}

export async function submitBugReport(
  errorCtx: ErrorContext,
  input: BugReportInput
): Promise<void> {
  const publicKey = useStore.getState().appUser?.PublicKeyBase58Check;
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
      signature: jwt,
      nonce,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
}
