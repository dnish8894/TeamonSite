-- PM report: start date + sign-off fields (engineer & client) like the FSR.
ALTER TABLE public.pm_reports
  ADD COLUMN IF NOT EXISTS started_at         timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS engineer_name      text,
  ADD COLUMN IF NOT EXISTS engineer_date      date,
  ADD COLUMN IF NOT EXISTS engineer_signature text,
  ADD COLUMN IF NOT EXISTS client_name        text,
  ADD COLUMN IF NOT EXISTS client_date        date,
  ADD COLUMN IF NOT EXISTS client_signature   text;
