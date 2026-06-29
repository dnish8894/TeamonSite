-- PM report: support multiple servicing engineers.
-- service_engineers: [{ id, name }] — engineers who carried out the visit.
-- (engineer_id / engineer_name / engineer_signature remain the sign-off / lead engineer.)
ALTER TABLE public.pm_reports
  ADD COLUMN IF NOT EXISTS service_engineers jsonb DEFAULT '[]'::jsonb NOT NULL;
