CREATE TABLE IF NOT EXISTS flexpedia_sync_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  last_sync_at TIMESTAMPTZ,
  last_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO flexpedia_sync_control (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;
