import { identity } from "deso-protocol";
import { toast } from "sonner";
import { getTransactionSpendingLimits } from "./constants";
import { useStore } from "../store";

// Bump this version whenever getTransactionSpendingLimits changes
// (e.g., new association types, new transaction types).
// Users with a cached version lower than this will be prompted once to re-authorize.
const PERMISSIONS_VERSION = 2;
const PERMISSIONS_VERSION_KEY = "chaton:permissions-version";

function getStoredPermissionsVersion(publicKey: string): number {
  try {
    return Number(localStorage.getItem(`${PERMISSIONS_VERSION_KEY}:${publicKey}`)) || 0;
  } catch {
    return 0;
  }
}

function setStoredPermissionsVersion(publicKey: string): void {
  try {
    localStorage.setItem(`${PERMISSIONS_VERSION_KEY}:${publicKey}`, String(PERMISSIONS_VERSION));
  } catch {}
}

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
      // Derived key expired or unauthorized — re-request ALL permissions
      const appUser = useStore.getState().appUser;
      const publicKey = appUser?.PublicKeyBase58Check || "";

      toast.info("Re-authorizing your account...");

      try {
        await identity.requestPermissions({
          ...getTransactionSpendingLimits(publicKey),
        });

        // Mark as up-to-date so we don't prompt again
        if (publicKey) setStoredPermissionsVersion(publicKey);

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
 * Ensure the derived key has ALL current permissions.
 *
 * Uses a version number stored in localStorage. When we add new permission
 * types (association types, transaction types, etc.), we bump PERMISSIONS_VERSION.
 * Users whose stored version is lower get one re-auth prompt on startup that
 * requests the full spending limits — covering everything the app needs.
 *
 * We don't rely on identity.hasPermissions() because it doesn't reliably
 * detect missing entries in AssociationLimitMap.
 */
export async function ensurePermissions(): Promise<boolean> {
  try {
    const appUser = useStore.getState().appUser;
    const publicKey = appUser?.PublicKeyBase58Check || "";
    if (!publicKey) return true;

    const storedVersion = getStoredPermissionsVersion(publicKey);
    if (storedVersion >= PERMISSIONS_VERSION) {
      return true; // Already up-to-date
    }

    // Request the full set of permissions
    await identity.requestPermissions({
      ...getTransactionSpendingLimits(publicKey),
    });

    setStoredPermissionsVersion(publicKey);
    return true;
  } catch {
    return false;
  }
}
