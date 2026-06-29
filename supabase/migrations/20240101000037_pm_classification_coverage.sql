-- Comprehensive vs Non-Comprehensive maintenance classification at the site level
-- (Comprehensive = parts covered/free; Non-Comprehensive = parts chargeable).
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pm_classification TEXT;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_pm_classification_check;
ALTER TABLE sites ADD CONSTRAINT sites_pm_classification_check
  CHECK (pm_classification IS NULL OR pm_classification IN ('comprehensive', 'non_comprehensive'));

-- Per-device contract coverage tag (is this specific device covered under the contract).
ALTER TABLE devices ADD COLUMN IF NOT EXISTS under_contract BOOLEAN NOT NULL DEFAULT FALSE;
