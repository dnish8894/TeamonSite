ALTER TABLE job_reports
  ADD COLUMN IF NOT EXISTS client_date      TEXT,
  ADD COLUMN IF NOT EXISTS client_signature TEXT;
