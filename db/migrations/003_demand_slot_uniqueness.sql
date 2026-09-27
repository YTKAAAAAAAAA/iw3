DROP INDEX IF EXISTS idx_vacancy_demand_slot;

CREATE UNIQUE INDEX idx_vacancy_demand_slot
  ON vacancy_demand (vacancy_id, date, COALESCE(site_slug, ''), COALESCE(section, ''));
