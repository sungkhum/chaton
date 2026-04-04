-- Deduplication table for push notifications.
-- The real-time Durable Object path and the cron/queue backup path can both
-- fire for the same message. The DO records a row here after sending; the
-- queue consumer skips delivery if a recent entry exists.

CREATE TABLE IF NOT EXISTS notification_dedup (
  recipient_pk TEXT NOT NULL,
  conversation_key TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (recipient_pk, conversation_key)
);
