-- Generic key-value store for worker metadata (cron offsets, settings, etc.)
CREATE TABLE IF NOT EXISTS kv_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
