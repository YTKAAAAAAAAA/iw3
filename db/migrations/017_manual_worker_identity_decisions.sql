CREATE TABLE IF NOT EXISTS manual_worker_identity_decision (
  identity_key TEXT PRIMARY KEY CHECK (identity_key ~ '^[a-f0-9]{64}$'),
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
