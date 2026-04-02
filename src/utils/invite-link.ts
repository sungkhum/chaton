import { getUserAssociations, identity } from "deso-protocol";
import {
  ASSOCIATION_TYPE_GROUP_INVITE_CODE,
  CHATON_DONATION_PUBLIC_KEY,
  CHATON_SIGNING_PUBLIC_KEY,
} from "./constants";

const RELAY_URL = import.meta.env.VITE_RELAY_URL || "";

/** Build a full invite URL from a short code. */
export function buildInviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/** Extract the invite code from the current URL path (e.g. /join/k7Xm2p → k7Xm2p). */
export function extractInviteCode(path: string): string | null {
  const match = path.match(/^\/join\/([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

/**
 * Resolve an invite code to the group owner + group key name.
 * Only returns codes signed by ChatOn's key (prevents hijacking).
 */
export async function resolveInviteCode(
  code: string
): Promise<{ ownerKey: string; groupKeyName: string } | null> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: CHATON_SIGNING_PUBLIC_KEY,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      AssociationValue: code,
      Limit: 1,
    });
    const a = res.Associations?.[0];
    if (!a) return null;
    const groupKeyName = a.ExtraData?.["group:keyName"];
    const ownerKey = a.ExtraData?.["group:ownerKey"];
    if (!groupKeyName || !ownerKey) return null;
    return { ownerKey, groupKeyName };
  } catch {
    return null;
  }
}

/**
 * Register an invite code via the Worker API.
 * The Worker generates the code, signs the transaction with ChatOn's key,
 * and submits it to the DeSo blockchain.
 */
export async function registerInviteCode(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ code: string; associationId: string }> {
  const jwt = await identity.jwt();
  const res = await fetch(`${RELAY_URL}/invite-codes/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerPublicKey, groupKeyName, jwt }),
  });

  if (res.status === 409) {
    // Code already exists — return it
    return res.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch the existing invite code for a specific group (if any).
 * Queries codes signed by ChatOn's key and matches by owner + group.
 */
export async function fetchInviteCode(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ code: string; associationId: string } | null> {
  let lastId = "";
  const maxPages = 10;
  for (let page = 0; page < maxPages; page++) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: CHATON_SIGNING_PUBLIC_KEY,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });
    const associations = res.Associations ?? [];
    for (const a of associations) {
      if (
        a.ExtraData?.["group:keyName"] === groupKeyName &&
        a.ExtraData?.["group:ownerKey"] === ownerPublicKey
      ) {
        return { code: a.AssociationValue, associationId: a.AssociationID };
      }
    }
    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }
  return null;
}

/** Revoke an invite code via the Worker API. */
export async function revokeInviteCode(
  ownerPublicKey: string,
  associationId: string
): Promise<void> {
  const jwt = await identity.jwt();
  const res = await fetch(`${RELAY_URL}/invite-codes/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerPublicKey, associationId, jwt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to revoke invite code");
  }
}
