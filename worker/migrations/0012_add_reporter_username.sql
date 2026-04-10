-- Add reporter_username to tickets and feedback tables
ALTER TABLE tickets ADD COLUMN reporter_username TEXT;
ALTER TABLE feedback ADD COLUMN reporter_username TEXT;
