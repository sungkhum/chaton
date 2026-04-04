import { createStore, get, set, del, keys, type UseStore } from "idb-keyval";
import type { AccessGroupEntryResponse } from "deso-protocol";
import type { AppUser } from "../store";
import type { ConversationMap } from "../utils/types";

const CACHE_VERSION = 1;
const LS_PREFIX = "chattra:cache";
const MAX_CACHED_CONVERSATIONS = 100;

let idbStore: UseStore;
try {
  idbStore = createStore("chattra-cache", "cache-store");
} catch {
  // IndexedDB unavailable (e.g. some private browsing modes)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lsKey(publicKey: string, dataType: string): string {
  return `${LS_PREFIX}:${publicKey}:${dataType}`;
}

function lsGet<T>(publicKey: string, dataType: string): T | null {
  try {
    const raw = localStorage.getItem(lsKey(publicKey, dataType));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(publicKey: string, dataType: string, value: unknown): void {
  try {
    localStorage.setItem(lsKey(publicKey, dataType), JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function lsDel(publicKey: string, dataType: string): void {
  try {
    localStorage.removeItem(lsKey(publicKey, dataType));
  } catch {
    // ignore
  }
}

async function idbGet<T>(key: string): Promise<T | null> {
  if (!idbStore) return null;
  try {
    const val = await get<T>(key, idbStore);
    return val ?? null;
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  if (!idbStore) return;
  try {
    await set(key, value, idbStore);
  } catch {
    // IndexedDB write failed — silently ignore
  }
}

function stripOptimisticMessages(convos: ConversationMap): ConversationMap {
  const clean: ConversationMap = {};
  for (const [key, convo] of Object.entries(convos)) {
    clean[key] = {
      ...convo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: convo.messages.filter((m: any) => !m._localId),
    };
  }
  return clean;
}

function trimConversations(convos: ConversationMap): ConversationMap {
  const entries = Object.entries(convos);
  if (entries.length <= MAX_CACHED_CONVERSATIONS) return convos;

  entries.sort(([, a], [, b]) => {
    const aLast =
      a.messages[a.messages.length - 1]?.MessageInfo?.TimestampNanos ?? 0;
    const bLast =
      b.messages[b.messages.length - 1]?.MessageInfo?.TimestampNanos ?? 0;
    return Number(BigInt(bLast) - BigInt(aLast));
  });

  const trimmed: ConversationMap = {};
  for (const [key, convo] of entries.slice(0, MAX_CACHED_CONVERSATIONS)) {
    trimmed[key] = convo;
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Cache version check — clear all on mismatch
// ---------------------------------------------------------------------------

export function checkCacheVersion(): void {
  try {
    const stored = localStorage.getItem(`${LS_PREFIX}:version`);
    if (stored !== String(CACHE_VERSION)) {
      clearAllCaches();
      localStorage.setItem(`${LS_PREFIX}:version`, String(CACHE_VERSION));
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// User profile + access groups (localStorage — sync)
// ---------------------------------------------------------------------------

interface CachedProfile {
  appUser: AppUser;
  allAccessGroups: AccessGroupEntryResponse[];
}

export function cacheUserProfile(
  publicKey: string,
  appUser: AppUser,
  allAccessGroups: AccessGroupEntryResponse[]
): void {
  lsSet(publicKey, "profile", { appUser, allAccessGroups });
}

export function getCachedUserProfile(publicKey: string): CachedProfile | null {
  return lsGet<CachedProfile>(publicKey, "profile");
}

// ---------------------------------------------------------------------------
// Classification data (localStorage — sync)
// ---------------------------------------------------------------------------

interface CachedClassification {
  mutualFollows: string[];
  approvedUsers: string[];
  blockedUsers: string[];
  approvedAssociationIds: [string, string][];
  blockedAssociationIds: [string, string][];
  archivedGroups: string[];
  archivedGroupAssociationIds: [string, string][];
  archivedChats: string[];
  archivedChatAssociationIds: [string, string][];
  dismissedUsers: string[];
  dismissedAssociationIds: [string, string][];
}

export interface ClassificationData {
  mutualFollows: Set<string>;
  approvedUsers: Set<string>;
  blockedUsers: Set<string>;
  approvedAssociationIds: Map<string, string>;
  blockedAssociationIds: Map<string, string>;
  archivedGroups: Set<string>;
  archivedGroupAssociationIds: Map<string, string>;
  archivedChats: Set<string>;
  archivedChatAssociationIds: Map<string, string>;
  dismissedUsers: Set<string>;
  dismissedAssociationIds: Map<string, string>;
}

export function cacheClassificationData(
  publicKey: string,
  data: ClassificationData
): void {
  const serialized: CachedClassification = {
    mutualFollows: Array.from(data.mutualFollows),
    approvedUsers: Array.from(data.approvedUsers),
    blockedUsers: Array.from(data.blockedUsers),
    approvedAssociationIds: Array.from(data.approvedAssociationIds.entries()),
    blockedAssociationIds: Array.from(data.blockedAssociationIds.entries()),
    archivedGroups: Array.from(data.archivedGroups),
    archivedGroupAssociationIds: Array.from(
      data.archivedGroupAssociationIds.entries()
    ),
    archivedChats: Array.from(data.archivedChats),
    archivedChatAssociationIds: Array.from(
      data.archivedChatAssociationIds.entries()
    ),
    dismissedUsers: Array.from(data.dismissedUsers),
    dismissedAssociationIds: Array.from(data.dismissedAssociationIds.entries()),
  };
  lsSet(publicKey, "classification", serialized);
}

export function getCachedClassificationData(
  publicKey: string
): ClassificationData | null {
  const raw = lsGet<CachedClassification>(publicKey, "classification");
  if (!raw) return null;
  return {
    mutualFollows: new Set(raw.mutualFollows),
    approvedUsers: new Set(raw.approvedUsers),
    blockedUsers: new Set(raw.blockedUsers),
    approvedAssociationIds: new Map(raw.approvedAssociationIds),
    blockedAssociationIds: new Map(raw.blockedAssociationIds),
    archivedGroups: new Set(raw.archivedGroups || []),
    archivedGroupAssociationIds: new Map(raw.archivedGroupAssociationIds || []),
    archivedChats: new Set(raw.archivedChats || []),
    archivedChatAssociationIds: new Map(raw.archivedChatAssociationIds || []),
    dismissedUsers: new Set(raw.dismissedUsers || []),
    dismissedAssociationIds: new Map(raw.dismissedAssociationIds || []),
  };
}

// ---------------------------------------------------------------------------
// Privacy mode (localStorage — sync)
// ---------------------------------------------------------------------------

export function cachePrivacyMode(publicKey: string, mode: string): void {
  lsSet(publicKey, "privacyMode", mode);
}

export function getCachedPrivacyMode(publicKey: string): string | null {
  return lsGet<string>(publicKey, "privacyMode");
}

// ---------------------------------------------------------------------------
// Tip currency preference (localStorage — sync)
// ---------------------------------------------------------------------------

export function cacheTipCurrency(publicKey: string, currency: string): void {
  lsSet(publicKey, "tipCurrency", currency);
}

export function getCachedTipCurrency(publicKey: string): string | null {
  return lsGet<string>(publicKey, "tipCurrency");
}

// ---------------------------------------------------------------------------
// Username map (localStorage — sync)
// ---------------------------------------------------------------------------

export function cacheUsernameMap(
  publicKey: string,
  map: Record<string, string>
): void {
  lsSet(publicKey, "usernames", map);
}

export function getCachedUsernameMap(
  publicKey: string
): Record<string, string> | null {
  return lsGet<Record<string, string>>(publicKey, "usernames");
}

// ---------------------------------------------------------------------------
// Last selected conversation (localStorage — sync)
// ---------------------------------------------------------------------------

export function cacheLastConversationKey(publicKey: string, key: string): void {
  lsSet(publicKey, "lastConversation", key);
}

export function getCachedLastConversationKey(publicKey: string): string | null {
  return lsGet<string>(publicKey, "lastConversation");
}

// ---------------------------------------------------------------------------
// Conversations (IndexedDB — async)
// ---------------------------------------------------------------------------

export async function cacheConversations(
  publicKey: string,
  conversations: ConversationMap
): Promise<void> {
  const cleaned = stripOptimisticMessages(conversations);
  const trimmed = trimConversations(cleaned);
  await idbSet(`${publicKey}:conversations`, trimmed);
}

export async function getCachedConversations(
  publicKey: string
): Promise<ConversationMap | null> {
  return idbGet<ConversationMap>(`${publicKey}:conversations`);
}

// ---------------------------------------------------------------------------
// Profile map (IndexedDB — async)
// ---------------------------------------------------------------------------

export async function cacheProfileMap(
  publicKey: string,
  profileMap: Record<string, unknown>
): Promise<void> {
  await idbSet(`${publicKey}:profiles`, profileMap);
}

export async function getCachedProfileMap(
  publicKey: string
): Promise<Record<string, unknown> | null> {
  return idbGet<Record<string, unknown>>(`${publicKey}:profiles`);
}

// ---------------------------------------------------------------------------
// Per-conversation messages (IndexedDB — async)
// ---------------------------------------------------------------------------

export async function cacheConversationMessages(
  publicKey: string,
  conversationKey: string,
  messages: unknown[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned = messages.filter((m: any) => !m._localId);
  await idbSet(`${publicKey}:messages:${conversationKey}`, cleaned);
}

export async function getCachedConversationMessages(
  publicKey: string,
  conversationKey: string
): Promise<unknown[] | null> {
  return idbGet<unknown[]>(`${publicKey}:messages:${conversationKey}`);
}

// ---------------------------------------------------------------------------
// Muted conversations (localStorage + IndexedDB for service worker access)
// ---------------------------------------------------------------------------

export function cacheMutedConversations(
  publicKey: string,
  muted: Set<string>
): void {
  const arr = Array.from(muted);
  lsSet(publicKey, "mutedConversations", arr);
  // Also persist to IndexedDB so the service worker can read it.
  // Use a user-scoped key so multi-account doesn't collide, plus a
  // global "active" key the service worker can read without knowing
  // which user is logged in.
  idbSet(`${publicKey}:mutedConversations`, arr);
  idbSet("mutedConversations:active", arr);
}

export function getCachedMutedConversations(publicKey: string): Set<string> {
  const arr = lsGet<string[]>(publicKey, "mutedConversations");
  return new Set(arr || []);
}

// ---------------------------------------------------------------------------
// Logged-in account profiles (localStorage — sync)
// ---------------------------------------------------------------------------

export function cacheAccountProfiles(profiles: Record<string, unknown>): void {
  try {
    localStorage.setItem(
      `${LS_PREFIX}:accountProfiles`,
      JSON.stringify(profiles)
    );
  } catch {
    // ignore
  }
}

export function getCachedAccountProfiles(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}:accountProfiles`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Unread conversations (IndexedDB — shared with service worker)
// ---------------------------------------------------------------------------

export function syncUnreadConversations(keys: string[]): void {
  idbSet("unreadConversations:active", keys);
}

/**
 * Clear the global "active" IDB keys that the service worker reads.
 * Called on account switch so stale mute/unread data from the previous
 * account doesn't affect notifications for the new account.
 */
export function clearActiveServiceWorkerKeys(): void {
  idbSet("mutedConversations:active", []);
  idbSet("unreadConversations:active", []);
}

export function addUnreadConversation(key: string): void {
  // Read-modify-write; fire-and-forget
  if (!idbStore) return;
  get<string[]>("unreadConversations:active", idbStore)
    .then((arr) => {
      const current = arr || [];
      if (!current.includes(key)) {
        current.push(key);
        return idbSet("unreadConversations:active", current);
      }
    })
    .catch(() => {});
}

export function removeUnreadConversation(key: string): void {
  if (!idbStore) return;
  get<string[]>("unreadConversations:active", idbStore)
    .then((arr) => {
      if (!arr) return;
      const filtered = arr.filter((k) => k !== key);
      return idbSet("unreadConversations:active", filtered);
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Last-read timestamps (localStorage — sync)
// ---------------------------------------------------------------------------

export function cacheLastReadTimestamp(
  publicKey: string,
  conversationKey: string,
  timestampNanos: number
): void {
  const existing = lsGet<Record<string, number>>(publicKey, "lastRead") || {};
  existing[conversationKey] = timestampNanos;
  lsSet(publicKey, "lastRead", existing);
}

export function getCachedLastReadTimestamps(
  publicKey: string
): Record<string, number> {
  return lsGet<Record<string, number>>(publicKey, "lastRead") || {};
}

/**
 * Merge remote read cursors (from server) with local ones (localStorage).
 * Takes the max timestamp per conversation. Returns the merged map and any
 * cursors where local is newer (to send back to the server).
 */
export function mergeReadCursors(
  publicKey: string,
  remoteCursors: Record<string, string>
): { merged: Record<string, number>; localNewer: Record<string, string> } {
  const local = getCachedLastReadTimestamps(publicKey);
  const localNewer: Record<string, string> = {};
  const merged = { ...local };

  for (const [key, remoteTs] of Object.entries(remoteCursors)) {
    const remoteNum = Number(remoteTs);
    const localNum = local[key] || 0;
    if (remoteNum > localNum) {
      merged[key] = remoteNum;
    } else if (localNum > remoteNum) {
      localNewer[key] = String(localNum);
    }
  }

  // Also include local-only cursors (not present on server)
  for (const [key, localNum] of Object.entries(local)) {
    if (!(key in remoteCursors)) {
      localNewer[key] = String(localNum);
    }
  }

  lsSet(publicKey, "lastRead", merged);
  return { merged, localNewer };
}

/** Convert local read cursors to string map for sending over WebSocket. */
export function getReadCursorsForSync(
  publicKey: string
): Record<string, string> {
  const cursors = getCachedLastReadTimestamps(publicKey);
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(cursors)) {
    result[key] = String(val);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

export async function clearCacheForUser(publicKey: string): Promise<void> {
  // localStorage
  const lsTypes = [
    "profile",
    "classification",
    "usernames",
    "lastConversation",
    "mutedConversations",
    "lastRead",
    "privacyMode",
  ];
  for (const t of lsTypes) {
    lsDel(publicKey, t);
  }
  // Draft messages use a separate prefix
  try {
    localStorage.removeItem(`chaton:drafts:${publicKey}`);
  } catch {
    /* ignore */
  }

  // IndexedDB — remove all keys starting with publicKey + global active mute key
  if (!idbStore) return;
  try {
    const allKeys = await keys(idbStore);
    const userKeys = allKeys.filter(
      (k) => typeof k === "string" && k.startsWith(`${publicKey}:`)
    );
    for (const k of userKeys) {
      await del(k as string, idbStore);
    }
    await del("mutedConversations:active", idbStore);
    await del("unreadConversations:active", idbStore);
  } catch {
    // ignore
  }
}

/**
 * Persist the user's public key to IndexedDB so the service worker can
 * identify the user during pushsubscriptionchange events (when no client
 * window may be open to provide a JWT).
 */
/**
 * Read and clear the pending notification conversation key written by the
 * service worker's notificationclick handler.  Returns null if none is set.
 */
export async function consumePendingNotificationConversation(): Promise<
  string | null
> {
  if (!idbStore) return null;
  try {
    const key = await get<string>("pendingNotificationConversation", idbStore);
    if (key) {
      await del("pendingNotificationConversation", idbStore);
      return key;
    }
  } catch {
    // IndexedDB unavailable
  }
  return null;
}

export function cachePushPublicKey(publicKey: string): void {
  if (!idbStore) return;
  set("push:publicKey", publicKey, idbStore).catch(() => {});
}

export async function clearAllCaches(): Promise<void> {
  // localStorage — remove all chattra:cache keys
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }

  // IndexedDB — remove all keys
  if (!idbStore) return;
  try {
    const allKeys = await keys(idbStore);
    for (const k of allKeys) {
      await del(k as string, idbStore);
    }
  } catch {
    // ignore
  }
}
