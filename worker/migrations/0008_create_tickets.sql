-- Bug reports with auto-captured error context
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component TEXT NOT NULL,
  route TEXT NOT NULL,
  app_version TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  platform TEXT NOT NULL,
  user_description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('first-time', 'sometimes', 'every-time')),
  additional_context TEXT,
  submitter_public_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  nonce TEXT NOT NULL,

  -- Internal fields (team tooling)
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaging', 'fixing', 'fixed', 'escalated', 'rejected', 'duplicate')),
  severity TEXT CHECK (severity IN ('trivial', 'easy', 'moderate', 'hard', 'critical')),
  notes TEXT,
  fix_branch TEXT,
  fix_pr_url TEXT,
  issue_url TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_error_code ON tickets(error_code);
CREATE INDEX idx_tickets_created ON tickets(created_at);

CREATE UNIQUE INDEX idx_tickets_dedup
  ON tickets(submitter_public_key, error_code, component);
