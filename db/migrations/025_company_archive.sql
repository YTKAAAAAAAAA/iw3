-- A company is archived, never deleted: its vacancies carry shifts, hours and
-- photos that payroll and reports still need. Archiving detaches every worker
-- and archives the company's open vacancies; the two id lists remember exactly
-- what it changed, so restoring the company puts back only that.
ALTER TABLE company
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_worker_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_vacancy_ids INTEGER[] NOT NULL DEFAULT '{}';
