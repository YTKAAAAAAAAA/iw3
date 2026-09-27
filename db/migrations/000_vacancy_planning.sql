CREATE TABLE IF NOT EXISTS company (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO company (name)
SELECT DISTINCT btrim(company)
FROM site
WHERE NULLIF(btrim(company), '') IS NOT NULL
ON CONFLICT (name) DO NOTHING;

INSERT INTO company (name)
VALUES ('Warehouse')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE site
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES company(id);

ALTER TABLE worker
  ADD COLUMN IF NOT EXISTS home_address TEXT;

UPDATE site s
SET company_id = c.id
FROM company c
WHERE s.company_id IS NULL
  AND c.name = btrim(s.company);

CREATE TABLE IF NOT EXISTS vacancy (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES company(id),
  description TEXT NOT NULL DEFAULT '',
  worksite_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  start_date DATE,
  end_date DATE,
  schedule_pattern JSONB,
  track_hours_manually BOOLEAN NOT NULL DEFAULT FALSE,
  car_only BOOLEAN NOT NULL DEFAULT FALSE,
  default_hours NUMERIC(5, 2) CHECK (default_hours IS NULL OR (default_hours >= 0 AND default_hours <= 24)),
  project_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

INSERT INTO vacancy (slug, title, company_id, track_hours_manually, car_only)
SELECT
  'warehouse',
  'Warehouse',
  COALESCE(
    (
      SELECT c.id
      FROM shift sh
      JOIN site s ON s.slug = sh.site_slug
      JOIN company c ON c.name = btrim(s.company)
      GROUP BY c.id
      ORDER BY count(*) DESC, c.id
      LIMIT 1
    ),
    (SELECT id FROM company WHERE name = 'Warehouse')
  ),
  TRUE,
  TRUE
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS vacancy_site (
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE CASCADE,
  site_slug TEXT NOT NULL REFERENCES site(slug) ON DELETE RESTRICT,
  PRIMARY KEY (vacancy_id, site_slug)
);

INSERT INTO vacancy_site (vacancy_id, site_slug)
SELECT v.id, sh.site_slug
FROM vacancy v
JOIN shift sh ON v.slug = 'warehouse'
ON CONFLICT DO NOTHING;

INSERT INTO vacancy_site (vacancy_id, site_slug)
SELECT v.id, s.slug
FROM vacancy v
JOIN site s ON v.slug = 'warehouse'
WHERE s.company_id = v.company_id
   OR lower(s.slug) IN ('slego', 'conakry')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS vacancy_requirement (
  id SERIAL PRIMARY KEY,
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('skill', 'language', 'document', 'transport', 'availability')),
  label TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vacancy_id, kind, label)
);

INSERT INTO vacancy_requirement (vacancy_id, kind, label, is_required)
SELECT v.id, r.kind, r.label, r.is_required
FROM vacancy v
CROSS JOIN (VALUES
  ('transport', 'Own car', TRUE),
  ('document', 'VOG on file', TRUE),
  ('skill', 'Warehouse experience', TRUE),
  ('language', 'Dutch or English', FALSE)
) AS r(kind, label, is_required)
WHERE v.slug = 'warehouse'
ON CONFLICT (vacancy_id, kind, label) DO NOTHING;

CREATE TABLE IF NOT EXISTS worker_course_day (
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL CHECK (weekday IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  PRIMARY KEY (worker_id, weekday)
);

INSERT INTO worker_course_day (worker_id, weekday)
SELECT DISTINCT
  w.id,
  CASE left(lower(btrim(day_name)), 3)
    WHEN 'mon' THEN 'mon'
    WHEN 'tue' THEN 'tue'
    WHEN 'wed' THEN 'wed'
    WHEN 'thu' THEN 'thu'
    WHEN 'fri' THEN 'fri'
    WHEN 'sat' THEN 'sat'
    WHEN 'sun' THEN 'sun'
  END
FROM worker w
CROSS JOIN LATERAL regexp_split_to_table(COALESCE(w.fixed_course_days, ''), ',') AS day_name
WHERE left(lower(btrim(day_name)), 3) IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS worker_company_access (
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_id, company_id)
);

CREATE TABLE IF NOT EXISTS worker_qualification (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('skill', 'language', 'document', 'transport', 'availability')),
  label TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  status TEXT NOT NULL CHECK (status IN ('verified', 'unverified', 'expired')),
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, kind, label)
);

ALTER TABLE shift
  ALTER COLUMN worker_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS vacancy_id INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_start TIME,
  ADD COLUMN IF NOT EXISTS scheduled_end TIME,
  ADD COLUMN IF NOT EXISTS actual_start TIME,
  ADD COLUMN IF NOT EXISTS actual_end TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER CHECK (break_minutes IS NULL OR break_minutes >= 0),
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT
    CHECK (confirmation_status IS NULL OR confirmation_status IN ('not_contacted', 'offered', 'accepted', 'declined', 'no_response', 'cancelled')),
  ADD COLUMN IF NOT EXISTS attendance_status TEXT
    CHECK (attendance_status IS NULL OR attendance_status IN ('not_started', 'on_the_way', 'present', 'late', 'left_early', 'no_show', 'worked')),
  ADD COLUMN IF NOT EXISTS covers_shift_id INTEGER REFERENCES shift(id) ON DELETE SET NULL;

UPDATE shift
SET vacancy_id = (SELECT id FROM vacancy WHERE slug = 'warehouse')
WHERE vacancy_id IS NULL;

ALTER TABLE shift
  ALTER COLUMN vacancy_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_vacancy_fk') THEN
    ALTER TABLE shift ADD CONSTRAINT shift_vacancy_fk
      FOREIGN KEY (vacancy_id) REFERENCES vacancy(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_vacancy_site_fk') THEN
    ALTER TABLE shift ADD CONSTRAINT shift_vacancy_site_fk
      FOREIGN KEY (vacancy_id, site_slug) REFERENCES vacancy_site(vacancy_id, site_slug) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS vacancy_demand (
  id SERIAL PRIMARY KEY,
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  site_slug TEXT REFERENCES site(slug) ON DELETE RESTRICT,
  section TEXT,
  headcount INTEGER NOT NULL CHECK (headcount >= 0),
  start_time TIME,
  end_time TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (vacancy_id, site_slug) REFERENCES vacancy_site(vacancy_id, site_slug) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS shift_offer (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift(id) ON DELETE RESTRICT,
  worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('offered', 'accepted', 'declined', 'no_response', 'cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  note TEXT,
  CHECK (responded_at IS NULL OR responded_at >= offered_at)
);

CREATE INDEX IF NOT EXISTS idx_shift_offer_shift ON shift_offer (shift_id, offered_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_offer_worker ON shift_offer (worker_id, offered_at DESC);

CREATE TABLE IF NOT EXISTS vacancy_change (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id INTEGER NOT NULL REFERENCES vacancy(id) ON DELETE RESTRICT,
  actor_user_id INTEGER REFERENCES app_user(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_vacancy_date ON shift (vacancy_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_unassigned ON shift (date, vacancy_id) WHERE worker_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vacancy_demand_date ON vacancy_demand (vacancy_id, date);
CREATE INDEX IF NOT EXISTS idx_absence_dates ON absence (start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vacancy_demand_slot
  ON vacancy_demand (vacancy_id, date, COALESCE(site_slug, ''), COALESCE(section, ''));
CREATE UNIQUE INDEX IF NOT EXISTS app_user_single_account ON app_user ((TRUE));

CREATE TABLE IF NOT EXISTS auth_login_attempt (
  key_hash TEXT PRIMARY KEY CHECK (length(key_hash) = 64),
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempt_updated
  ON auth_login_attempt (updated_at);
