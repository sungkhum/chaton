-- Cross-device read cursor sync.
-- Stores per-user, per-conversation last-read timestamps so any device can
-- hydrate its local state on connect.

CREATE TABLE IF NOT EXISTS read_cursors (
  user_public_key TEXT NOT NULL,
  conversation_key TEXT NOT NULL,
  timestamp_nanos TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_public_key, conversation_key)
);

CREATE INDEX IF NOT EXISTS idx_read_cursors_user
  ON read_cursors(user_public_key);
