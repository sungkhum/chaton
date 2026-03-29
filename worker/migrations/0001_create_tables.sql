-- Users opted into push notifications
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deso_public_key TEXT UNIQUE NOT NULL,
  push_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  failure_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(user_id, is_active);

-- Last-seen timestamp per thread per user (for cron poll dedup)
CREATE TABLE IF NOT EXISTS thread_state (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_key TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  last_seen_timestamp TEXT NOT NULL,
  PRIMARY KEY (user_id, thread_key)
);
