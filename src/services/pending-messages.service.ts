import { createStore, get, set, del, type UseStore } from "idb-keyval";

// ---------------------------------------------------------------------------
// Pending message: everything needed to retry encryptAndSendNewMessage
// ---------------------------------------------------------------------------

export interface PendingMessage {
  localId: string;
  conversationKey: string;
  messageText: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  recipientAccessGroupKeyName: string;
  extraData?: Record<string, string>;
  createdAt: number;
  /**
   * Number of automatic retries that have already been attempted on app boot.
   * 0 (or undefined) = never auto-retried. Once this reaches 1 we stop
   * auto-retrying and prompt the user to retry or discard.
   */
  retryCount?: number;
}

// ---------------------------------------------------------------------------
// IndexedDB store (separate from the cache store)
// ---------------------------------------------------------------------------

let store: UseStore | null = null;
try {
  store = createStore("chattra-pending-msgs", "pending-store");
} catch {
  // IndexedDB unavailable (e.g. some private browsing modes)
}

function storeKey(senderPublicKey: string): string {
  return `pending:${senderPublicKey}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get all pending messages for a user. */
export async function getPendingMessages(
  senderPublicKey: string
): Promise<PendingMessage[]> {
  if (!store) return [];
  try {
    const msgs = await get<PendingMessage[]>(storeKey(senderPublicKey), store);
    return msgs ?? [];
  } catch {
    return [];
  }
}

/** Save a message as pending before attempting to send. */
export async function addPendingMessage(msg: PendingMessage): Promise<void> {
  if (!store) return;
  try {
    const existing = await getPendingMessages(msg.senderPublicKey);
    existing.push(msg);
    await set(storeKey(msg.senderPublicKey), existing, store);
  } catch {
    // Best-effort — don't block send on persistence failure
  }
}

/** Remove a pending message after successful send. */
export async function removePendingMessage(
  senderPublicKey: string,
  localId: string
): Promise<void> {
  if (!store) return;
  try {
    const existing = await getPendingMessages(senderPublicKey);
    const filtered = existing.filter((m) => m.localId !== localId);
    if (filtered.length === 0) {
      await del(storeKey(senderPublicKey), store);
    } else {
      await set(storeKey(senderPublicKey), filtered, store);
    }
  } catch {
    // ignore
  }
}

/** Increment the retry counter on a pending message. */
export async function incrementPendingMessageRetryCount(
  senderPublicKey: string,
  localId: string
): Promise<void> {
  if (!store) return;
  try {
    const existing = await getPendingMessages(senderPublicKey);
    const updated = existing.map((m) =>
      m.localId === localId ? { ...m, retryCount: (m.retryCount ?? 0) + 1 } : m
    );
    await set(storeKey(senderPublicKey), updated, store);
  } catch {
    // ignore
  }
}

/** Reset the retry counter so the next app boot will auto-retry once again. */
export async function resetPendingMessageRetryCount(
  senderPublicKey: string,
  localId: string
): Promise<void> {
  if (!store) return;
  try {
    const existing = await getPendingMessages(senderPublicKey);
    const updated = existing.map((m) =>
      m.localId === localId ? { ...m, retryCount: 0 } : m
    );
    await set(storeKey(senderPublicKey), updated, store);
  } catch {
    // ignore
  }
}

/** Remove all pending messages for a user (e.g. on logout). */
export async function clearPendingMessages(
  senderPublicKey: string
): Promise<void> {
  if (!store) return;
  try {
    await del(storeKey(senderPublicKey), store);
  } catch {
    // ignore
  }
}
