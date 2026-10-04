CREATE TABLE IF NOT EXISTS app_user (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  preferred_site TEXT REFERENCES site(slug),
  rating TEXT NOT NULL DEFAULT 'new' CHECK (rating IN ('green', 'yellow', 'new')),
  cc TEXT,
  notes TEXT,
  fixed_course_days TEXT,
  recommend BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_fired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker(id),
  site_slug TEXT NOT NULL REFERENCES site(slug),
  date DATE NOT NULL,
  section TEXT,
  hours NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  is_extra BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_row
  ON shift (worker_id, date, site_slug, hours, is_extra, COALESCE(section, ''));
CREATE INDEX IF NOT EXISTS idx_shift_date ON shift (date);
CREATE INDEX IF NOT EXISTS idx_shift_worker ON shift (worker_id);
CREATE INDEX IF NOT EXISTS idx_shift_site ON shift (site_slug);

CREATE TABLE IF NOT EXISTS absence (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absence_worker ON absence (worker_id);
