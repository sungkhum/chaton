/**
 * Cron handler: polls DeSo message threads for opted-in users,
 * detects new messages, and enqueues push notification jobs.
 */

import type { Env } from "./index";
import {
  getOptedInUsers,
  getThreadStates,
  upsertThreadState,
} from "./db";

// ── DeSo API types (only the fields we need) ──

interface DeSoThreadInfo {
  OwnerPublicKeyBase58Check: string;
  AccessGroupKeyName: string;
}

interface DeSoMessageInfo {
  TimestampNanos: number;
  TimestampNanosString: string;
  ExtraData?: Record<string, string>;
}

interface DeSoThread {
  ChatType: "DM" | "GroupChat";
  SenderInfo: DeSoThreadInfo;
  RecipientInfo: DeSoThreadInfo;
  MessageInfo: DeSoMessageInfo;
}

interface DeSoProfileEntry {
  Username?: string;
}

interface DeSoThreadsResponse {
  MessageThreads: DeSoThread[] | null;
  PublicKeyToProfileEntryResponse: Record<string, DeSoProfileEntry>;
}

// ── Queue message shape ──

export interface PushJob {
  userId: number;
  desoPublicKey: string;
  senderName: string;
  threadKey: string;
  threadType: string;
  /** Matches the app's conversation key format for tag dedup & navigation */
  conversationKey: string;
  /** Group chat name for notification title (undefined for DMs) */
  groupName?: string;
}

// ── Thread key derivation ──

/** Stable internal key for D1 thread_state storage. */
function deriveThreadKey(
  thread: DeSoThread
): { key: string; type: string } {
  if (thread.ChatType === "GroupChat") {
    const owner = thread.RecipientInfo.OwnerPublicKeyBase58Check;
    const group = thread.RecipientInfo.AccessGroupKeyName;
    return { key: `group:${owner}:${group}`, type: "group" };
  }

  // DM: sort the two participant keys for a stable key
  const pk1 = thread.SenderInfo.OwnerPublicKeyBase58Check;
  const pk2 = thread.RecipientInfo.OwnerPublicKeyBase58Check;
  const sorted = pk1 < pk2 ? [pk1, pk2] : [pk2, pk1];
  return { key: `dm:${sorted[0]}:${sorted[1]}`, type: "dm" };
}

/**
 * Derive the conversation key that matches the app's format so push notification
 * tags deduplicate with relay-sent notifications and notification clicks navigate
 * to the correct conversation.
 *
 * App format: otherPubKey + accessGroupKeyName
 *   DM:    otherPubKey + "default-key"
 *   Group: groupOwnerPubKey + groupKeyName
 */
function deriveConversationKey(
  thread: DeSoThread,
  myPublicKey: string
): string {
  if (thread.ChatType === "GroupChat") {
    return (
      thread.RecipientInfo.OwnerPublicKeyBase58Check +
      thread.RecipientInfo.AccessGroupKeyName
    );
  }

  // DM: "other" is whichever participant isn't me
  const iAmSender =
    thread.SenderInfo.OwnerPublicKeyBase58Check === myPublicKey;
  const otherInfo = iAmSender ? thread.RecipientInfo : thread.SenderInfo;
  return (
    otherInfo.OwnerPublicKeyBase58Check +
    (otherInfo.AccessGroupKeyName || "default-key")
  );
}

// ── Fetch threads from DeSo ──

async function fetchThreads(
  nodeUrl: string,
  publicKey: string
): Promise<DeSoThreadsResponse> {
  const res = await fetch(`${nodeUrl}/api/v0/get-all-user-message-threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UserPublicKeyBase58Check: publicKey }),
  });

  if (!res.ok) {
    throw new Error(`DeSo API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── Main cron handler ──

// Max users per cron run to stay within the 30s CPU time limit.
// Each user requires ~1 DeSo API call + D1 reads/writes.
const MAX_USERS_PER_RUN = 100;

export async function handleScheduled(env: Env): Promise<void> {
  const users = await getOptedInUsers(env.DB);
  if (users.length === 0) return;

  const nodeUrl = env.DESO_NODE_URL || "https://node.deso.org";
  const batch = users.slice(0, MAX_USERS_PER_RUN);

  if (users.length > MAX_USERS_PER_RUN) {
    console.warn(
      `${users.length} opted-in users exceeds batch limit of ${MAX_USERS_PER_RUN}; processing first batch only`
    );
  }

  // Process users sequentially to avoid overwhelming the DeSo node.
  for (const user of batch) {
    try {
      await pollUserThreads(env, nodeUrl, user.id, user.deso_public_key);
    } catch (err) {
      console.error(
        `Poll failed for ${user.deso_public_key}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function pollUserThreads(
  env: Env,
  nodeUrl: string,
  userId: number,
  publicKey: string
): Promise<void> {
  const data = await fetchThreads(nodeUrl, publicKey);
  const threads = data.MessageThreads || [];
  const profiles = data.PublicKeyToProfileEntryResponse || {};

  if (threads.length === 0) return;

  // Load stored thread states for this user
  const storedStates = await getThreadStates(env.DB, userId);
  const isFirstPoll = storedStates.size === 0;

  // Batch D1 writes and queue messages
  const stateUpdates: { key: string; type: string; timestamp: string }[] = [];
  const pushJobs: PushJob[] = [];

  for (const thread of threads) {
    const { key: threadKey, type: threadType } = deriveThreadKey(thread);
    const currentTimestamp = thread.MessageInfo.TimestampNanosString;
    const storedTimestamp = storedStates.get(threadKey);

    // Determine if this thread has new activity
    const isNewer =
      !storedTimestamp || BigInt(currentTimestamp) > BigInt(storedTimestamp);

    if (!isNewer) continue;

    // Always update stored timestamp
    stateUpdates.push({
      key: threadKey,
      type: threadType,
      timestamp: currentTimestamp,
    });

    // On first poll, seed timestamps without sending notifications
    if (isFirstPoll) continue;

    // Don't notify if the current user sent the latest message
    const senderKey = thread.SenderInfo.OwnerPublicKeyBase58Check;
    if (senderKey === publicKey) continue;

    // Skip non-content messages — reactions, tips, system events (join/leave),
    // edits, and deletions don't warrant push notifications
    const extraData = thread.MessageInfo.ExtraData || {};
    const msgType = extraData["msg:type"];
    if (msgType === "reaction" || msgType === "system" || msgType === "tip") continue;

    const senderName = profiles[senderKey]?.Username || "Someone";

    pushJobs.push({
      userId,
      desoPublicKey: publicKey,
      senderName,
      threadKey,
      threadType,
      conversationKey: deriveConversationKey(thread, publicKey),
      groupName: thread.ChatType === "GroupChat"
        ? thread.RecipientInfo.AccessGroupKeyName
        : undefined,
    });
  }

  // Enqueue push jobs BEFORE updating thread state so that a failed
  // queue write causes the cron to retry on the next run.  If we
  // updated thread_state first and sendBatch threw, the message would
  // look "already processed" and the notification would be permanently lost.
  if (pushJobs.length > 0) {
    await env.PUSH_QUEUE.sendBatch(
      pushJobs.map((job) => ({ body: job }))
    );
  }

  // Now that pushes are safely enqueued, persist the new timestamps
  for (const update of stateUpdates) {
    await upsertThreadState(
      env.DB,
      userId,
      update.key,
      update.type,
      update.timestamp
    );
  }
}
