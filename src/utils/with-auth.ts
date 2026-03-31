import { identity } from "deso-protocol";
import { toast } from "sonner";
import { getTransactionSpendingLimits } from "./constants";
import { useStore } from "../store";

// Bump this version whenever getTransactionSpendingLimits changes
// (e.g., new association types, new transaction types).
// Users with a cached version lower than this will be prompted to re-authorize.
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
 * NOTE: Does NOT mark permissions version as up-to-date because DeSo identity
 * only grants the minimum permissions for the failing transaction, not the
 * full set we request. Only ensurePermissions (triggered by user gesture)
 * should store the version.
 */
export async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = error?.message || error?.toString?.() || "";

    if (isDerivedKeyError(errorStr)) {
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
 * Check if permissions need upgrading. Returns true if a re-auth is needed.
 * Does NOT open any popups — call requestFullPermissions() with a user gesture.
 */
export function needsPermissionUpgrade(): boolean {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check || "";
  if (!publicKey) return false;
  return getStoredPermissionsVersion(publicKey) < PERMISSIONS_VERSION;
}

/**
 * Request the full set of permissions. Must be called from a user gesture
 * (click handler) to avoid popup blockers.
 *
 * After success, stores the version so the user isn't prompted again.
 */
export async function requestFullPermissions(): Promise<boolean> {
  try {
    const appUser = useStore.getState().appUser;
    const publicKey = appUser?.PublicKeyBase58Check || "";
    if (!publicKey) return false;

    await identity.requestPermissions({
      ...getTransactionSpendingLimits(publicKey),
    });

    setStoredPermissionsVersion(publicKey);
    return true;
  } catch {
    return false;
  }
}
