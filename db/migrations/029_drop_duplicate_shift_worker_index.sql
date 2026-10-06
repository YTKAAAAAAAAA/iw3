-- 028 dropped idx_shift_worker (shift_worker_date_idx starts with worker_id
-- and serves the same lookups), but lib/db/schema.sql, which runs on every
-- start, created it again. schema.sql no longer does; this drops it for good.
DROP INDEX IF EXISTS idx_shift_worker;
