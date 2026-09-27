CREATE TABLE IF NOT EXISTS auth_login_attempt (
  key_hash TEXT PRIMARY KEY CHECK (length(key_hash) = 64),
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempt_updated
  ON auth_login_attempt (updated_at);
