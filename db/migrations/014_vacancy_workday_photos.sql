CREATE TABLE IF NOT EXISTS vacancy_workday_photo (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image BYTEA NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vacancy_workday_photo_date_idx
  ON vacancy_workday_photo (vacancy_id, work_date, created_at, id);
