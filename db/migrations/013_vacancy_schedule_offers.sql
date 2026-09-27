ALTER TABLE vacancy_schedule_state
  ADD COLUMN IF NOT EXISTS offers JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(offers) = 'array');
