ALTER TABLE worker
  ADD COLUMN IF NOT EXISTS flexpedia_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS worker_flexpedia_id_unique
  ON worker (flexpedia_id)
  WHERE flexpedia_id IS NOT NULL;
