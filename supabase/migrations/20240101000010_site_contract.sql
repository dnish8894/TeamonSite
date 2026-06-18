-- Add DLP / Maintenance contract period to sites
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS contract_type  text CHECK (contract_type IN ('dlp','maintenance')),
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_end   date;
