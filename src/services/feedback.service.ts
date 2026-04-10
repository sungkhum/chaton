import { identity } from "deso-protocol";
import { useStore } from "../store";
import { getAppVersion, getPlatform } from "../utils/error-capture";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

interface FeedbackInput {
  category: string;
  description: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check;
  if (!publicKey) throw new Error("Not logged in");
  if (!RELAY_URL) throw new Error("Relay not configured");

  const nonce = crypto.randomUUID();
  const jwt = await identity.jwt();

  const res = await fetch(`${RELAY_URL}/feedback/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: input.category,
      description: input.description,
      submitterPublicKey: publicKey,
      reporterUsername: appUser.ProfileEntryResponse?.Username || null,
      signature: jwt,
      nonce,
      appVersion: getAppVersion(),
      userAgent: navigator.userAgent,
      platform: getPlatform(),
      route: window.location.pathname,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
}
