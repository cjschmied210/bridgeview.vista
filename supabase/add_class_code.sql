-- Add the code column if it does not already exist
ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS code text UNIQUE;

-- Backfill any existing classrooms that do not have a code
UPDATE classrooms 
SET code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE code IS NULL;
