import {
  AccessGroupEntryResponse,
  ChatType,
  checkPartyAccessGroups,
  createUserAssociation,
  DecryptedMessageEntryResponse,
  deleteUserAssociation,
  getAllAccessGroups,
  getDMThreads,
  getGroupChatThreads,
  getBulkAccessGroups,
  getFollowersForUser,
  getPaginatedAccessGroupMembers,
  getUserAssociations,
  identity,
  NewMessageEntryResponse,
  ProfileEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  sendDMMessage,
  sendGroupChatMessage,
  updateDMMessage,
  updateGroupChatMessage,
  waitForTransactionFound,
} from "deso-protocol";
import { toast } from "sonner";
import { withAuth } from "../utils/with-auth";
import {
  ASSOCIATION_TYPE_APPROVED,
  ASSOCIATION_TYPE_BLOCKED,
  ASSOCIATION_TYPE_CHAT_ARCHIVED,
  ASSOCIATION_TYPE_DISMISSED,
  ASSOCIATION_TYPE_GROUP_ACCEPTED,
  ASSOCIATION_TYPE_GROUP_ARCHIVED,
  ASSOCIATION_TYPE_GROUP_JOIN_REJECTED,
  ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
  ASSOCIATION_TYPE_PAID_MESSAGING,
  ASSOCIATION_TYPE_CHAT_PAID,
  ASSOCIATION_TYPE_PRIVACY_MODE,
  ASSOCIATION_TYPE_SPAM_FILTER,
  ASSOCIATION_VALUE_SPAM_FILTER,
  ASSOCIATION_VALUE_APPROVED,
  ASSOCIATION_VALUE_ARCHIVED,
  ASSOCIATION_VALUE_BLOCKED,
  ASSOCIATION_VALUE_DISMISSED,
  ASSOCIATION_VALUE_PAID,
  ASSOCIATION_VALUE_PAID_MESSAGING,
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  FETCH_THREADS_TIMEOUT_MS,
  PRIVACY_MODE_FULL,
  USER_TO_SEND_MESSAGE_TO,
} from "../utils/constants";
import {
  FULL_ENCRYPTED_KEYS,
  MSG_ENCRYPTED,
  type PrivacyMode,
  type SystemAction,
  type MentionEntry,
  getEncryptedExtraDataKeys,
  buildExtraData,
} from "../utils/extra-data";
import {
  Conversation,
  ConversationMap,
  UNDECRYPTED_PLACEHOLDER,
} from "../utils/types";
import { useStore } from "../store";
import { bytesToHex } from "@noble/hashes/utils";
import {
  passesSenderFilter,
  type SpamFilterConfig,
} from "../utils/spam-filter";

// ── Progressive loading helpers ──────────────────────────────────────────────

/** Derive IsSender without decryption (mirrors deso-protocol identity logic) */
function deriveIsSender(
  msg: NewMessageEntryResponse,
  userPublicKeyBase58Check: string
): boolean {
  return (
    msg.SenderInfo.OwnerPublicKeyBase58Check === userPublicKeyBase58Check &&
    (msg.SenderInfo.AccessGroupKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME ||
      !msg.SenderInfo.AccessGroupKeyName)
  );
}

/** Fetch raw message threads without decryption.
 *  Uses getDMThreads + getGroupChatThreads in parallel instead of the single
 *  getAllMessageThreads call. The DeSo backend does N+1 DB queries (one per
 *  thread) — splitting lets the DM and group queries run concurrently, and
 *  whichever finishes first can be rendered immediately via the onPartial
 *  callback.
 */
export async function fetchMessageThreadsRaw(
  userPublicKeyBase58Check: string,
  onPartial?: (partial: {
    messageThreads: NewMessageEntryResponse[];
    publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  }) => void,
  /** Apply a timeout — only use for user-facing initial loads, not background polling. */
  useTimeout = false
): Promise<{
  messageThreads: NewMessageEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
}> {
  const params = { UserPublicKeyBase58Check: userPublicKeyBase58Check };

  // Fire both requests in parallel
  const dmPromise = getDMThreads(params);
  const groupPromise = getGroupChatThreads(params);

  // If caller wants progressive updates, emit whichever resolves first
  if (onPartial) {
    let partialSent = false;
    const emitPartial = (result: Awaited<ReturnType<typeof getDMThreads>>) => {
      if (partialSent) return;
      partialSent = true;
      onPartial({
        messageThreads: result.MessageThreads || [],
        publicKeyToProfileEntryResponseMap:
          result.PublicKeyToProfileEntryResponse || {},
      });
    };
    dmPromise.then(emitPartial).catch(() => {});
    groupPromise.then(emitPartial).catch(() => {});
  }

  // Wait for both (with optional timeout for initial loads)
  const bothPromise = Promise.all([dmPromise, groupPromise]);
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let dmResult, groupResult;
  try {
    if (useTimeout) {
      const timeout = new Promise<never>((_, reject) => {
        timerId = setTimeout(
          () => reject(new Error("Loading timed out — please retry")),
          FETCH_THREADS_TIMEOUT_MS
        );
      });
      [dmResult, groupResult] = await Promise.race([bothPromise, timeout]);
    } else {
      [dmResult, groupResult] = await bothPromise;
    }
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }

  // Merge results
  const messageThreads = [
    ...(dmResult.MessageThreads || []),
    ...(groupResult.MessageThreads || []),
  ];
  const publicKeyToProfileEntryResponseMap = {
    ...(dmResult.PublicKeyToProfileEntryResponse || {}),
    ...(groupResult.PublicKeyToProfileEntryResponse || {}),
  };

  return { messageThreads, publicKeyToProfileEntryResponseMap };
}

/** Compute the conversation key for a raw message. */
function conversationKey(
  msg: NewMessageEntryResponse,
  userPublicKeyBase58Check: string
): { key: string; otherInfo: typeof msg.RecipientInfo } {
  const isSender = deriveIsSender(msg, userPublicKeyBase58Check);
  const otherInfo =
    msg.ChatType === ChatType.DM
      ? isSender
        ? msg.RecipientInfo
        : msg.SenderInfo
      : msg.RecipientInfo;
  const key =
    otherInfo.OwnerPublicKeyBase58Check +
    (otherInfo.AccessGroupKeyName || DEFAULT_KEY_MESSAGING_GROUP_NAME);
  return { key, otherInfo };
}

/** Build a ConversationMap from raw (undecrypted) messages — used for instant shell rendering.
 *  Also returns the latest raw message per conversation key so decryptConversationPreviews
 *  can skip recomputing it (fix for duplicate iteration). */
export function buildShellConversations(
  messageThreads: NewMessageEntryResponse[],
  userPublicKeyBase58Check: string
): {
  conversations: ConversationMap;
  latestByKey: Map<string, NewMessageEntryResponse>;
} {
  const conversations: ConversationMap = {};
  const latestByKey = new Map<string, NewMessageEntryResponse>();

  for (const msg of messageThreads) {
    const isSender = deriveIsSender(msg, userPublicKeyBase58Check);
    const shellMessage = {
      ...msg,
      DecryptedMessage: UNDECRYPTED_PLACEHOLDER,
      IsSender: isSender,
      error: "",
    } as DecryptedMessageEntryResponse;

    const { key, otherInfo } = conversationKey(msg, userPublicKeyBase58Check);

    // Track latest message per conversation (for decryptConversationPreviews)
    const existingLatest = latestByKey.get(key);
    if (
      !existingLatest ||
      msg.MessageInfo.TimestampNanos > existingLatest.MessageInfo.TimestampNanos
    ) {
      latestByKey.set(key, msg);
    }

    const existing = conversations[key];
    if (existing) {
      existing.messages.push(shellMessage);
      existing.messages.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
    } else {
      conversations[key] = {
        firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
        messages: [shellMessage],
        ChatType: msg.ChatType,
      };
    }
  }
  return { conversations, latestByKey };
}

/**
 * Decrypt only the latest message per conversation in batches,
 * calling onBatch after each batch so the UI can update progressively.
 *
 * Accepts a pre-computed `latestByKey` map (from buildShellConversations)
 * to avoid reiterating all raw messages. Also supports an AbortSignal
 * for cancellation on logout/re-login.
 */
export async function decryptConversationPreviews(
  latestByKey: Map<string, NewMessageEntryResponse>,
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[],
  onBatch: (updates: Map<string, DecryptedMessageEntryResponse>) => void,
  signal?: AbortSignal,
  batchSize = 10
): Promise<AccessGroupEntryResponse[]> {
  // Sort by recency so the most recent conversations decrypt first (fills viewport)
  const entries = Array.from(latestByKey.entries()).sort(
    ([, a], [, b]) =>
      b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
  );
  let currentGroups = allAccessGroups;

  // Two-tier decryption: first 30 entries (visible viewport) use larger batches
  // and no delay; remaining entries yield to the event loop between batches
  const TIER1_COUNT = 30;
  const TIER1_BATCH_SIZE = 15;
  let groupsRefreshed = false;

  for (let i = 0; i < entries.length; ) {
    if (signal?.aborted) break;

    // Tier 1: larger batches for the first 30 conversations (viewport)
    // Tier 2: standard batches with event loop yields for the rest
    const currentBatchSize = i < TIER1_COUNT ? TIER1_BATCH_SIZE : batchSize;
    const batch = entries.slice(i, i + currentBatchSize);
    i += currentBatchSize;

    // Check decryption cache — skip already-decrypted previews
    const cachedUpdates = new Map<string, DecryptedMessageEntryResponse>();
    const uncachedBatch: [string, NewMessageEntryResponse][] = [];
    for (const [key, msg] of batch) {
      const cached = decryptionResultCache.get(msg.MessageInfo.TimestampNanos);
      if (cached) {
        cachedUpdates.set(key, cached);
      } else {
        uncachedBatch.push([key, msg]);
      }
    }
    // Emit cached results immediately
    if (cachedUpdates.size > 0) onBatch(cachedUpdates);
    // Skip decryption entirely if all were cached
    if (uncachedBatch.length === 0) continue;

    const messagesToDecrypt = uncachedBatch.map(([, msg]) => msg);

    try {
      // Decrypt each message individually with a timeout so one stuck
      // message can't hang the entire batch (or all subsequent batches).
      const decrypted = await Promise.all(
        messagesToDecrypt.map(async (msg) => {
          try {
            const result = await Promise.race([
              identity.decryptMessage(msg, currentGroups),
              new Promise<DecryptedMessageEntryResponse>((_, reject) =>
                setTimeout(() => reject(new Error("decrypt timeout")), 5000)
              ),
            ]);
            return result;
          } catch {
            return {
              ...msg,
              DecryptedMessage: "",
              IsSender: deriveIsSender(msg, userPublicKeyBase58Check),
              error: "decryption failed",
            } as DecryptedMessageEntryResponse;
          }
        })
      );

      // If any message failed to decrypt and we haven't refreshed groups yet,
      // fetch fresh access groups and retry the failed ones (mirrors the retry
      // logic in decryptAccessGroupMessagesWithRetry).
      const failedIndices = decrypted
        .map((d, idx) => (d.error && !d.DecryptedMessage ? idx : -1))
        .filter((idx) => idx >= 0);

      if (failedIndices.length > 0 && !groupsRefreshed) {
        groupsRefreshed = true;
        try {
          const now = Date.now();
          if (
            accessGroupsCache &&
            now - accessGroupsCache.fetchedAt < ACCESS_GROUPS_CACHE_TTL_MS
          ) {
            currentGroups = accessGroupsCache.data;
          } else {
            const fresh = await getAllAccessGroups({
              PublicKeyBase58Check: userPublicKeyBase58Check,
            });
            currentGroups = (fresh.AccessGroupsOwned || []).concat(
              fresh.AccessGroupsMember || []
            );
            accessGroupsCache = { data: currentGroups, fetchedAt: now };
          }

          // Retry only the failed messages with fresh groups
          await Promise.all(
            failedIndices.map(async (idx) => {
              try {
                const retried = await Promise.race([
                  identity.decryptMessage(
                    messagesToDecrypt[idx]!,
                    currentGroups
                  ),
                  new Promise<DecryptedMessageEntryResponse>((_, reject) =>
                    setTimeout(() => reject(new Error("decrypt timeout")), 5000)
                  ),
                ]);
                decrypted[idx] = retried;
              } catch {
                // Still failed — keep the error placeholder
              }
            })
          );
        } catch (e) {
          console.error(
            "[ChatOn] Access group refresh for preview decryption failed:",
            e
          );
        }
      }

      // Decrypt ExtraData fields (emoji, reactions, media URLs) before caching.
      // Without this, the cache stores messages with encrypted ExtraData, and
      // subsequent poll refreshes hit the cache and skip ExtraData decryption —
      // causing emojis and reactions to flash in and out.
      const withExtraData = await Promise.all(
        decrypted.map((msg) =>
          msg.DecryptedMessage && !msg.error
            ? decryptExtraDataFields(msg, currentGroups)
            : msg
        )
      );

      const updates = new Map<string, DecryptedMessageEntryResponse>();
      for (let j = 0; j < uncachedBatch.length; j++) {
        const result = withExtraData[j]!;
        updates.set(uncachedBatch[j]![0], result);
        // Cache successful decryptions (now with decrypted ExtraData)
        if (result.DecryptedMessage && !result.error) {
          cacheDecryptionResult(result.MessageInfo.TimestampNanos, result);
        }
      }
      onBatch(updates);
    } catch (e) {
      console.error("[ChatOn] Preview decryption batch failed:", e);
      // Continue with next batch — don't let one failure stop everything
    }

    // Tier 2: yield to event loop between batches so UI stays responsive.
    // Tier 1 skips yielding to decrypt the viewport as fast as possible.
    if (i >= TIER1_COUNT) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return currentGroups;
}

// ── Original conversation loading ────────────────────────────────────────────

export const getConversationsNewMap = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const {
    decrypted,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  } = await getConversationNew(userPublicKeyBase58Check, allAccessGroups);
  const conversations: ConversationMap = {};
  decrypted.forEach((dmr) => {
    const otherInfo =
      dmr.ChatType === ChatType.DM
        ? dmr.IsSender
          ? dmr.RecipientInfo
          : dmr.SenderInfo
        : dmr.RecipientInfo;
    const key =
      otherInfo.OwnerPublicKeyBase58Check +
      (otherInfo.AccessGroupKeyName
        ? otherInfo.AccessGroupKeyName
        : DEFAULT_KEY_MESSAGING_GROUP_NAME);
    const currentConversation = conversations[key];
    if (currentConversation) {
      currentConversation.messages.push(dmr);
      currentConversation.messages.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
      return;
    }
    conversations[key] = {
      firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
      messages: [dmr],
      ChatType: dmr.ChatType,
    };
  });
  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
};

export const getConversationNew = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const rawResult = await fetchMessageThreadsRaw(userPublicKeyBase58Check);
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      rawResult.messageThreads,
      allAccessGroups
    );
  return {
    decrypted,
    publicKeyToProfileEntryResponseMap:
      rawResult.publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
};

export const getConversations = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  try {
    let {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    } = await getConversationsNewMap(userPublicKeyBase58Check, allAccessGroups);

    if (Object.keys(conversations).length === 0) {
      const txnHashHex = await encryptAndSendNewMessage(
        "Hi. This is my first test message!",
        userPublicKeyBase58Check,
        USER_TO_SEND_MESSAGE_TO
      );
      await waitForTransactionFound(txnHashHex);
      const getConversationsNewMapResponse = await getConversationsNewMap(
        userPublicKeyBase58Check,
        allAccessGroups
      );
      conversations = getConversationsNewMapResponse.conversations;
      publicKeyToProfileEntryResponseMap =
        getConversationsNewMapResponse.publicKeyToProfileEntryResponseMap;
      updatedAllAccessGroups =
        getConversationsNewMapResponse.updatedAllAccessGroups;
    }
    return {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    };
  } catch (e: any) {
    toast.error(e.toString());
    console.error(e);
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap: {},
      updatedAllAccessGroups: [],
    };
  }
};

/**
 * Differential polling: re-fetches all threads (API has no pagination) but only
 * decrypts conversations whose latest message timestamp changed since last poll.
 * Unchanged conversations return cached decrypted results — dropping crypto work
 * from O(total_conversations) to O(changed_conversations) per cycle.
 */
export const getConversationsDifferential = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  // Step 1: Fetch DM + group threads in parallel (faster than single combined call)
  const rawResult = await fetchMessageThreadsRaw(userPublicKeyBase58Check);
  const messageThreads = rawResult.messageThreads;
  const publicKeyToProfileEntryResponseMap =
    rawResult.publicKeyToProfileEntryResponseMap;

  if (messageThreads.length === 0) {
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups: allAccessGroups,
    };
  }

  // Step 2: Group by conversation key and find latest timestamp per conversation
  const threadsByConvo = new Map<
    string,
    {
      messages: NewMessageEntryResponse[];
      latestTs: number;
      otherInfo: NewMessageEntryResponse["RecipientInfo"];
      chatType: ChatType;
    }
  >();

  for (const msg of messageThreads) {
    const { key, otherInfo } = conversationKey(msg, userPublicKeyBase58Check);
    const ts = msg.MessageInfo.TimestampNanos;
    const existing = threadsByConvo.get(key);
    if (existing) {
      existing.messages.push(msg);
      if (ts > existing.latestTs) existing.latestTs = ts;
    } else {
      threadsByConvo.set(key, {
        messages: [msg],
        latestTs: ts,
        otherInfo,
        chatType: msg.ChatType,
      });
    }
  }

  // Step 3: Identify changed conversations
  const changedMessages: NewMessageEntryResponse[] = [];
  const unchangedKeys = new Set<string>();

  for (const [key, data] of threadsByConvo) {
    const prevTs = conversationLatestTimestamp.get(key);
    if (prevTs !== undefined && prevTs === data.latestTs) {
      unchangedKeys.add(key);
    } else {
      changedMessages.push(...data.messages);
      conversationLatestTimestamp.set(key, data.latestTs);
    }
  }

  // Remove stale entries for conversations that no longer exist
  for (const key of conversationLatestTimestamp.keys()) {
    if (!threadsByConvo.has(key)) conversationLatestTimestamp.delete(key);
  }

  // Step 4: Decrypt only changed conversations
  let updatedAllAccessGroups = allAccessGroups;
  const freshDecrypted = new Map<string, DecryptedMessageEntryResponse[]>();

  if (changedMessages.length > 0) {
    const { decrypted, updatedAllAccessGroups: freshGroups } =
      await decryptAccessGroupMessagesWithRetry(
        userPublicKeyBase58Check,
        changedMessages,
        allAccessGroups
      );
    updatedAllAccessGroups = freshGroups;

    // Group decrypted messages by conversation key.
    // Use the same conversationKey() helper as Step 2 to avoid IsSender divergence
    // between deriveIsSender() and the DeSo SDK's identity.decryptMessage().
    for (let idx = 0; idx < decrypted.length; idx++) {
      const dmr = decrypted[idx]!;
      const { key } = conversationKey(
        changedMessages[idx]!,
        userPublicKeyBase58Check
      );
      const arr = freshDecrypted.get(key) || [];
      arr.push(dmr);
      freshDecrypted.set(key, arr);
    }
  }

  // Step 5: Build ConversationMap — fresh data for changed, cached for unchanged
  const conversations: ConversationMap = {};

  for (const [key, data] of threadsByConvo) {
    if (freshDecrypted.has(key)) {
      // Changed conversation — use freshly decrypted messages
      const msgs = freshDecrypted.get(key)!;
      msgs.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
      conversations[key] = {
        firstMessagePublicKey: data.otherInfo.OwnerPublicKeyBase58Check,
        messages: msgs,
        ChatType: data.chatType,
      };
    } else {
      // Unchanged conversation — pull from decryption result cache.
      // Parallelize any rare cache misses with Promise.all.
      const cachedMsgs = await Promise.all(
        data.messages.map(async (rawMsg) => {
          const cached = decryptionResultCache.get(
            rawMsg.MessageInfo.TimestampNanos
          );
          if (cached) return cached;
          // Cache miss (shouldn't happen often) — decrypt it
          try {
            const dec = await identity.decryptMessage(
              rawMsg,
              updatedAllAccessGroups
            );
            const result = await decryptExtraDataFields(
              dec,
              updatedAllAccessGroups
            );
            if (result.DecryptedMessage && !result.error) {
              cacheDecryptionResult(result.MessageInfo.TimestampNanos, result);
            }
            return result;
          } catch {
            return {
              ...rawMsg,
              DecryptedMessage: "",
              IsSender: deriveIsSender(rawMsg, userPublicKeyBase58Check),
              error: "decryption failed",
            } as DecryptedMessageEntryResponse;
          }
        })
      );
      cachedMsgs.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
      conversations[key] = {
        firstMessagePublicKey: data.otherInfo.OwnerPublicKeyBase58Check,
        messages: cachedMsgs,
        ChatType: data.chatType,
      };
    }
  }

  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
};

// --- Retry caches to avoid redundant API calls across polling cycles ---

// Cache for getAllAccessGroups: { data, timestamp }
let accessGroupsCache: {
  data: AccessGroupEntryResponse[];
  fetchedAt: number;
} | null = null;
const ACCESS_GROUPS_CACHE_TTL_MS = 30_000; // 30 seconds

// Cache for getBulkAccessGroups sender default-key mappings
const senderDefaultKeyCache = new Map<
  string,
  { publicKey: string; fetchedAt: number }
>();
const SENDER_KEY_CACHE_TTL_MS = 60_000; // 60 seconds

// Messages that permanently fail decryption even with fresh groups.
// Key = TimestampNanos (unique per message). Cleared on login/logout.
const permanentlyFailedMessages = new Set<number>();

// --- Decryption result cache (avoids re-decrypting unchanged messages) ---
// Key = TimestampNanos (globally unique per message on DeSo).
// Capped at 5000 entries — evicts oldest on overflow to bound memory.
const DECRYPTION_CACHE_MAX_SIZE = 5000;
const decryptionResultCache = new Map<number, DecryptedMessageEntryResponse>();

/** Cache a decryption result, evicting oldest entries if over the size limit. */
export function cacheDecryptionResult(
  ts: number,
  msg: DecryptedMessageEntryResponse
) {
  decryptionResultCache.set(ts, msg);
  if (decryptionResultCache.size > DECRYPTION_CACHE_MAX_SIZE) {
    // Map iterates in insertion order — delete the oldest entry
    const oldest = decryptionResultCache.keys().next().value;
    if (oldest !== undefined) decryptionResultCache.delete(oldest);
  }
}

// Per-conversation latest timestamp — used by differential polling to detect changes.
const conversationLatestTimestamp = new Map<string, number>();

/** Invalidate caches for a single edited message, forcing re-decrypt on next poll. */
export function invalidateMessageCache(ts: number, convKey: string) {
  decryptionResultCache.delete(ts);
  conversationLatestTimestamp.delete(convKey);
}

/** Clear all decryption caches (call on login/logout). */
export const clearDecryptionCaches = () => {
  accessGroupsCache = null;
  senderDefaultKeyCache.clear();
  permanentlyFailedMessages.clear();
  decryptionResultCache.clear();
  conversationLatestTimestamp.clear();
};

export const decryptAccessGroupMessagesWithRetry = async (
  publicKeyBase58Check: string,
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  let decryptedMessageEntries = await decryptAccessGroupMessages(
    messages,
    accessGroups
  );

  // Retry with fresh access groups if any message failed to decrypt.
  // "access group key not found" = group missing from local list.
  // "incorrect MAC" = stale/outdated group key (e.g. key was rotated).
  // Both are fixed by fetching the latest access groups from the blockchain.
  //
  // Skip messages already known to permanently fail — they failed even with
  // fresh groups on a previous poll, so retrying is wasted work.
  const looksLikeEncryptedHex = (text: string) =>
    text.length >= 66 && /^[0-9a-f]+$/i.test(text);

  const hasNewDecryptionErrors = decryptedMessageEntries.some(
    (dmr) =>
      ((dmr.error && !dmr.DecryptedMessage) ||
        looksLikeEncryptedHex(dmr.DecryptedMessage || "")) &&
      !permanentlyFailedMessages.has(dmr.MessageInfo.TimestampNanos)
  );
  if (hasNewDecryptionErrors) {
    const now = Date.now();
    if (
      accessGroupsCache &&
      now - accessGroupsCache.fetchedAt < ACCESS_GROUPS_CACHE_TTL_MS
    ) {
      // Use cached access groups instead of fetching again
      accessGroups = accessGroupsCache.data;
    } else {
      const newAllAccessGroups = await getAllAccessGroups({
        PublicKeyBase58Check: publicKeyBase58Check,
      });
      accessGroups = (newAllAccessGroups.AccessGroupsOwned || []).concat(
        newAllAccessGroups.AccessGroupsMember || []
      );
      accessGroupsCache = { data: accessGroups, fetchedAt: now };
    }
    decryptedMessageEntries = await decryptAccessGroupMessages(
      messages,
      accessGroups
    );

    // Track messages that still fail after fresh groups — they're permanently broken
    for (const dmr of decryptedMessageEntries) {
      if (
        (dmr.error && !dmr.DecryptedMessage) ||
        looksLikeEncryptedHex(dmr.DecryptedMessage || "")
      ) {
        permanentlyFailedMessages.add(dmr.MessageInfo.TimestampNanos);
      }
    }
  }

  // Fallback for "incorrect MAC" on group messages: the sender's app may
  // have recorded their base public key in SenderInfo instead of their
  // default-key messaging public key. Fetch the actual default-key and
  // retry decryption with a patched SenderInfo.
  const macErrors = decryptedMessageEntries.filter(
    (msg) =>
      msg.error?.includes("incorrect MAC") &&
      !msg.DecryptedMessage &&
      msg.ChatType === ChatType.GROUPCHAT &&
      !permanentlyFailedMessages.has(msg.MessageInfo.TimestampNanos)
  );
  if (macErrors.length > 0) {
    // Collect unique sender keys that failed, excluding those already cached
    const now = Date.now();
    const failedSenderKeys = [
      ...new Set(macErrors.map((m) => m.SenderInfo.OwnerPublicKeyBase58Check)),
    ];

    // Build map from cache hits + fetch only uncached senders
    const senderDefaultKeyMap = new Map<string, string>();
    const uncachedSenderKeys: string[] = [];

    for (const pk of failedSenderKeys) {
      const cached = senderDefaultKeyCache.get(pk);
      if (cached && now - cached.fetchedAt < SENDER_KEY_CACHE_TTL_MS) {
        senderDefaultKeyMap.set(pk, cached.publicKey);
      } else {
        uncachedSenderKeys.push(pk);
      }
    }

    if (uncachedSenderKeys.length > 0) {
      try {
        const { AccessGroupEntries } = await getBulkAccessGroups({
          GroupOwnerAndGroupKeyNamePairs: uncachedSenderKeys.map((pk) => ({
            GroupOwnerPublicKeyBase58Check: pk,
            GroupKeyName: "default-key",
          })),
        });
        for (const entry of AccessGroupEntries || []) {
          const ownerPk = entry.AccessGroupOwnerPublicKeyBase58Check;
          const groupPk = entry.AccessGroupPublicKeyBase58Check;
          senderDefaultKeyMap.set(ownerPk, groupPk);
          senderDefaultKeyCache.set(ownerPk, {
            publicKey: groupPk,
            fetchedAt: now,
          });
        }
      } catch {
        // Non-fatal — fall through with whatever we have
      }
    }

    if (senderDefaultKeyMap.size > 0) {
      // Build patched messages: swap the sender's stated public key with
      // their actual default-key public key, then re-decrypt.
      const indicesToRetry: number[] = [];
      const patchedMessages: NewMessageEntryResponse[] = [];
      for (let i = 0; i < decryptedMessageEntries.length; i++) {
        const msg = decryptedMessageEntries[i]!;
        if (
          !msg.error?.includes("incorrect MAC") ||
          msg.DecryptedMessage ||
          msg.ChatType !== ChatType.GROUPCHAT
        )
          continue;

        const realKey = senderDefaultKeyMap.get(
          msg.SenderInfo.OwnerPublicKeyBase58Check
        );
        // Skip if we don't have the default key, or it's the same as what was tried
        if (
          !realKey ||
          realKey === msg.SenderInfo.AccessGroupPublicKeyBase58Check
        )
          continue;

        indicesToRetry.push(i);
        patchedMessages.push({
          ...messages[i]!,
          SenderInfo: {
            ...messages[i]!.SenderInfo,
            AccessGroupPublicKeyBase58Check: realKey,
            AccessGroupKeyName: "default-key",
          },
        } as NewMessageEntryResponse);
      }

      if (patchedMessages.length > 0) {
        const retried = await decryptAccessGroupMessages(
          patchedMessages,
          accessGroups
        );
        for (let j = 0; j < indicesToRetry.length; j++) {
          if (retried[j]!.DecryptedMessage) {
            decryptedMessageEntries[indicesToRetry[j]!] = retried[j]!;
            // Decryption succeeded with patched key — remove from permanently failed
            permanentlyFailedMessages.delete(
              retried[j]!.MessageInfo.TimestampNanos
            );
          }
        }
      }
    }
  }

  return {
    decrypted: decryptedMessageEntries,
    updatedAllAccessGroups: accessGroups,
  };
};

export const decryptAccessGroupMessages = async (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> => {
  // Track which indices were cache hits to skip decryptExtraDataFields for them
  const cacheHitIndices = new Set<number>();

  const decrypted = await Promise.all(
    (messages || []).map(async (m, idx) => {
      // Check decryption cache first — avoids redundant crypto on every poll
      const ts = m.MessageInfo.TimestampNanos;
      const cached = decryptionResultCache.get(ts);
      if (cached) {
        cacheHitIndices.add(idx);
        return cached;
      }
      return identity.decryptMessage(m, accessGroups);
    })
  );

  // Decrypt encrypted ExtraData only for freshly decrypted messages (not cache hits)
  const results = await Promise.all(
    decrypted.map((msg, idx) =>
      cacheHitIndices.has(idx) ? msg : decryptExtraDataFields(msg, accessGroups)
    )
  );

  // Cache successful decryptions
  for (const msg of results) {
    if (msg.DecryptedMessage && !msg.error) {
      cacheDecryptionResult(msg.MessageInfo.TimestampNanos, msg);
    }
  }

  return results;
};

/** Keys from the DeSo main app (Diamond/Focus) that contain encrypted media URLs. */
const DESO_APP_ENCRYPTED_KEYS = [
  "encryptedVideoURLs",
  "encryptedImageURLs",
  "encryptedAudioURLs",
] as const;

/**
 * If a message has encrypted ExtraData values (flagged by msg:encrypted),
 * decrypt each one by feeding it through identity.decryptMessage as a
 * fake message. This reuses the SDK's DM-vs-group key resolution so we
 * don't need to reimplement it.
 *
 * Also handles DeSo main app format (encryptedVideoURLs, encryptedImageURLs)
 * which encrypts media URLs independently of the msg:encrypted flag.
 */
async function decryptExtraDataFields(
  msg: DecryptedMessageEntryResponse,
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse> {
  const extra = msg.MessageInfo?.ExtraData;
  if (!extra) return msg;

  const updatedExtra = { ...extra };

  // Decrypt ChatOn-format encrypted ExtraData (msg:encrypted flag)
  if (extra[MSG_ENCRYPTED] === "true") {
    for (const key of FULL_ENCRYPTED_KEYS) {
      const cipherText = updatedExtra[key];
      if (!cipherText) continue;

      try {
        const fakeMsg = {
          ...msg,
          MessageInfo: {
            ...msg.MessageInfo,
            EncryptedText: cipherText,
            ExtraData: Object.fromEntries(
              Object.entries(extra).filter(([k]) => k !== "unencrypted")
            ),
          },
        } as NewMessageEntryResponse;

        const decryptedFake = await identity.decryptMessage(
          fakeMsg,
          accessGroups
        );
        updatedExtra[key] = decryptedFake.DecryptedMessage;
      } catch {
        // If decryption fails (e.g. legacy plaintext value), leave as-is
      }
    }
  }

  // Decrypt DeSo main app encrypted media URLs (encryptedVideoURLs, encryptedImageURLs)
  for (const key of DESO_APP_ENCRYPTED_KEYS) {
    const cipherText = updatedExtra[key];
    if (!cipherText) continue;

    try {
      const fakeMsg = {
        ...msg,
        MessageInfo: {
          ...msg.MessageInfo,
          EncryptedText: cipherText,
          ExtraData: Object.fromEntries(
            Object.entries(extra).filter(([k]) => k !== "unencrypted")
          ),
        },
      } as NewMessageEntryResponse;

      const decryptedFake = await identity.decryptMessage(
        fakeMsg,
        accessGroups
      );
      updatedExtra[key] = decryptedFake.DecryptedMessage;
    } catch {
      // If decryption fails, leave as-is
    }
  }

  return {
    ...msg,
    MessageInfo: {
      ...msg.MessageInfo,
      ExtraData: updatedExtra,
    },
  };
}

/**
 * Prepare an encrypted DM message request body WITHOUT broadcasting.
 * Used by both encryptAndSendNewMessage (normal send) and
 * sendAtomicPaidMessage (bundled payment+message).
 */
export const prepareEncryptedDMMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  additionalExtraData: Record<string, string> = {}
): Promise<{
  requestBody: Record<string, unknown>;
  isDM: boolean;
}> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = { ...additionalExtraData };
  // Strip local-only keys (prefixed with _) — used for optimistic UI, not stored on-chain
  for (const key of Object.keys(ExtraData)) {
    if (key.startsWith("_")) delete ExtraData[key];
  }
  if (response.RecipientAccessGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check,
      messageToSend
    );

    // Always encrypt DeSo app media URLs (encryptedVideoURLs, encryptedImageURLs)
    // to match the standard DeSo format used by Diamond/Focus.
    for (const key of DESO_APP_ENCRYPTED_KEYS) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
      }
    }

    // Encrypt sensitive ExtraData values with the same recipient key.
    // Which keys are encrypted depends on the user's privacy mode.
    const keysToEncrypt = getEncryptedExtraDataKeys(
      useStore.getState().privacyMode
    );
    let hasEncrypted = false;
    for (const key of keysToEncrypt) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
        hasEncrypted = true;
      }
    }
    if (hasEncrypted) {
      ExtraData[MSG_ENCRYPTED] = "true";
    }
  } else {
    message = bytesToHex(new TextEncoder().encode(messageToSend));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  if (!message) {
    return Promise.reject("error encrypting message");
  }

  const requestBody = {
    SenderAccessGroupOwnerPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupPublicKeyBase58Check:
      response.SenderAccessGroupPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientAccessGroupOwnerPublicKeyBase58Check:
      RecipientPublicKeyBase58Check,
    RecipientAccessGroupPublicKeyBase58Check: isUnencrypted
      ? response.RecipientPublicKeyBase58Check
      : response.RecipientAccessGroupPublicKeyBase58Check,
    RecipientAccessGroupKeyName: response.RecipientAccessGroupKeyName,
    ExtraData,
    EncryptedMessageText: message,
    MinFeeRateNanosPerKB: 1000,
  };

  const isDM =
    !RecipientMessagingKeyName ||
    RecipientMessagingKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME;

  return { requestBody, isDM };
};

export const encryptAndSendNewMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  additionalExtraData: Record<string, string> = {}
): Promise<string> => {
  const { requestBody, isDM } = await prepareEncryptedDMMessage(
    messageToSend,
    senderPublicKeyBase58Check,
    RecipientPublicKeyBase58Check,
    RecipientMessagingKeyName,
    SenderMessagingKeyName,
    additionalExtraData
  );

  const { submittedTransactionResponse } = await withAuth(() =>
    isDM
      ? sendDMMessage(requestBody as any)
      : sendGroupChatMessage(requestBody as any)
  );

  if (!submittedTransactionResponse) {
    throw new Error("Failed to submit transaction for sending message.");
  }

  return submittedTransactionResponse.TxnHashHex;
};

/**
 * Send a system log message to a group chat (e.g. "X joined the group").
 * Best-effort — errors are logged but never thrown.
 */
export const sendSystemMessage = async (
  senderPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string,
  action: SystemAction,
  members: MentionEntry[]
): Promise<void> => {
  const names = members.map((m) => m.un || m.pk.slice(0, 8));
  const label =
    names.length <= 3
      ? names.join(", ")
      : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  const verb = action === "member-left" ? "left" : "joined";
  const fallback = `${label} ${verb} the group`;

  try {
    await encryptAndSendNewMessage(
      fallback,
      senderPublicKey,
      groupOwnerPublicKey,
      groupKeyName,
      DEFAULT_KEY_MESSAGING_GROUP_NAME,
      buildExtraData({
        type: "system",
        systemAction: action,
        systemMembers: members,
      })
    );
  } catch (e) {
    console.error("Failed to send system message:", e);
  }
};

export const encryptAndUpdateMessage = async (
  newMessageText: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  originalTimestampNanosString: string,
  additionalExtraData: Record<string, string> = {}
): Promise<string> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = { ...additionalExtraData };
  // Strip local-only keys (prefixed with _) — used for optimistic UI, not stored on-chain
  for (const key of Object.keys(ExtraData)) {
    if (key.startsWith("_")) delete ExtraData[key];
  }
  if (response.RecipientAccessGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check,
      newMessageText
    );

    // Encrypt DeSo app media URLs (encryptedVideoURLs, encryptedImageURLs)
    // to match the standard DeSo format used by Diamond/Focus.
    for (const key of DESO_APP_ENCRYPTED_KEYS) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
      }
    }

    const keysToEncrypt = getEncryptedExtraDataKeys(
      useStore.getState().privacyMode
    );
    let hasEncrypted = false;
    for (const key of keysToEncrypt) {
      if (ExtraData[key]) {
        ExtraData[key] = await identity.encryptMessage(
          response.RecipientAccessGroupPublicKeyBase58Check,
          ExtraData[key]
        );
        hasEncrypted = true;
      }
    }
    if (hasEncrypted) {
      ExtraData[MSG_ENCRYPTED] = "true";
    }
  } else {
    message = bytesToHex(new TextEncoder().encode(newMessageText));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  if (!message) {
    return Promise.reject("error encrypting message");
  }

  const requestBody = {
    SenderAccessGroupOwnerPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupPublicKeyBase58Check:
      response.SenderAccessGroupPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientAccessGroupOwnerPublicKeyBase58Check:
      RecipientPublicKeyBase58Check,
    RecipientAccessGroupPublicKeyBase58Check: isUnencrypted
      ? response.RecipientPublicKeyBase58Check
      : response.RecipientAccessGroupPublicKeyBase58Check,
    RecipientAccessGroupKeyName: response.RecipientAccessGroupKeyName,
    ExtraData,
    EncryptedMessageText: message,
    TimestampNanosString: originalTimestampNanosString,
    MinFeeRateNanosPerKB: 1000,
  };

  const isDM =
    !RecipientMessagingKeyName ||
    RecipientMessagingKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME;

  const { submittedTransactionResponse } = await withAuth(() =>
    isDM ? updateDMMessage(requestBody) : updateGroupChatMessage(requestBody)
  );

  if (!submittedTransactionResponse) {
    throw new Error("Failed to submit transaction for updating message.");
  }

  return submittedTransactionResponse.TxnHashHex;
};

// ── Chat Requests: fetch & classify ─────────────────────────────────

const FOLLOWS_PAGE_SIZE = 500;

async function fetchAllFollowsPaginated(
  publicKey: string,
  getFollowers: boolean
): Promise<Set<string>> {
  const keys = new Set<string>();
  let lastKey = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getFollowersForUser({
      PublicKeyBase58Check: publicKey,
      GetEntriesFollowingUsername: getFollowers,
      NumToFetch: FOLLOWS_PAGE_SIZE,
      ...(lastKey ? { LastPublicKeyBase58Check: lastKey } : {}),
    });

    const entries = Object.keys(res.PublicKeyToProfileEntry || {});
    if (entries.length === 0) break;

    for (const k of entries) keys.add(k);
    if (entries.length < FOLLOWS_PAGE_SIZE) break;
    lastKey = entries[entries.length - 1]!;
  }

  return keys;
}

export async function fetchFollowedUsers(
  publicKey: string
): Promise<Set<string>> {
  return fetchAllFollowsPaginated(publicKey, false);
}

/** Fetch all associations of a single type. Returns Map<targetPubKey, associationId>. */
export async function fetchAssociationsByType(
  publicKey: string,
  associationType: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: associationType,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      map.set(a.TargetUserPublicKeyBase58Check, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return map;
}

export async function fetchChatAssociations(publicKey: string): Promise<{
  approved: Map<string, string>;
  blocked: Map<string, string>;
  archivedChats: Map<string, string>;
  dismissed: Map<string, string>;
  paid: Map<string, string>;
}> {
  const [approved, blocked, archivedChats, dismissed, paid] = await Promise.all(
    [
      fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_APPROVED),
      fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_BLOCKED),
      fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_CHAT_ARCHIVED),
      fetchAssociationsByType(publicKey, ASSOCIATION_TYPE_DISMISSED),
      fetchAssociationsByTargetType(publicKey, ASSOCIATION_TYPE_CHAT_PAID),
    ]
  );

  return { approved, blocked, archivedChats, dismissed, paid };
}

export function classifyConversation(
  conversation: Conversation,
  conversationKey: string,
  myPublicKey: string,
  followedUsers: Set<string>,
  approvedUsers: Set<string>,
  blockedUsers: Set<string>,
  initiatedChats: Set<string>,
  archivedGroups: Set<string>,
  archivedChats: Set<string>,
  dismissedUsers: Set<string>,
  paidUsers: Set<string> = new Set(),
  spamFilter?: SpamFilterConfig,
  senderProfiles?: Map<string, ProfileEntryResponse>,
  acceptedGroups: Set<string> = new Set(),
  groupsWithMyMessages: Set<string> = new Set()
): "chat" | "request" | "blocked" | "archived" | "dismissed" {
  if (conversation.ChatType === ChatType.GROUPCHAT) {
    if (archivedGroups.has(conversationKey)) return "archived";
    // Owner always sees their own groups
    if (conversation.firstMessagePublicKey === myPublicKey) return "chat";
    // Explicitly accepted via association
    if (acceptedGroups.has(conversationKey)) return "chat";
    // Implicitly accepted: user has sent a message in the group
    if (groupsWithMyMessages.has(conversationKey)) return "chat";
    return "request";
  }

  const otherKey = conversation.firstMessagePublicKey;

  if (blockedUsers.has(otherKey)) return "blocked";
  if (dismissedUsers.has(otherKey)) return "dismissed";
  if (archivedChats.has(otherKey)) return "archived";
  if (followedUsers.has(otherKey)) return "chat";
  if (approvedUsers.has(otherKey)) return "chat";
  if (paidUsers.has(otherKey)) return "chat";
  if (initiatedChats.has(otherKey)) return "chat";

  // If the current user sent the first message (chronologically), they initiated
  if (conversation.messages.length > 0) {
    const oldest = conversation.messages[conversation.messages.length - 1]!;
    if (
      oldest.IsSender ||
      oldest.SenderInfo?.OwnerPublicKeyBase58Check === myPublicKey
    ) {
      return "chat";
    }
  }

  // If spam filter is enabled, check sender's on-chain metrics.
  // Senders who pass the filter are promoted to "chat"; others stay "request".
  if (spamFilter?.enabled && senderProfiles) {
    const profile = senderProfiles.get(otherKey);
    const passed = passesSenderFilter(spamFilter, profile);
    if (passed === true) return "chat";
  }

  return "request";
}

// All createUserAssociation calls use checkPermissions: false to skip the SDK's
// built-in per-transaction guardTxPermission prompt. We handle permissions ourselves
// via withAuth (which requests the full spending limits on failure) and the startup
// ensurePermissions toast. Without this, the SDK prompts individually per association type.

export async function createApprovalAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: targetPublicKey,
        AssociationType: ASSOCIATION_TYPE_APPROVED,
        AssociationValue: ASSOCIATION_VALUE_APPROVED,
      },
      { checkPermissions: false }
    )
  );
}

export async function createBlockAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: targetPublicKey,
        AssociationType: ASSOCIATION_TYPE_BLOCKED,
        AssociationValue: ASSOCIATION_VALUE_BLOCKED,
      },
      { checkPermissions: false }
    )
  );
}

// ── Group archive (leave group) ─────────────────────────────────────

export async function fetchArchivedGroups(
  publicKey: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_ARCHIVED,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      // Reconstruct conversation key: ownerPubKey + groupKeyName
      const conversationKey =
        a.TargetUserPublicKeyBase58Check + a.AssociationValue;
      map.set(conversationKey, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return map;
}

export async function createArchiveAssociation(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
        AssociationType: ASSOCIATION_TYPE_GROUP_ARCHIVED,
        AssociationValue: groupKeyName,
      },
      { checkPermissions: false }
    )
  );
}

export async function deleteArchiveAssociation(
  myPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationID: associationId,
    })
  );
}

// ── Group accepted (user consented to group membership) ─────────────

export async function fetchAcceptedGroups(
  publicKey: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_ACCEPTED,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      // Reconstruct conversation key: ownerPubKey + groupKeyName
      const conversationKey =
        a.TargetUserPublicKeyBase58Check + a.AssociationValue;
      map.set(conversationKey, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return map;
}

export async function createGroupAcceptedAssociation(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
        AssociationType: ASSOCIATION_TYPE_GROUP_ACCEPTED,
        AssociationValue: groupKeyName,
      },
      { checkPermissions: false }
    )
  );
}

// ── DM archive (hide a DM conversation) ────────────────────────────

export async function createArchiveChatAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: targetPublicKey,
        AssociationType: ASSOCIATION_TYPE_CHAT_ARCHIVED,
        AssociationValue: ASSOCIATION_VALUE_ARCHIVED,
      },
      { checkPermissions: false }
    )
  );
}

export async function deleteAssociationById(
  myPublicKey: string,
  associationId: string
): Promise<void> {
  await withAuth(() =>
    deleteUserAssociation({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationID: associationId,
    })
  );
}

// ── Dismiss request ─────────────────────────────────────────────────

export async function createDismissAssociation(
  myPublicKey: string,
  targetPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: targetPublicKey,
        AssociationType: ASSOCIATION_TYPE_DISMISSED,
        AssociationValue: ASSOCIATION_VALUE_DISMISSED,
      },
      { checkPermissions: false }
    )
  );
}

// ── Privacy mode (on-chain preference) ──────────────────────────────

/**
 * Fetch the user's privacy mode from on-chain associations.
 * Self-referencing association: transactor = target = the user.
 * Returns { mode, associationId } or defaults to "full".
 */
export async function fetchPrivacyMode(
  publicKey: string
): Promise<{ mode: PrivacyMode; associationId: string | null }> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
      Limit: 1,
    });

    const assoc = res.Associations?.[0];
    if (assoc) {
      const value = assoc.AssociationValue;
      const mode: PrivacyMode = value === "full" ? "full" : "standard";
      return { mode, associationId: assoc.AssociationID };
    }
  } catch (e) {
    console.error("Failed to fetch privacy mode association:", e);
  }
  return { mode: "full", associationId: null };
}

/**
 * Create or update the user's privacy mode on-chain.
 * If an existing association exists, delete it first (DeSo doesn't support
 * updating association values — must delete + recreate).
 */
export async function setPrivacyModeOnChain(
  myPublicKey: string,
  mode: PrivacyMode,
  existingAssociationId: string | null
): Promise<string> {
  // Delete old association if it exists
  if (existingAssociationId) {
    await withAuth(() =>
      deleteUserAssociation({
        TransactorPublicKeyBase58Check: myPublicKey,
        AssociationID: existingAssociationId,
      })
    );
  }

  // Only create on-chain if not the default — avoids unnecessary transactions
  if (mode === PRIVACY_MODE_FULL && !existingAssociationId) {
    return "";
  }

  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: myPublicKey, // self-association
        AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
        AssociationValue: mode,
      },
      { checkPermissions: false }
    )
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: myPublicKey,
    AssociationType: ASSOCIATION_TYPE_PRIVACY_MODE,
    Limit: 1,
  });

  return res.Associations?.[0]?.AssociationID || "";
}

// ─── Spam Filter Settings ─────────────────────────────────────────

import { DEFAULT_SPAM_FILTER } from "../utils/spam-filter";

/**
 * Fetch the user's spam filter settings from on-chain self-association.
 */
export async function fetchSpamFilterSettings(
  publicKey: string
): Promise<{ config: SpamFilterConfig; associationId: string | null }> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_SPAM_FILTER,
      Limit: 1,
    });

    const assoc = res.Associations?.[0];
    if (assoc?.ExtraData) {
      const config: SpamFilterConfig = {
        enabled: true,
        minBalanceNanos: Math.max(
          0,
          Number(assoc.ExtraData.minBalanceNanos) || 0
        ),
        requireProfile: assoc.ExtraData.requireProfile === "true",
      };
      return { config, associationId: assoc.AssociationID };
    }
  } catch (e) {
    console.error("Failed to fetch spam filter settings:", e);
  }
  return { config: DEFAULT_SPAM_FILTER, associationId: null };
}

/**
 * Set or update the user's spam filter on-chain.
 * Pass config.enabled = false to disable (deletes association).
 */
export async function setSpamFilterOnChain(
  myPublicKey: string,
  config: SpamFilterConfig,
  existingAssociationId: string | null
): Promise<string> {
  // Delete old association if it exists
  if (existingAssociationId) {
    await withAuth(() =>
      deleteUserAssociation({
        TransactorPublicKeyBase58Check: myPublicKey,
        AssociationID: existingAssociationId,
      })
    );
  }

  // If disabling, just delete
  if (!config.enabled) {
    return "";
  }

  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: myPublicKey, // self-association
        AssociationType: ASSOCIATION_TYPE_SPAM_FILTER,
        AssociationValue: ASSOCIATION_VALUE_SPAM_FILTER,
        ExtraData: {
          minBalanceNanos: String(config.minBalanceNanos),
          requireProfile: config.requireProfile ? "true" : "false",
        },
      },
      { checkPermissions: false }
    )
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: myPublicKey,
    AssociationType: ASSOCIATION_TYPE_SPAM_FILTER,
    Limit: 1,
  });

  return res.Associations?.[0]?.AssociationID || "";
}

// ─── Paid Messaging Settings (Focus-compatible) ─────────────────────

/** In-memory session cache for other users' DM prices. */
const dmPriceLookupCache = new Map<
  string,
  { cents: number | null; followingCents: number; fetchedAt: number }
>();
const DM_PRICE_LOOKUP_TTL_MS = 5 * 60 * 1000;

/** Clear the in-memory DM price lookup cache (call on logout/account switch). */
export function clearDmPriceLookupCache(): void {
  dmPriceLookupCache.clear();
}

/**
 * Fetch the current user's own paid messaging settings (self-association).
 * Returns cents = null if the feature is not enabled.
 */
export async function fetchPaidMessagingSettings(publicKey: string): Promise<{
  cents: number | null;
  followingCents: number;
  associationId: string | null;
}> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: publicKey,
      AssociationType: ASSOCIATION_TYPE_PAID_MESSAGING,
      Limit: 1,
    });

    const assoc = res.Associations?.[0];
    if (assoc?.ExtraData) {
      const cents = parseInt(assoc.ExtraData.FeePerMessageUsdCents || "0", 10);
      const followingCents = parseInt(
        assoc.ExtraData.FollowingFeePerMessageUsdCents || "0",
        10
      );
      return {
        cents: cents > 0 ? cents : null,
        followingCents,
        associationId: assoc.AssociationID,
      };
    }
  } catch (e) {
    console.error("Failed to fetch paid messaging settings:", e);
  }
  return { cents: null, followingCents: 0, associationId: null };
}

/**
 * Set or update the user's paid messaging settings on-chain.
 * Uses the Focus-compatible PAID_MESSAGING_SETTINGS association type.
 * Pass cents = null to disable (deletes association).
 */
export async function setPaidMessagingSettingsOnChain(
  myPublicKey: string,
  cents: number | null,
  followingCents: number,
  existingAssociationId: string | null
): Promise<string> {
  // Delete old association if it exists
  if (existingAssociationId) {
    await withAuth(() =>
      deleteUserAssociation({
        TransactorPublicKeyBase58Check: myPublicKey,
        AssociationID: existingAssociationId,
      })
    );
  }

  // If disabling, just delete
  if (cents === null || cents <= 0) {
    return "";
  }

  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: myPublicKey, // self-association
        AssociationType: ASSOCIATION_TYPE_PAID_MESSAGING,
        AssociationValue: ASSOCIATION_VALUE_PAID_MESSAGING,
        ExtraData: {
          FeePerMessageUsdCents: String(cents),
          FollowingFeePerMessageUsdCents: String(followingCents),
        },
      },
      { checkPermissions: false }
    )
  );

  // Fetch the new association ID
  const res = await getUserAssociations({
    TransactorPublicKeyBase58Check: myPublicKey,
    AssociationType: ASSOCIATION_TYPE_PAID_MESSAGING,
    Limit: 1,
  });

  return res.Associations?.[0]?.AssociationID || "";
}

/**
 * Fetch another user's paid messaging price. Cached in memory for 5 minutes.
 * Returns cents = null if the user doesn't charge for DMs.
 */
export async function fetchUserPaidMessagingSettings(
  targetPublicKey: string
): Promise<{ cents: number | null; followingCents: number }> {
  // Check session cache
  const cached = dmPriceLookupCache.get(targetPublicKey);
  if (cached && Date.now() - cached.fetchedAt < DM_PRICE_LOOKUP_TTL_MS) {
    return { cents: cached.cents, followingCents: cached.followingCents };
  }

  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: targetPublicKey,
      AssociationType: ASSOCIATION_TYPE_PAID_MESSAGING,
      Limit: 1,
    });

    const assoc = res.Associations?.[0];
    if (assoc?.ExtraData) {
      const cents = parseInt(assoc.ExtraData.FeePerMessageUsdCents || "0", 10);
      const followingCents = parseInt(
        assoc.ExtraData.FollowingFeePerMessageUsdCents || "0",
        10
      );
      const result = { cents: cents > 0 ? cents : null, followingCents };
      dmPriceLookupCache.set(targetPublicKey, {
        ...result,
        fetchedAt: Date.now(),
      });
      return result;
    }
  } catch (e) {
    console.error("Failed to fetch user paid messaging settings:", e);
  }

  const result = { cents: null, followingCents: 0 };
  dmPriceLookupCache.set(targetPublicKey, {
    ...result,
    fetchedAt: Date.now(),
  });
  return result;
}

/**
 * Fetch associations where the current user is the TARGET.
 * Used for paid DM tracking: sender (transactor) → me (target).
 * Returns Map<transactorPubKey, associationId>.
 */
export async function fetchAssociationsByTargetType(
  targetPublicKey: string,
  associationType: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: targetPublicKey,
      AssociationType: associationType,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations || [];
    if (associations.length === 0) break;

    for (const a of associations) {
      map.set(a.TransactorPublicKeyBase58Check, a.AssociationID);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return map;
}

/**
 * Record that a sender has paid to DM a recipient.
 * Creates a chaton:chat-paid association (sender → recipient).
 */
export async function createPaidAssociation(
  senderPublicKey: string,
  recipientPublicKey: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: senderPublicKey,
        TargetUserPublicKeyBase58Check: recipientPublicKey,
        AssociationType: ASSOCIATION_TYPE_CHAT_PAID,
        AssociationValue: ASSOCIATION_VALUE_PAID,
      },
      { checkPermissions: false }
    )
  );
}

// ─── Group Join Requests ─────────────────────────────────────────────

/**
 * Create a join request association (requester → group owner).
 */
export async function createJoinRequest(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: myPublicKey,
        TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
        AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
        AssociationValue: groupKeyName,
      },
      { checkPermissions: false }
    )
  );
}

/**
 * Check whether the current user already has a pending join request for a group.
 */
export async function hasExistingJoinRequest(
  myPublicKey: string,
  groupOwnerPublicKey: string,
  groupKeyName: string
): Promise<boolean> {
  try {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: myPublicKey,
      TargetUserPublicKeyBase58Check: groupOwnerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      AssociationValue: groupKeyName,
      Limit: 1,
    });
    return (res.Associations?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch join request counts for all groups owned by the current user.
 * Returns a Map<conversationKey, count> for groups with pending requests.
 * Lightweight: no profile data fetched.
 */
export async function fetchJoinRequestCountsForOwner(
  ownerPublicKey: string
): Promise<Map<string, number>> {
  // First pass: collect all associations and requester keys per group
  const groupRequesters = new Map<string, Set<string>>(); // groupKeyName → requester keys
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      const groupKeyName = a.AssociationValue;
      if (!groupRequesters.has(groupKeyName)) {
        groupRequesters.set(groupKeyName, new Set());
      }
      groupRequesters.get(groupKeyName)!.add(a.TransactorPublicKeyBase58Check);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  if (groupRequesters.size === 0) return new Map();

  // Bulk-fetch all rejection associations so we can exclude rejected users
  const groupRejected = new Map<string, Set<string>>(); // groupKeyName → rejected keys
  let rejLastId = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REJECTED,
      Limit: 100,
      ...(rejLastId ? { LastSeenAssociationID: rejLastId } : {}),
    });
    const associations = res.Associations ?? [];
    for (const a of associations) {
      const gkn = a.AssociationValue;
      if (!groupRejected.has(gkn)) groupRejected.set(gkn, new Set());
      groupRejected.get(gkn)!.add(a.TargetUserPublicKeyBase58Check);
    }
    if (associations.length < 100) break;
    rejLastId = associations[associations.length - 1]!.AssociationID;
  }

  // Second pass: fetch members for each group and filter out already-members + rejected
  const counts = new Map<string, number>();
  await Promise.all(
    Array.from(groupRequesters.entries()).map(
      async ([groupKeyName, requesterKeys]) => {
        const conversationKey = ownerPublicKey + groupKeyName;
        const rejectedSet = groupRejected.get(groupKeyName) ?? new Set();
        try {
          const memberSet = new Set<string>([ownerPublicKey]);
          let cursor = "";
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const membersRes = await getPaginatedAccessGroupMembers({
              AccessGroupOwnerPublicKeyBase58Check: ownerPublicKey,
              AccessGroupKeyName: groupKeyName,
              MaxMembersToFetch: 100,
              ...(cursor
                ? { StartingAccessGroupMemberPublicKeyBase58Check: cursor }
                : {}),
            });
            const pageKeys = membersRes?.AccessGroupMembersBase58Check ?? [];
            for (const k of pageKeys) memberSet.add(k);
            if (pageKeys.length < 100) break;
            cursor = pageKeys[pageKeys.length - 1]!;
          }
          const pendingCount = Array.from(requesterKeys).filter(
            (k) => !memberSet.has(k) && !rejectedSet.has(k)
          ).length;
          if (pendingCount > 0) {
            counts.set(conversationKey, pendingCount);
          }
        } catch {
          // Fallback: still filter rejected even if member fetch fails
          const pendingCount = Array.from(requesterKeys).filter(
            (k) => !rejectedSet.has(k)
          ).length;
          if (pendingCount > 0) {
            counts.set(conversationKey, pendingCount);
          }
        }
      }
    )
  );

  return counts;
}

export interface JoinRequestEntry {
  requesterPublicKey: string;
  associationId: string;
  profile: import("deso-protocol").ProfileEntryResponse | null;
}

/**
 * Fetch all pending join requests for a group owned by `ownerPublicKey`.
 * Returns requester public keys, association IDs, and profiles.
 */
export async function fetchPendingJoinRequests(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<JoinRequestEntry[]> {
  const results: JoinRequestEntry[] = [];
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TargetUserPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      AssociationValue: groupKeyName,
      IncludeTransactorProfile: true,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    const profileMap = res.PublicKeyToProfileEntryResponse ?? {};
    for (const a of associations) {
      results.push({
        requesterPublicKey: a.TransactorPublicKeyBase58Check,
        associationId: a.AssociationID,
        profile:
          a.TransactorProfile ??
          profileMap[a.TransactorPublicKeyBase58Check] ??
          null,
      });
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return results;
}

/**
 * Fetch the set of public keys the owner has rejected for a given group.
 */
export async function fetchRejectedJoinRequestKeys(
  ownerPublicKey: string,
  groupKeyName: string
): Promise<Set<string>> {
  const rejected = new Set<string>();
  let lastId = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: ownerPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REJECTED,
      AssociationValue: groupKeyName,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      rejected.add(a.TargetUserPublicKeyBase58Check);
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  return rejected;
}

/**
 * Create an on-chain rejection association for a join request.
 * Transactor = group owner, Target = requester, Value = group key name.
 */
export async function createRejectAssociation(
  ownerPublicKey: string,
  requesterPublicKey: string,
  groupKeyName: string
): Promise<void> {
  await withAuth(() =>
    createUserAssociation(
      {
        TransactorPublicKeyBase58Check: ownerPublicKey,
        TargetUserPublicKeyBase58Check: requesterPublicKey,
        AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REJECTED,
        AssociationValue: groupKeyName,
      },
      { checkPermissions: false }
    )
  );
}

/**
 * Self-cleanup: delete the current user's own join request associations
 * for groups they are already a member of. The requester is the transactor,
 * so they CAN delete their own associations. Call on app startup or when
 * the user visits a join page and is already a member.
 */
export async function cleanupOwnJoinRequests(
  myPublicKey: string,
  myAccessGroups: import("deso-protocol").AccessGroupEntryResponse[]
): Promise<void> {
  // Fetch all join request associations created by this user
  let lastId = "";
  const toDelete: string[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getUserAssociations({
      TransactorPublicKeyBase58Check: myPublicKey,
      AssociationType: ASSOCIATION_TYPE_GROUP_JOIN_REQUEST,
      Limit: 100,
      ...(lastId ? { LastSeenAssociationID: lastId } : {}),
    });

    const associations = res.Associations ?? [];
    for (const a of associations) {
      // Check if the user is now a member of this group
      const isMember = myAccessGroups.some(
        (g) =>
          g.AccessGroupOwnerPublicKeyBase58Check ===
            a.TargetUserPublicKeyBase58Check &&
          g.AccessGroupKeyName === a.AssociationValue
      );
      if (isMember) {
        toDelete.push(a.AssociationID);
      }
    }

    if (associations.length < 100) break;
    lastId = associations[associations.length - 1]!.AssociationID;
  }

  // Delete resolved join requests (best-effort, fire-and-forget)
  if (toDelete.length > 0) {
    await Promise.allSettled(
      toDelete.map((id) =>
        deleteUserAssociation(
          {
            TransactorPublicKeyBase58Check: myPublicKey,
            AssociationID: id,
          },
          { checkPermissions: false }
        )
      )
    );
  }
}
