import { identity } from "deso-protocol";
import { toast } from "sonner";
import { getTransactionSpendingLimits } from "./constants";
import { useStore } from "../store";

/**
 * Wraps any async function that makes a DeSo transaction.
 * If the derived key is expired or unauthorized, it automatically
 * re-requests permissions and retries the operation once.
 *
 * Usage:
 *   await withAuth(() => sendDMMessage({ ... }));
 */
export async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = error?.message || error?.toString?.() || "";

    if (isDerivedKeyError(errorStr)) {
      // Derived key expired or unauthorized — re-request permissions
      const appUser = useStore.getState().appUser;
      const publicKey = appUser?.PublicKeyBase58Check || "";

      toast.info("Re-authorizing your account...");

      try {
        await identity.requestPermissions({
          ...getTransactionSpendingLimits(publicKey),
        });

        // Retry the original operation
        return await fn();
      } catch (reAuthError: any) {
        const reAuthStr = reAuthError?.message || reAuthError?.toString?.() || "";
        if (reAuthStr.includes("user cancelled") || reAuthStr.includes("WINDOW_CLOSED")) {
          toast.error("Authorization cancelled. You need to re-authorize to perform this action.");
        } else {
          toast.error("Re-authorization failed. Please try logging out and back in.");
        }
        throw reAuthError;
      }
    }

    // Not a derived key error — rethrow
    throw error;
  }
}

function isDerivedKeyError(errorStr: string): boolean {
  const patterns = [
    "RuleErrorDerivedKeyNotAuthorized",
    "Derived key mapping for owner not found",
    "derived key",
    "DerivedKeyNotAuthorized",
    "not validated due to error",
    "Problem verifying txn signature",
  ];
  return patterns.some((p) => errorStr.includes(p));
}

/**
 * Check if the current user's derived key has ALL permissions the app needs.
 * If not, proactively request re-authorization once so the user isn't prompted
 * per-action throughout the session.
 *
 * Call this once after login / app startup.
 */
export async function ensurePermissions(): Promise<boolean> {
  try {
    const appUser = useStore.getState().appUser;
    const publicKey = appUser?.PublicKeyBase58Check || "";

    // Check the FULL spending limits including AssociationLimitMap.
    // Checking only TransactionCountLimitMap misses specific association types —
    // a derived key can have CREATE_USER_ASSOCIATION but lack individual types
    // like chaton:chat-approved that were added after the key was created.
    const fullLimits = getTransactionSpendingLimits(publicKey);
    const hasPerms = identity.hasPermissions(fullLimits);

    if (!hasPerms) {
      await identity.requestPermissions(fullLimits);
    }

    return true;
  } catch {
    return false;
  }
}
