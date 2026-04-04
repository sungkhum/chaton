/**
 * D1 helper functions for push notification state.
 */

export interface DbUser {
  id: number;
  deso_public_key: string;
  push_enabled: number;
}

export interface DbSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DbThreadState {
  thread_key: string;
  last_seen_timestamp: string;
}

/** Create or update a user record. Returns the user ID. */
export async function upsertUser(
  db: D1Database,
  desoPublicKey: string
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO users (deso_public_key) VALUES (?)
       ON CONFLICT (deso_public_key) DO UPDATE SET push_enabled = 1`
    )
    .bind(desoPublicKey)
    .run();

  const row = await db
    .prepare("SELECT id FROM users WHERE deso_public_key = ?")
    .bind(desoPublicKey)
    .first<{ id: number }>();

  return row!.id;
}

/** Store a push subscription for a user.
 *  Deactivates stale subscriptions from the same push service (same origin)
 *  to prevent duplicate notifications when the browser rotates the endpoint. */
export async function upsertSubscription(
  db: D1Database,
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  // Extract the push service origin (e.g. "https://web.push.apple.com")
  // so we can deactivate old subscriptions from the same browser/service.
  // Use SUBSTR prefix match instead of LIKE to avoid issues with % or _ in URLs.
  const origin = new URL(endpoint).origin;

  await db.batch([
    // Deactivate stale subscriptions from the same push service for this user
    db
      .prepare(
        `UPDATE push_subscriptions SET is_active = 0
         WHERE user_id = ? AND endpoint != ? AND SUBSTR(endpoint, 1, ?) = ? AND is_active = 1`
      )
      .bind(userId, endpoint, origin.length, origin),
    // Upsert the current subscription
    db
      .prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, is_active)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = excluded.user_id,
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           is_active = 1`
      )
      .bind(userId, endpoint, p256dh, auth),
  ]);
}

/** Remove a push subscription. */
export async function removeSubscription(
  db: D1Database,
  desoPublicKey: string,
  endpoint: string
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM push_subscriptions
       WHERE endpoint = ?
         AND user_id = (SELECT id FROM users WHERE deso_public_key = ?)`
    )
    .bind(endpoint, desoPublicKey)
    .run();
}

/** Get all users that have push enabled and at least one active subscription. */
export async function getOptedInUsers(
  db: D1Database
): Promise<DbUser[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT u.id, u.deso_public_key, u.push_enabled
       FROM users u
       JOIN push_subscriptions ps ON ps.user_id = u.id
       WHERE u.push_enabled = 1 AND ps.is_active = 1`
    )
    .all<DbUser>();

  return results;
}

/** Get all active push subscriptions for a user. */
export async function getSubscriptionsForUser(
  db: D1Database,
  userId: number
): Promise<DbSubscription[]> {
  const { results } = await db
    .prepare(
      `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE user_id = ? AND is_active = 1`
    )
    .bind(userId)
    .all<DbSubscription>();

  return results;
}

/** Get all thread states for a user, keyed by thread_key. */
export async function getThreadStates(
  db: D1Database,
  userId: number
): Promise<Map<string, string>> {
  const { results } = await db
    .prepare(
      "SELECT thread_key, last_seen_timestamp FROM thread_state WHERE user_id = ?"
    )
    .bind(userId)
    .all<DbThreadState>();

  const map = new Map<string, string>();
  for (const row of results) {
    map.set(row.thread_key, row.last_seen_timestamp);
  }
  return map;
}

/** Insert or update the last-seen timestamp for a thread. */
export async function upsertThreadState(
  db: D1Database,
  userId: number,
  threadKey: string,
  threadType: string,
  timestamp: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO thread_state (user_id, thread_key, thread_type, last_seen_timestamp)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, thread_key) DO UPDATE SET
         last_seen_timestamp = excluded.last_seen_timestamp`
    )
    .bind(userId, threadKey, threadType, timestamp)
    .run();
}

/** Mark a subscription as inactive (expired/gone). */
export async function deactivateSubscription(
  db: D1Database,
  endpoint: string
): Promise<void> {
  await db
    .prepare("UPDATE push_subscriptions SET is_active = 0 WHERE endpoint = ?")
    .bind(endpoint)
    .run();
}

/** Increment failure count. Returns the new count. */
export async function incrementFailureCount(
  db: D1Database,
  endpoint: string
): Promise<number> {
  await db
    .prepare(
      "UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ?"
    )
    .bind(endpoint)
    .run();

  const row = await db
    .prepare("SELECT failure_count FROM push_subscriptions WHERE endpoint = ?")
    .bind(endpoint)
    .first<{ failure_count: number }>();

  return row?.failure_count ?? 0;
}

/** Update last_seen_at timestamp for a user on WebSocket disconnect. */
export async function updateLastSeen(
  db: D1Database,
  desoPublicKey: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE users SET last_seen_at = datetime('now') WHERE deso_public_key = ?"
    )
    .bind(desoPublicKey)
    .run();
}

/** Batch-fetch last_seen_at timestamps for multiple users. */
export async function getLastSeenBatch(
  db: D1Database,
  publicKeys: string[]
): Promise<Record<string, string>> {
  if (publicKeys.length === 0) return {};

  const placeholders = publicKeys.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT deso_public_key, last_seen_at FROM users
       WHERE deso_public_key IN (${placeholders}) AND last_seen_at IS NOT NULL`
    )
    .bind(...publicKeys)
    .all<{ deso_public_key: string; last_seen_at: string }>();

  const map: Record<string, string> = {};
  for (const row of results) {
    map[row.deso_public_key] = row.last_seen_at;
  }
  return map;
}

/** Reset failure count on successful delivery. */
export async function resetFailureCount(
  db: D1Database,
  endpoint: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE push_subscriptions SET failure_count = 0 WHERE endpoint = ?"
    )
    .bind(endpoint)
    .run();
}

// ---------------------------------------------------------------------------
// Push notification dedup (cross-path: DO real-time vs cron/queue)
// ---------------------------------------------------------------------------

/** Record that a push was sent so the other delivery path can skip it. */
export async function recordPushSent(
  db: D1Database,
  recipientPk: string,
  conversationKey: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notification_dedup (recipient_pk, conversation_key)
       VALUES (?, ?)
       ON CONFLICT (recipient_pk, conversation_key) DO UPDATE SET
         sent_at = datetime('now')`
    )
    .bind(recipientPk, conversationKey)
    .run();
}

/** Check if a push was recently sent for this recipient + conversation. */
export async function wasRecentlyNotified(
  db: D1Database,
  recipientPk: string,
  conversationKey: string,
  withinSeconds: number = 90
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM notification_dedup
       WHERE recipient_pk = ? AND conversation_key = ?
         AND sent_at > datetime('now', ?)`
    )
    .bind(recipientPk, conversationKey, `-${withinSeconds} seconds`)
    .first();
  return !!row;
}

/** Clean up old dedup records (called from cron). */
export async function cleanupNotificationDedup(
  db: D1Database
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM notification_dedup WHERE sent_at < datetime('now', '-5 minutes')"
    )
    .run();
}

// ---------------------------------------------------------------------------
// Read cursor sync (cross-device)
// ---------------------------------------------------------------------------

/** Fetch all read cursors for a user. Returns { conversationKey: timestampNanos }. */
export async function getReadCursors(
  db: D1Database,
  publicKey: string
): Promise<Record<string, string>> {
  const { results } = await db
    .prepare(
      "SELECT conversation_key, timestamp_nanos FROM read_cursors WHERE user_public_key = ?"
    )
    .bind(publicKey)
    .all<{ conversation_key: string; timestamp_nanos: string }>();

  const map: Record<string, string> = {};
  for (const row of results) {
    map[row.conversation_key] = row.timestamp_nanos;
  }
  return map;
}

/** Batch upsert read cursors, keeping the newer timestamp per conversation. */
export async function upsertReadCursors(
  db: D1Database,
  publicKey: string,
  cursors: Array<{ conversationKey: string; timestampNanos: string }>
): Promise<void> {
  if (cursors.length === 0) return;

  // D1 batch limit is ~100 statements; chunk to be safe
  const CHUNK_SIZE = 50;
  for (let i = 0; i < cursors.length; i += CHUNK_SIZE) {
    const chunk = cursors.slice(i, i + CHUNK_SIZE);
    const stmts = chunk.map(({ conversationKey, timestampNanos }) =>
      db
        .prepare(
          `INSERT INTO read_cursors (user_public_key, conversation_key, timestamp_nanos)
           VALUES (?, ?, ?)
           ON CONFLICT (user_public_key, conversation_key) DO UPDATE SET
             timestamp_nanos = CASE
               WHEN CAST(excluded.timestamp_nanos AS INTEGER) > CAST(read_cursors.timestamp_nanos AS INTEGER)
               THEN excluded.timestamp_nanos
               ELSE read_cursors.timestamp_nanos
             END,
             updated_at = datetime('now')`
        )
        .bind(publicKey, conversationKey, timestampNanos)
    );
    await db.batch(stmts);
  }
}
