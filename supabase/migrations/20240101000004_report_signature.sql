ALTER TABLE job_reports
  ADD COLUMN IF NOT EXISTS reported_by        TEXT,
  ADD COLUMN IF NOT EXISTS reported_date      TEXT,
  ADD COLUMN IF NOT EXISTS engineer_signature TEXT;
