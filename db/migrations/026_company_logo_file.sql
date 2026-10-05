-- Company logos are uploaded files, stored beside the workday photos
-- (lib/photo-storage.ts); the row keeps only the file's key and type.
ALTER TABLE company
  ADD COLUMN IF NOT EXISTS logo_key TEXT UNIQUE
    CHECK (logo_key ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
  ADD COLUMN IF NOT EXISTS logo_type TEXT
    CHECK (logo_type IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD CONSTRAINT company_logo_key_has_type CHECK ((logo_key IS NULL) = (logo_type IS NULL));
