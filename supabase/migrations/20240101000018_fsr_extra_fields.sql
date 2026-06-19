ALTER TABLE job_reports ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;
