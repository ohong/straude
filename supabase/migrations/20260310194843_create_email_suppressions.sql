CREATE TABLE IF NOT EXISTS email_suppressions (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'unsubscribe', 'soft_bounce')),
  source_email_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions (email);

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;;
