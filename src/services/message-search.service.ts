import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
  getPaginatedDMThread,
  getPaginatedGroupChatThread,
} from "deso-protocol";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MESSAGES_ONE_REQUEST_LIMIT,
} from "../utils/constants";
import {
  MSG_DELETED,
  MSG_FILE_NAME,
  MSG_GIF_TITLE,
  MSG_TYPE,
} from "../utils/extra-data";
import { getChatNameFromConversation } from "../utils/helpers";
import { ConversationMap } from "../utils/types";
import {
  cacheConversationMessages,
  getCachedConversationMessages,
} from "./cache.service";
import { decryptAccessGroupMessagesWithRetry } from "./conversations.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageSearchResult {
  conversationKey: string;
  conversationName: string;
  chatType: ChatType;
  message: DecryptedMessageEntryResponse;
  matchIndex: number;
  timestamp: number;
}

export interface SearchProgress {
  phase: "cache" | "deep";
  completedConversations: number;
  totalConversations: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSearchableMessage(msg: DecryptedMessageEntryResponse): boolean {
  if (msg.error) return false;
  const extra = msg.MessageInfo?.ExtraData || {};
  if (extra[MSG_TYPE] === "reaction") return false;
  if (extra[MSG_DELETED] === "true") return false;
  return true;
}

function getSearchableText(msg: DecryptedMessageEntryResponse): string {
  const text = msg.DecryptedMessage || "";
  const extra = msg.MessageInfo?.ExtraData || {};
  const parts = [text];
  if (extra[MSG_FILE_NAME]) parts.push(extra[MSG_FILE_NAME]);
  if (extra[MSG_GIF_TITLE]) parts.push(extra[MSG_GIF_TITLE]);
  return parts.join(" ");
}

function matchMessage(
  msg: DecryptedMessageEntryResponse,
  queryLower: string
): number {
  if (!isSearchableMessage(msg)) return -1;
  const text = getSearchableText(msg);
  if (!text.trim()) return -1;
  return text.toLowerCase().indexOf(queryLower);
}

function buildResult(
  msg: DecryptedMessageEntryResponse,
  matchIndex: number,
  conversationKey: string,
  conversationName: string,
  chatType: ChatType
): MessageSearchResult {
  return {
    conversationKey,
    conversationName,
    chatType,
    message: msg,
    matchIndex,
    timestamp: Number(msg.MessageInfo.TimestampNanos),
  };
}

/** Deduplicate messages by TimestampNanosString, preferring earlier entries. */
function deduplicateMessages(
  msgs: DecryptedMessageEntryResponse[]
): DecryptedMessageEntryResponse[] {
  const seen = new Set<string>();
  const result: DecryptedMessageEntryResponse[] = [];
  for (const m of msgs) {
    const key = m.MessageInfo.TimestampNanosString;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(m);
    }
  }
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Phase 1: Search cached / in-memory messages
// ---------------------------------------------------------------------------

export async function searchCachedMessages(
  userPublicKey: string,
  query: string,
  conversations: ConversationMap,
  usernameMap: Record<string, string>,
  allAccessGroups?: AccessGroupEntryResponse[]
): Promise<{
  results: MessageSearchResult[];
  searchedTimestamps: Set<string>;
}> {
  const queryLower = query.toLowerCase();
  const results: MessageSearchResult[] = [];
  const searchedTimestamps = new Set<string>();

  for (const [key, convo] of Object.entries(conversations)) {
    const convoName =
      getChatNameFromConversation(convo, usernameMap, allAccessGroups) ?? "";

    // Merge in-memory messages with any extra messages from IndexedDB cache
    let allMessages = [...convo.messages];
    try {
      const cached = await getCachedConversationMessages(userPublicKey, key);
      if (cached && Array.isArray(cached)) {
        allMessages = allMessages.concat(
          cached as DecryptedMessageEntryResponse[]
        );
      }
    } catch {
      // IndexedDB unavailable — just use in-memory
    }

    const unique = deduplicateMessages(allMessages);

    for (const msg of unique) {
      searchedTimestamps.add(msg.MessageInfo.TimestampNanosString);
      const idx = matchMessage(msg, queryLower);
      if (idx >= 0) {
        results.push(buildResult(msg, idx, key, convoName, convo.ChatType));
      }
    }
  }

  // Sort newest first
  results.sort((a, b) => b.timestamp - a.timestamp);
  return { results: results.slice(0, 100), searchedTimestamps };
}

// ---------------------------------------------------------------------------
// Phase 2: Deep search — paginate backwards through one conversation
// ---------------------------------------------------------------------------

export async function deepSearchConversation(
  userPublicKey: string,
  conversationKey: string,
  conversation: {
    firstMessagePublicKey: string;
    messages: DecryptedMessageEntryResponse[];
    ChatType: ChatType;
  },
  query: string,
  usernameMap: Record<string, string>,
  allAccessGroups: AccessGroupEntryResponse[],
  alreadySearchedTimestamps: Set<string>,
  signal: AbortSignal,
  onResult: (result: MessageSearchResult) => void
): Promise<void> {
  const queryLower = query.toLowerCase();
  const convoName =
    getChatNameFromConversation(conversation, usernameMap, allAccessGroups) ??
    "";

  // Find the oldest timestamp we've already searched so we can start from there
  let oldestTimestamp: string | undefined;

  // Gather all known messages to find the oldest one
  const knownMessages = [...conversation.messages];
  try {
    const cached = await getCachedConversationMessages(
      userPublicKey,
      conversationKey
    );
    if (cached && Array.isArray(cached)) {
      knownMessages.push(...(cached as DecryptedMessageEntryResponse[]));
    }
  } catch {
    // ignore
  }

  if (knownMessages.length > 0) {
    // Find oldest message by TimestampNanos
    const sorted = [...knownMessages].sort(
      (a, b) =>
        Number(a.MessageInfo.TimestampNanos) -
        Number(b.MessageInfo.TimestampNanos)
    );
    oldestTimestamp = sorted[0].MessageInfo.TimestampNanosString;
  }

  // If no messages at all, nothing to paginate from
  if (!oldestTimestamp) return;

  // Paginate backwards
  let cursor: string = oldestTimestamp;
  let previousCursor: string | undefined;
  let accessGroups = allAccessGroups;
  const allFetchedMessages: DecryptedMessageEntryResponse[] = [];

  while (!signal.aborted) {
    try {
      let rawMessages: unknown;

      if (conversation.ChatType === ChatType.DM) {
        const resp = await getPaginatedDMThread({
          UserGroupOwnerPublicKeyBase58Check: userPublicKey,
          UserGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          PartyGroupOwnerPublicKeyBase58Check:
            conversation.firstMessagePublicKey,
          PartyGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
          StartTimeStampString: cursor,
          MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
        });
        rawMessages = resp.ThreadMessages;
      } else {
        // For group chats, we need the group owner and key name from the conversation key
        // The conversation key for groups is: ownerPublicKey + AccessGroupKeyName
        // We can get these from the messages
        const refMsg = conversation.messages[0];
        if (!refMsg) break;

        const resp = await getPaginatedGroupChatThread({
          UserPublicKeyBase58Check:
            refMsg.RecipientInfo.OwnerPublicKeyBase58Check,
          AccessGroupKeyName: refMsg.RecipientInfo.AccessGroupKeyName,
          StartTimeStampString: cursor,
          MaxMessagesToFetch: MESSAGES_ONE_REQUEST_LIMIT,
        });
        rawMessages = resp.GroupChatMessages;
      }

      const messages = (rawMessages || []) as DecryptedMessageEntryResponse[];
      if (messages.length === 0) break;

      // Decrypt
      const { decrypted, updatedAllAccessGroups } =
        await decryptAccessGroupMessagesWithRetry(
          userPublicKey,
          messages as unknown as import("deso-protocol").NewMessageEntryResponse[],
          accessGroups
        );
      accessGroups = updatedAllAccessGroups;

      // Search through decrypted messages
      for (const msg of decrypted) {
        const tsKey = msg.MessageInfo.TimestampNanosString;
        if (alreadySearchedTimestamps.has(tsKey)) continue;
        alreadySearchedTimestamps.add(tsKey);
        allFetchedMessages.push(msg);

        const idx = matchMessage(msg, queryLower);
        if (idx >= 0) {
          onResult(
            buildResult(
              msg,
              idx,
              conversationKey,
              convoName,
              conversation.ChatType
            )
          );
        }
      }

      // Stop if fewer than limit returned (end of history)
      if (messages.length < MESSAGES_ONE_REQUEST_LIMIT) break;

      // Move cursor to the oldest message in this batch
      const sortedBatch = [...decrypted].sort(
        (a, b) =>
          Number(a.MessageInfo.TimestampNanos) -
          Number(b.MessageInfo.TimestampNanos)
      );
      const newCursor = sortedBatch[0].MessageInfo.TimestampNanosString;

      // Guard against cursor not advancing (would cause infinite loop)
      if (newCursor === previousCursor || newCursor === cursor) break;
      previousCursor = cursor;
      cursor = newCursor;

      // Rate limit: wait between pages
      await delay(100);
    } catch (err) {
      console.warn(
        `[message-search] Error deep-searching conversation ${conversationKey}:`,
        err
      );
      break;
    }
  }

  // Cache newly fetched messages alongside existing ones for faster future searches
  if (allFetchedMessages.length > 0) {
    try {
      const existing =
        (await getCachedConversationMessages(userPublicKey, conversationKey)) ||
        [];
      const merged = deduplicateMessages([
        ...(existing as DecryptedMessageEntryResponse[]),
        ...conversation.messages,
        ...allFetchedMessages,
      ]);
      // Sort newest first for consistency
      merged.sort(
        (a, b) =>
          Number(b.MessageInfo.TimestampNanos) -
          Number(a.MessageInfo.TimestampNanos)
      );
      await cacheConversationMessages(userPublicKey, conversationKey, merged);
    } catch {
      // cache write failed — non-critical
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Orchestrate deep search across all conversations
// ---------------------------------------------------------------------------

export async function orchestrateDeepSearch(
  userPublicKey: string,
  query: string,
  conversations: ConversationMap,
  usernameMap: Record<string, string>,
  allAccessGroups: AccessGroupEntryResponse[],
  alreadyFoundTimestamps: Set<string>,
  signal: AbortSignal,
  onResult: (result: MessageSearchResult) => void,
  onProgress: (progress: SearchProgress) => void
): Promise<void> {
  // Sort conversations by most recent message first
  const entries = Object.entries(conversations).filter(
    ([, convo]) => convo.messages.length > 0
  );
  entries.sort(
    ([, a], [, b]) =>
      Number(b.messages[0]?.MessageInfo?.TimestampNanos ?? 0) -
      Number(a.messages[0]?.MessageInfo?.TimestampNanos ?? 0)
  );

  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    if (signal.aborted) break;

    const [key, convo] = entries[i];

    onProgress({
      phase: "deep",
      completedConversations: i,
      totalConversations: total,
    });

    try {
      await deepSearchConversation(
        userPublicKey,
        key,
        convo,
        query,
        usernameMap,
        allAccessGroups,
        alreadyFoundTimestamps,
        signal,
        onResult
      );
    } catch (err) {
      console.warn(`[message-search] Skipping conversation ${key}:`, err);
    }
  }

  if (!signal.aborted) {
    onProgress({
      phase: "deep",
      completedConversations: total,
      totalConversations: total,
    });
  }
}
