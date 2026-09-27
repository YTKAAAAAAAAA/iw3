ALTER TABLE shift
  ADD COLUMN IF NOT EXISTS schedule_position INTEGER NOT NULL DEFAULT 0
    CHECK (schedule_position >= 0);

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY vacancy_id, date, site_slug, COALESCE(section, '')
      ORDER BY id
    ) - 1 AS position
  FROM shift
)
UPDATE shift sh
SET schedule_position = ranked.position
FROM ranked
WHERE ranked.id = sh.id;

CREATE INDEX IF NOT EXISTS shift_schedule_order_idx
  ON shift (vacancy_id, date, site_slug, section, schedule_position, id);
