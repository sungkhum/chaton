import { identity } from "deso-protocol";
import { toast } from "sonner";
import { getTransactionSpendingLimits } from "./constants";
import { useStore } from "../store";

/**
 * Wraps any async function that makes a DeSo transaction.
 * If the derived key is expired or unauthorized, it automatically
 * re-requests permissions and retries the operation once.
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

        // requestPermissions triggers AUTHORIZE_DERIVED_KEY_START which sets
        // isLoadingUser(true) in App.tsx. Since the user is already logged in,
        // the completion event doesn't reset it. Reset it here.
        useStore.getState().setIsLoadingUser(false);

        // Retry the original operation
        return await fn();
      } catch (reAuthError: any) {
        // Reset loading in case AUTHORIZE_DERIVED_KEY_START fired but
        // the popup was cancelled (no END event fires on cancel).
        useStore.getState().setIsLoadingUser(false);

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
 * Check if permissions need upgrading by comparing the derived key's actual
 * permissions against what the app requires. Returns true if a re-auth is needed.
 * Does NOT open any popups — call requestFullPermissions() with a user gesture.
 *
 * Excludes GlobalDESOLimit and DAOCoinOperationLimitMap from the check because
 * those decrease as the user spends DESO, which would cause false positives.
 */
export function needsPermissionUpgrade(): boolean {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check || "";
  if (!publicKey) return false;

  const { GlobalDESOLimit, DAOCoinOperationLimitMap, ...structuralPermissions } =
    getTransactionSpendingLimits(publicKey);

  // AUTHORIZE_DERIVED_KEY is a one-shot permission consumed during key creation,
  // so it always reads as 0 afterward — exclude it to avoid a false positive.
  if (structuralPermissions.TransactionCountLimitMap) {
    const { AUTHORIZE_DERIVED_KEY, ...rest } = structuralPermissions.TransactionCountLimitMap;
    structuralPermissions.TransactionCountLimitMap = rest;
  }

  const needsUpgrade = !identity.hasPermissions(structuralPermissions);

  if (needsUpgrade) {
    const missing: string[] = [];

    // Check each transaction type individually
    const { TransactionCountLimitMap } = structuralPermissions;
    if (TransactionCountLimitMap) {
      for (const [txnType, count] of Object.entries(TransactionCountLimitMap)) {
        if (!identity.hasPermissions({ TransactionCountLimitMap: { [txnType]: count } })) {
          missing.push(`txn:${txnType}`);
        }
      }
    }

    // Check access group limits
    if (
      structuralPermissions.AccessGroupLimitMap &&
      !identity.hasPermissions({ AccessGroupLimitMap: structuralPermissions.AccessGroupLimitMap })
    ) {
      missing.push("AccessGroupLimitMap");
    }

    // Check access group member limits
    if (
      structuralPermissions.AccessGroupMemberLimitMap &&
      !identity.hasPermissions({ AccessGroupMemberLimitMap: structuralPermissions.AccessGroupMemberLimitMap })
    ) {
      missing.push("AccessGroupMemberLimitMap");
    }

    // Check association limits
    if (
      structuralPermissions.AssociationLimitMap &&
      !identity.hasPermissions({ AssociationLimitMap: structuralPermissions.AssociationLimitMap })
    ) {
      missing.push("AssociationLimitMap");
    }

    console.debug("[permissions] upgrade needed — missing:", missing.join(", ") || "(key invalid or unregistered)");
  }

  return needsUpgrade;
}

/**
 * Request the full set of permissions via identity.requestPermissions().
 * Must be called from a user gesture (click handler) to avoid popup blockers.
 *
 * After success, identity SDK updates the derived key's transactionSpendingLimits
 * so the next hasPermissions check will pass without needing a version number.
 */
export async function requestFullPermissions(): Promise<boolean> {
  const appUser = useStore.getState().appUser;
  const publicKey = appUser?.PublicKeyBase58Check || "";
  if (!publicKey) return false;

  try {
    await identity.requestPermissions({
      ...getTransactionSpendingLimits(publicKey),
    });

    return true;
  } catch {
    return false;
  } finally {
    useStore.getState().setIsLoadingUser(false);
  }
}
