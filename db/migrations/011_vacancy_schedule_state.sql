CREATE TABLE IF NOT EXISTS vacancy_schedule_state (
  vacancy_id INTEGER PRIMARY KEY REFERENCES vacancy(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  standing JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(standing) = 'array'),
  offers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(offers) = 'array'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES app_user(id) ON DELETE SET NULL
);

INSERT INTO vacancy_schedule_state (vacancy_id)
SELECT id FROM vacancy
ON CONFLICT (vacancy_id) DO NOTHING;
