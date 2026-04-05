-- Track when a subscription was last confirmed alive by the client.
-- Subscriptions not confirmed within 14 days are likely dead (especially on iOS
-- where subscriptions silently expire after ~1-2 weeks).
-- SQLite does not allow non-constant defaults on ALTER TABLE ADD COLUMN,
-- so default to NULL. The getSubscriptionsForUser query treats NULL as "unknown age"
-- and includes these subscriptions. They'll get a real timestamp on next client visit.
ALTER TABLE push_subscriptions ADD COLUMN last_confirmed DATETIME;
