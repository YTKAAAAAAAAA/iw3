-- Model review, 2026-10-06. Only changes the data already satisfies.

-- Indexes for the queries that run on every save and every page:
-- access by company (archive, eligibility), the vacancy's change log
-- (candidate visibility is read from it), a person's shifts on a day (the
-- one-hour double-booking check), and vacancies by company.
CREATE INDEX IF NOT EXISTS worker_company_access_company_idx ON worker_company_access (company_id);
CREATE INDEX IF NOT EXISTS vacancy_change_vacancy_idx ON vacancy_change (vacancy_id, id);
CREATE INDEX IF NOT EXISTS shift_worker_date_idx ON shift (worker_id, date) WHERE worker_id IS NOT NULL;
DROP INDEX IF EXISTS idx_shift_worker; -- the index above starts with worker_id and serves the same lookups
CREATE INDEX IF NOT EXISTS vacancy_company_idx ON vacancy (company_id);

-- "Archived" is stored twice; the two may never disagree.
ALTER TABLE vacancy ADD CONSTRAINT vacancy_archive_consistent CHECK (is_active = (archived_at IS NULL));

-- Every photo has its bytes somewhere. NOT VALID while photos moved to files;
-- they all have, so the rule now holds for old rows too.
ALTER TABLE vacancy_workday_photo VALIDATE CONSTRAINT vacancy_workday_photo_has_bytes;

-- A site's company is company_id. The copied company name was written on
-- every save, read nowhere, and went stale on every company rename.
ALTER TABLE site DROP COLUMN IF EXISTS company;
ALTER TABLE site ALTER COLUMN company_id SET NOT NULL;
