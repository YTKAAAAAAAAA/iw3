CREATE TABLE IF NOT EXISTS manual_hours (
  id BIGSERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, vacancy_id, date)
);
