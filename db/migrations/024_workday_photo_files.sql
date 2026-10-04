-- Workday photos move from BYTEA to files on disk (lib/photo-storage.ts).
-- The bytes of existing photos are moved by scripts/migrate.mjs right after
-- this migration; `image` stays nullable until every row has a file.
ALTER TABLE vacancy_workday_photo
  ADD COLUMN IF NOT EXISTS storage_key TEXT UNIQUE
    CHECK (storage_key ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');

ALTER TABLE vacancy_workday_photo
  ALTER COLUMN image DROP NOT NULL;

ALTER TABLE vacancy_workday_photo
  ADD CONSTRAINT vacancy_workday_photo_has_bytes
    CHECK (image IS NOT NULL OR storage_key IS NOT NULL) NOT VALID;
