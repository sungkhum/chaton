import {
  createUserAssociation,
  deleteUserAssociation,
  getUserAssociations,
} from "deso-protocol";
import { withAuth } from "./with-auth";
import {
  ASSOCIATION_TYPE_GROUP_INVITE_CODE,
  CHATON_DONATION_PUBLIC_KEY,
  INVITE_CODE_LENGTH,
} from "./constants";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a random alphanumeric invite code. */
export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join("");
}

/** Build a full invite URL from a short code. */
export function buildInviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/** Extract the invite code from the current URL path (e.g. /join/k7Xm2p → k7Xm2p). */
export function extractInviteCode(path: string): string | null {
  const match = path.match(/^\/join\/([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

/** Resolve an invite code to the group owner + group key name via on-chain registry. */
export async function resolveInviteCode(
  code: string
): Promise<{ ownerKey: string; groupKeyName: string } | null> {
  try {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      AssociationValue: code,
      Limit: 1,
    });
    const a = res.Associations?.[0];
    if (!a) return null;
    const groupKeyName = a.ExtraData?.["group:keyName"];
    if (!groupKeyName) return null;
    return { ownerKey: a.TransactorPublicKeyBase58Check, groupKeyName };
  } catch {
    return null;
  }
}

/** Register an invite code on-chain. Returns the association ID. */
export async function registerInviteCode(
  ownerPublicKey: string,
  code: string,
  groupKeyName: string
): Promise<string> {
  // Check for collision first
  const existing = await resolveInviteCode(code);
  if (existing) {
    throw new Error("Invite code collision — please try again.");
  }

  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: ownerPublicKey,
        TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
        AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
        AssociationValue: code,
        ExtraData: { "group:keyName": groupKeyName },
      },
      { checkPermissions: false }
    )
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: ownerPublicKey,
    TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
    AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
    AssociationValue: code,
    Limit: 1,
  });
  return res.Associations?.[0]?.AssociationID ?? "";
}

/** Fetch the existing invite code for a specific group (if any). */
export async function fetchInviteCode(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ code: string; associationId: string } | null> {
  let lastId = "";
  const maxPages = 10;
  for (let page = 0; page < maxPages; page++) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: ownerPublicKey,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });
    const associations = res.Associations ?? [];
    for (const a of associations) {
      if (a.ExtraData?.["group:keyName"] === groupKeyName) {
        return { code: a.AssociationValue, associationId: a.AssociationID };
      }
    }
    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }
  return null;
}

/** Revoke an invite code by deleting the registry association. */
export async function revokeInviteCode(
  ownerPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation(
      {
        TransactorPublicKeyBase58Check: ownerPublicKey,
        AssociationID: associationId,
      },
      { checkPermissions: false }
    )
  );
}
