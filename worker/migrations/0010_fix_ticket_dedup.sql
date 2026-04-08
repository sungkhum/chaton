-- Drop the old dedup index that merged ALL tickets from the same user+error+component.
-- This caused user-reported bugs (error_code="unknown", component="user-reported")
-- to overwrite each other since they all share the same key.
DROP INDEX IF EXISTS idx_tickets_dedup;

-- Recreate dedup only for auto-captured tickets (non-unknown error codes).
-- SQLite doesn't support partial indexes with WHERE on CREATE UNIQUE INDEX
-- in D1, so we skip the unique index entirely. Dedup is now handled in
-- application code: the worker only uses ON CONFLICT for non-unknown tickets.
