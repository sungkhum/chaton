-- General user feedback (feature requests, improvements, etc.)
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('feature-request', 'improvement', 'question', 'praise', 'other')),
  description TEXT NOT NULL,
  submitter_public_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  nonce TEXT NOT NULL,

  -- Context (auto-captured, lighter than tickets)
  app_version TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  platform TEXT NOT NULL,
  route TEXT NOT NULL,

  -- Internal fields (team tooling)
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'planned', 'wont-do', 'done')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  issue_url TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_category ON feedback(category);
CREATE INDEX idx_feedback_created ON feedback(created_at);

-- One feedback per category per user (can update their existing feedback)
CREATE UNIQUE INDEX idx_feedback_dedup
  ON feedback(submitter_public_key, category);
