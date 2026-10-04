ALTER TABLE worker
  ADD COLUMN IF NOT EXISTS flexpedia_initials TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_first_name TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_insertion TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_last_name TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_gender TEXT
    CHECK (flexpedia_gender IS NULL OR flexpedia_gender IN ('m', 'f')),
  ADD COLUMN IF NOT EXISTS flexpedia_birth_date DATE,
  ADD COLUMN IF NOT EXISTS flexpedia_street TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_street_number TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_street_number_addition TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_post_code TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_city TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_phone TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_phone_country TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_mobile TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_email TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_residence_country TEXT,
  ADD COLUMN IF NOT EXISTS flexpedia_nationality TEXT;
