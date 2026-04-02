/**
 * Invite code management endpoints.
 *
 * All invite code associations are created with ChatOn's signing key as the
 * transactor, making them unforgeable. The Worker verifies group ownership
 * via JWT + on-chain group lookup before signing.
 */

import type { Env } from "./index";
import { validateDesoJwt } from "./jwt";
import {
  constructCreateAssociation,
  constructDeleteAssociation,
  signTransaction,
  submitTransaction,
  queryAssociations,
  verifyGroupOwnership,
} from "./deso-tx";

const ASSOCIATION_TYPE_GROUP_INVITE_CODE = "chaton:group-invite-code";
const CHATON_DONATION_PUBLIC_KEY =
  "BC1YLibU7KwQRTnWJ3nDyVzitNFdyDa28LjZDEnH5Y6xP9oHa59J5xK";
const INVITE_CODE_LENGTH = 8;
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_COLLISION_RETRIES = 3;

/** Generate a random alphanumeric invite code. */
function generateInviteCode(): string {
  const arr = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join("");
}

/** Check if an invite code value already exists on-chain. */
async function codeExists(
  nodeUrl: string,
  signingPublicKey: string,
  code: string
): Promise<boolean> {
  const res = await queryAssociations(nodeUrl, {
    TransactorPublicKeyBase58Check: signingPublicKey,
    TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
    AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
    AssociationValue: code,
    Limit: 1,
  });
  return (res.Associations?.length ?? 0) > 0;
}

/** Find an existing invite code for a specific owner + group. */
async function findExistingCode(
  nodeUrl: string,
  signingPublicKey: string,
  ownerPublicKey: string,
  groupKeyName: string
): Promise<{ code: string; associationId: string } | null> {
  let lastId = "";
  for (let page = 0; page < 10; page++) {
    const res = await queryAssociations(nodeUrl, {
      TransactorPublicKeyBase58Check: signingPublicKey,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });
    const associations = res.Associations ?? [];
    for (const a of associations) {
      if (
        a.ExtraData?.["group:ownerKey"] === ownerPublicKey &&
        a.ExtraData?.["group:keyName"] === groupKeyName
      ) {
        return { code: a.AssociationValue, associationId: a.AssociationID };
      }
    }
    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }
  return null;
}

/** Find an association by ID and verify the owner matches. */
async function findAndVerifyAssociation(
  nodeUrl: string,
  signingPublicKey: string,
  associationId: string,
  ownerPublicKey: string
): Promise<boolean> {
  let lastId = "";
  for (let page = 0; page < 10; page++) {
    const res = await queryAssociations(nodeUrl, {
      TransactorPublicKeyBase58Check: signingPublicKey,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });
    const associations = res.Associations ?? [];
    for (const a of associations) {
      if (a.AssociationID === associationId) {
        return a.ExtraData?.["group:ownerKey"] === ownerPublicKey;
      }
    }
    if (associations.length < 100) break;
    lastId = associations[associations.length - 1].AssociationID;
  }
  return false;
}

// ── Endpoint Handlers ──

export async function handleCreateInviteCode(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { ownerPublicKey?: string; groupKeyName?: string; jwt?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { ownerPublicKey, groupKeyName, jwt } = body;
  if (!ownerPublicKey || !groupKeyName || !jwt) {
    return new Response("Missing required fields", { status: 400 });
  }

  // 1. Verify JWT
  if (
    !(await validateDesoJwt(env.DESO_NODE_URL, ownerPublicKey, jwt))
  ) {
    return new Response("Invalid or expired JWT", { status: 401 });
  }

  // 2. Verify caller owns the group
  if (
    !(await verifyGroupOwnership(env.DESO_NODE_URL, ownerPublicKey, groupKeyName))
  ) {
    return new Response("You do not own this group", { status: 403 });
  }

  // 3. Check if an invite code already exists for this group
  const existing = await findExistingCode(
    env.DESO_NODE_URL,
    env.CHATON_SIGNING_PUBLIC_KEY,
    ownerPublicKey,
    groupKeyName
  );
  if (existing) {
    return new Response(JSON.stringify(existing), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Generate code with collision check
  let code = "";
  for (let attempt = 0; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    code = generateInviteCode();
    if (!(await codeExists(env.DESO_NODE_URL, env.CHATON_SIGNING_PUBLIC_KEY, code))) {
      break;
    }
    if (attempt === MAX_COLLISION_RETRIES) {
      return new Response("Code generation failed (collisions)", {
        status: 500,
      });
    }
  }

  // 5. Construct, sign, submit
  try {
    const constructed = await constructCreateAssociation(env.DESO_NODE_URL, {
      TransactorPublicKeyBase58Check: env.CHATON_SIGNING_PUBLIC_KEY,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      AssociationValue: code,
      ExtraData: {
        "group:keyName": groupKeyName,
        "group:ownerKey": ownerPublicKey,
      },
    });

    const signatureHex = await signTransaction(
      constructed.TransactionHex,
      env.CHATON_SIGNING_SEED_HEX
    );

    await submitTransaction(
      env.DESO_NODE_URL,
      constructed.TransactionHex,
      signatureHex
    );
  } catch (err) {
    console.error("Failed to create invite code on-chain:", err);
    return new Response(
      `Failed to create invite code: ${err instanceof Error ? err.message : "unknown error"}`,
      { status: 500 }
    );
  }

  // 6. Fetch the new association ID
  let associationId = "";
  try {
    const res = await queryAssociations(env.DESO_NODE_URL, {
      TransactorPublicKeyBase58Check: env.CHATON_SIGNING_PUBLIC_KEY,
      TargetUserPublicKeyBase58Check: CHATON_DONATION_PUBLIC_KEY,
      AssociationType: ASSOCIATION_TYPE_GROUP_INVITE_CODE,
      AssociationValue: code,
      Limit: 1,
    });
    associationId = res.Associations?.[0]?.AssociationID ?? "";
  } catch {
    // Non-fatal — code was created, just can't get the ID
  }

  return new Response(JSON.stringify({ code, associationId }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleRevokeInviteCode(
  request: Request,
  env: Env
): Promise<Response> {
  let body: {
    ownerPublicKey?: string;
    associationId?: string;
    jwt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { ownerPublicKey, associationId, jwt } = body;
  if (!ownerPublicKey || !associationId || !jwt) {
    return new Response("Missing required fields", { status: 400 });
  }

  // 1. Verify JWT
  if (
    !(await validateDesoJwt(env.DESO_NODE_URL, ownerPublicKey, jwt))
  ) {
    return new Response("Invalid or expired JWT", { status: 401 });
  }

  // 2. Verify the association belongs to this owner
  const isOwner = await findAndVerifyAssociation(
    env.DESO_NODE_URL,
    env.CHATON_SIGNING_PUBLIC_KEY,
    associationId,
    ownerPublicKey
  );
  if (!isOwner) {
    return new Response("Association not found or not owned by you", {
      status: 403,
    });
  }

  // 3. Construct, sign, submit delete
  try {
    const constructed = await constructDeleteAssociation(env.DESO_NODE_URL, {
      TransactorPublicKeyBase58Check: env.CHATON_SIGNING_PUBLIC_KEY,
      AssociationID: associationId,
    });

    const signatureHex = await signTransaction(
      constructed.TransactionHex,
      env.CHATON_SIGNING_SEED_HEX
    );

    await submitTransaction(
      env.DESO_NODE_URL,
      constructed.TransactionHex,
      signatureHex
    );
  } catch (err) {
    console.error("Failed to revoke invite code on-chain:", err);
    return new Response(
      `Failed to revoke invite code: ${err instanceof Error ? err.message : "unknown error"}`,
      { status: 500 }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
