/**
 * DeSo transaction construction, signing, and submission.
 *
 * Uses the DeSo node HTTP API for construction and the Python SDK's
 * simpler submit pattern: sends UnsignedTransactionHex + TransactionSignatureHex
 * as separate fields, avoiding the need to parse and splice the transaction binary.
 *
 * Signing: double-SHA256 → ECDSA secp256k1 (DER encoded).
 */

import { sha256 } from "@noble/hashes/sha256";
import { sign as ecSign, utils as ecUtils } from "@noble/secp256k1";

// ── Signing ──

/** Double SHA256 hash (same as Bitcoin / DeSo). */
function sha256x2(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/**
 * Sign a DeSo transaction hex with a seed hex (private key).
 * Returns the DER-encoded signature as a hex string.
 */
export async function signTransaction(
  txHex: string,
  seedHex: string
): Promise<string> {
  const txBytes = ecUtils.hexToBytes(txHex);
  const hash = sha256x2(txBytes);
  const hashHex = ecUtils.bytesToHex(hash);
  const privateKey = ecUtils.hexToBytes(seedHex);

  // Sign with canonical DER encoding + extra entropy
  const [signature] = await ecSign(hashHex, privateKey, {
    canonical: true,
    der: true,
    extraEntropy: true,
    recovered: true,
  });

  return ecUtils.bytesToHex(signature);
}

// ── DeSo Node API ──

interface ConstructResponse {
  TransactionHex: string;
}

interface SubmitResponse {
  TxnHashHex: string;
  Transaction?: unknown;
}

interface AssociationEntry {
  AssociationID: string;
  TransactorPublicKeyBase58Check: string;
  TargetUserPublicKeyBase58Check: string;
  AssociationType: string;
  AssociationValue: string;
  ExtraData?: Record<string, string>;
  BlockHeight?: number;
}

interface AssociationsQueryResponse {
  Associations: AssociationEntry[] | null;
}

interface BulkAccessGroupsResponse {
  AccessGroupEntries?: Array<{
    AccessGroupOwnerPublicKeyBase58Check: string;
    AccessGroupKeyName: string;
    ExtraData?: Record<string, string>;
  }>;
  PairsNotFound?: Array<{
    GroupOwnerPublicKeyBase58Check: string;
    GroupKeyName: string;
  }>;
}

/** Construct a create-user-association transaction (unsigned). */
export async function constructCreateAssociation(
  nodeUrl: string,
  params: {
    TransactorPublicKeyBase58Check: string;
    TargetUserPublicKeyBase58Check: string;
    AssociationType: string;
    AssociationValue: string;
    ExtraData?: Record<string, string>;
  }
): Promise<ConstructResponse> {
  const res = await fetch(`${nodeUrl}/api/v0/user-associations/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      MinFeeRateNanosPerKB: 1000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`construct create-association failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<ConstructResponse>;
}

/** Construct a delete-user-association transaction (unsigned). */
export async function constructDeleteAssociation(
  nodeUrl: string,
  params: {
    TransactorPublicKeyBase58Check: string;
    AssociationID: string;
  }
): Promise<ConstructResponse> {
  const res = await fetch(`${nodeUrl}/api/v0/user-associations/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      MinFeeRateNanosPerKB: 1000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`construct delete-association failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<ConstructResponse>;
}

/** Submit a signed transaction to the DeSo node. */
export async function submitTransaction(
  nodeUrl: string,
  unsignedTxHex: string,
  signatureHex: string
): Promise<SubmitResponse> {
  const res = await fetch(`${nodeUrl}/api/v0/submit-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UnsignedTransactionHex: unsignedTxHex,
      TransactionSignatureHex: signatureHex,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit-transaction failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<SubmitResponse>;
}

/** Query user associations with filters. */
export async function queryAssociations(
  nodeUrl: string,
  params: {
    TransactorPublicKeyBase58Check?: string;
    TargetUserPublicKeyBase58Check?: string;
    AssociationType?: string;
    AssociationValue?: string;
    Limit?: number;
    LastSeenAssociationID?: string;
  }
): Promise<AssociationsQueryResponse> {
  const res = await fetch(`${nodeUrl}/api/v0/user-associations/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`query-associations failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<AssociationsQueryResponse>;
}

/** Verify that a public key owns a specific access group. */
export async function verifyGroupOwnership(
  nodeUrl: string,
  ownerPublicKey: string,
  groupKeyName: string
): Promise<boolean> {
  const res = await fetch(`${nodeUrl}/api/v0/get-bulk-access-group-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      GroupOwnerAndGroupKeyNamePairs: [
        {
          GroupOwnerPublicKeyBase58Check: ownerPublicKey,
          GroupKeyName: groupKeyName,
        },
      ],
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as BulkAccessGroupsResponse;
  return !data.PairsNotFound?.length;
}
