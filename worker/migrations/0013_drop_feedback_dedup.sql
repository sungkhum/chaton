-- Allow multiple feedback submissions per user per category
DROP INDEX IF EXISTS idx_feedback_dedup;
