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
    .prepare(`SELECT id FROM users WHERE deso_public_key = ?`)
    .bind(desoPublicKey)
    .first<{ id: number }>();

  return row!.id;
}

/** Store a push subscription for a user. */
export async function upsertSubscription(
  db: D1Database,
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         is_active = 1`
    )
    .bind(userId, endpoint, p256dh, auth)
    .run();
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
      `SELECT thread_key, last_seen_timestamp FROM thread_state WHERE user_id = ?`
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
    .prepare(`UPDATE push_subscriptions SET is_active = 0 WHERE endpoint = ?`)
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
      `UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ?`
    )
    .bind(endpoint)
    .run();

  const row = await db
    .prepare(`SELECT failure_count FROM push_subscriptions WHERE endpoint = ?`)
    .bind(endpoint)
    .first<{ failure_count: number }>();

  return row?.failure_count ?? 0;
}

/** Reset failure count on successful delivery. */
export async function resetFailureCount(
  db: D1Database,
  endpoint: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE push_subscriptions SET failure_count = 0 WHERE endpoint = ?`
    )
    .bind(endpoint)
    .run();
}
