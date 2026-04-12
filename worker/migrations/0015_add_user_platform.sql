-- Add platform column to users for stats aggregation.
-- Populated by the client on push subscribe; NULL until then.
ALTER TABLE users ADD COLUMN platform TEXT;