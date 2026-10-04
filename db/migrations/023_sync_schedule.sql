-- When each source was last tried, successful or not. The hourly scheduler
-- reads it so a failing source is retried once an hour instead of on every
-- check.
ALTER TABLE warehouse_sync_control
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE flexpedia_sync_control
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- Vacancies without their own work address (Warehouse is staffed at its
-- sites) are routed to their first site's address. Addresses are compared
-- ignoring case and spacing, so an unchanged address never triggers a new
-- route just because Flexpedia sent it with different capitals or spaces.
CREATE OR REPLACE FUNCTION normalized_address(value TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(regexp_replace(btrim(value), '\s+', ' ', 'g')) $$;

CREATE OR REPLACE VIEW travel_recompute_queue AS
WITH vacancy_address AS (
  SELECT v.id, v.archived_at,
    COALESCE(v.worksite_address, (
      SELECT s.address FROM vacancy_site vs JOIN site s ON s.slug = vs.site_slug
      WHERE vs.vacancy_id = v.id ORDER BY s.name LIMIT 1
    )) AS address
  FROM vacancy v
)
SELECT
  w.id AS worker_id,
  v.id AS vacancy_id,
  w.home_address AS worker_address,
  v.address AS vacancy_address,
  t.id AS stale_row_id,
  CASE
    WHEN t.id IS NULL THEN 'missing'
    WHEN normalized_address(t.worker_address) IS DISTINCT FROM normalized_address(w.home_address) THEN 'worker_address_changed'
    WHEN normalized_address(t.vacancy_address) IS DISTINCT FROM normalized_address(v.address) THEN 'vacancy_address_changed'
  END AS reason
FROM worker w
CROSS JOIN vacancy_address v
LEFT JOIN travel_distances t
  ON t.worker_id = w.id AND t.vacancy_id = v.id AND t.valid_to IS NULL
WHERE w.is_active
  AND NOT w.is_fired
  AND v.archived_at IS NULL
  AND w.home_address IS NOT NULL
  AND v.address IS NOT NULL
  AND (
    t.id IS NULL
    OR normalized_address(t.worker_address) IS DISTINCT FROM normalized_address(w.home_address)
    OR normalized_address(t.vacancy_address) IS DISTINCT FROM normalized_address(v.address)
  );
