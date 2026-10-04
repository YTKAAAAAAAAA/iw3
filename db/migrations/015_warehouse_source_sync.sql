ALTER TABLE worker
  ADD COLUMN IF NOT EXISTS supabase_worker_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS worker_supabase_worker_id_unique
  ON worker (supabase_worker_id)
  WHERE supabase_worker_id IS NOT NULL;

ALTER TABLE shift
  ADD COLUMN IF NOT EXISTS supabase_schedule_id BIGINT,
  ADD COLUMN IF NOT EXISTS supabase_sync_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS shift_supabase_schedule_id_unique
  ON shift (supabase_schedule_id)
  WHERE supabase_schedule_id IS NOT NULL;

ALTER TABLE absence
  ADD COLUMN IF NOT EXISTS supabase_vacation_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS absence_supabase_vacation_id_unique
  ON absence (supabase_vacation_id)
  WHERE supabase_vacation_id IS NOT NULL;

INSERT INTO site (slug, name, company, address)
VALUES
  ('slego', 'Warehouse — Slego', 'Amsterdam Warehouse Company', 'Slego 1A, 1046 BM Amsterdam'),
  ('conakry', 'Warehouse — Conakryweg', 'Amsterdam Warehouse Company', 'Conakryweg 7, 1046 BM Amsterdam')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO company (name)
VALUES ('Amsterdam Warehouse Company')
ON CONFLICT (name) DO NOTHING;

UPDATE site s
SET company_id = c.id
FROM company c
WHERE s.slug IN ('slego', 'conakry')
  AND s.company_id IS NULL
  AND c.name = s.company;

INSERT INTO vacancy_site (vacancy_id, site_slug)
SELECT v.id, s.slug
FROM vacancy v
CROSS JOIN site s
WHERE v.slug = 'warehouse'
  AND s.slug IN ('slego', 'conakry')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS warehouse_sync_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  supabase_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO warehouse_sync_control (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;
