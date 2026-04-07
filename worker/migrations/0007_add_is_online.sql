-- Track whether a user has an active WebSocket connection to the DO.
-- The cron skips online users since the DO handles their push notifications
-- in real-time, eliminating duplicate notifications from the cron/queue path.
ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0;
