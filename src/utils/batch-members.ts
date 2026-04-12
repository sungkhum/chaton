import {
  addAccessGroupMembers,
  encrypt,
  getBulkAccessGroups,
  removeAccessGroupMembers,
} from "deso-protocol";
import type {
  AccessGroupEntryResponse,
  GroupOwnerAndGroupKeyNamePair,
} from "deso-protocol";
import { withAuth } from "./with-auth";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "./constants";

/**
 * Members per blockchain transaction.
 * DeSo PoS max transaction size is 25KB (DefaultMaxTxnSizeBytesPoS).
 * Each member adds ~170-200 bytes. 100 members ≈ 20KB, safely under the limit.
 */
export const MEMBER_BATCH_SIZE = 100;

export interface BatchProgress {
  /** 1-based index of the batch that just completed/failed. */
  batchIndex: number;
  /** Total number of batches. */
  totalBatches: number;
  /** Total members successfully processed so far. */
  completedMembers: number;
  /** Total members across all batches. */
  totalMembers: number;
}

export interface BatchResult {
  succeededKeys: string[];
  failedKeys: string[];
  /** Some succeeded, some failed. */
  partialSuccess: boolean;
  /** All succeeded. */
  fullSuccess: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch access group entries for a list of public keys, batching the
 * getBulkAccessGroups calls to avoid oversized requests.
 */
export async function batchedGetBulkAccessGroups(
  memberKeys: string[],
  keyName: string = DEFAULT_KEY_MESSAGING_GROUP_NAME
): Promise<{
  entries: AccessGroupEntryResponse[];
  pairsNotFound: Array<{
    GroupOwnerPublicKeyBase58Check: string;
    GroupKeyName: string;
  }>;
}> {
  if (memberKeys.length === 0) {
    return { entries: [], pairsNotFound: [] };
  }

  const batches = chunk(memberKeys, MEMBER_BATCH_SIZE);
  const allEntries: AccessGroupEntryResponse[] = [];
  const allPairsNotFound: GroupOwnerAndGroupKeyNamePair[] = [];

  for (const batch of batches) {
    const { AccessGroupEntries, PairsNotFound } = await getBulkAccessGroups({
      GroupOwnerAndGroupKeyNamePairs: batch.map((key) => ({
        GroupOwnerPublicKeyBase58Check: key,
        GroupKeyName: keyName,
      })),
    });
    allEntries.push(...AccessGroupEntries);
    if (PairsNotFound?.length) allPairsNotFound.push(...PairsNotFound);
  }

  return { entries: allEntries, pairsNotFound: allPairsNotFound };
}

/**
 * Add members to a group in batches, encrypting the group key for each member.
 * Continues processing remaining batches even if one fails.
 */
export async function batchedAddMembers(params: {
  ownerPublicKey: string;
  groupKeyName: string;
  accessGroupPrivateKeyHex: string;
  memberEntries: AccessGroupEntryResponse[];
  onProgress?: (progress: BatchProgress) => void;
}): Promise<BatchResult> {
  const {
    ownerPublicKey,
    groupKeyName,
    accessGroupPrivateKeyHex,
    memberEntries,
    onProgress,
  } = params;

  if (memberEntries.length === 0) {
    return {
      succeededKeys: [],
      failedKeys: [],
      partialSuccess: false,
      fullSuccess: true,
    };
  }

  const batches = chunk(memberEntries, MEMBER_BATCH_SIZE);
  const succeededKeys: string[] = [];
  const failedKeys: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const batchKeys = batch.map((e) => e.AccessGroupOwnerPublicKeyBase58Check);

    try {
      const memberList = await Promise.all(
        batch.map(async (entry) => ({
          AccessGroupMemberPublicKeyBase58Check:
            entry.AccessGroupOwnerPublicKeyBase58Check,
          AccessGroupMemberKeyName: entry.AccessGroupKeyName,
          EncryptedKey: await encrypt(
            entry.AccessGroupPublicKeyBase58Check,
            accessGroupPrivateKeyHex
          ),
        }))
      );

      const { submittedTransactionResponse } = await withAuth(() =>
        addAccessGroupMembers({
          AccessGroupOwnerPublicKeyBase58Check: ownerPublicKey,
          AccessGroupKeyName: groupKeyName,
          AccessGroupMemberList: memberList,
          MinFeeRateNanosPerKB: 1000,
        })
      );

      if (!submittedTransactionResponse) {
        throw new Error("Transaction not submitted");
      }

      succeededKeys.push(...batchKeys);
    } catch (err) {
      console.error(`Batch ${i + 1}/${batches.length} failed:`, err);
      failedKeys.push(...batchKeys);
    }

    onProgress?.({
      batchIndex: i + 1,
      totalBatches: batches.length,
      completedMembers: succeededKeys.length,
      totalMembers: memberEntries.length,
    });
  }

  return {
    succeededKeys,
    failedKeys,
    partialSuccess: succeededKeys.length > 0 && failedKeys.length > 0,
    fullSuccess: failedKeys.length === 0,
  };
}

/**
 * Remove members from a group in batches.
 * Continues processing remaining batches even if one fails.
 */
export async function batchedRemoveMembers(params: {
  ownerPublicKey: string;
  groupKeyName: string;
  memberEntries: AccessGroupEntryResponse[];
  onProgress?: (progress: BatchProgress) => void;
}): Promise<BatchResult> {
  const { ownerPublicKey, groupKeyName, memberEntries, onProgress } = params;

  if (memberEntries.length === 0) {
    return {
      succeededKeys: [],
      failedKeys: [],
      partialSuccess: false,
      fullSuccess: true,
    };
  }

  const batches = chunk(memberEntries, MEMBER_BATCH_SIZE);
  const succeededKeys: string[] = [];
  const failedKeys: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const batchKeys = batch.map((e) => e.AccessGroupOwnerPublicKeyBase58Check);

    try {
      const { submittedTransactionResponse } = await withAuth(() =>
        removeAccessGroupMembers({
          AccessGroupOwnerPublicKeyBase58Check: ownerPublicKey,
          AccessGroupKeyName: groupKeyName,
          AccessGroupMemberList: batch.map((entry) => ({
            AccessGroupMemberPublicKeyBase58Check:
              entry.AccessGroupOwnerPublicKeyBase58Check,
            AccessGroupMemberKeyName: entry.AccessGroupKeyName,
            EncryptedKey: "",
          })),
          MinFeeRateNanosPerKB: 1000,
        })
      );

      if (!submittedTransactionResponse) {
        throw new Error("Transaction not submitted");
      }

      succeededKeys.push(...batchKeys);
    } catch (err) {
      console.error(`Remove batch ${i + 1}/${batches.length} failed:`, err);
      failedKeys.push(...batchKeys);
    }

    onProgress?.({
      batchIndex: i + 1,
      totalBatches: batches.length,
      completedMembers: succeededKeys.length,
      totalMembers: memberEntries.length,
    });
  }

  return {
    succeededKeys,
    failedKeys,
    partialSuccess: succeededKeys.length > 0 && failedKeys.length > 0,
    fullSuccess: failedKeys.length === 0,
  };
}
