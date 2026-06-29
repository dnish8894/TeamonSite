-- PM rework — a PM schedule "Generate" now produces a PM REPORT (not a ticket).
-- Each report snapshots the covered devices and lets the engineer record per-device
-- service status + notes, plus an overall summary and sign-off.
CREATE TABLE IF NOT EXISTS public.pm_reports (
  id           uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
  schedule_id  uuid NOT NULL REFERENCES public.pm_schedules(id) ON DELETE CASCADE,
  site_id      uuid REFERENCES public.sites(id)     ON DELETE SET NULL,
  system_id    uuid REFERENCES public.elv_systems(id) ON DELETE SET NULL,
  engineer_id  uuid REFERENCES public.engineers(id) ON DELETE SET NULL,
  visit_date   date DEFAULT CURRENT_DATE NOT NULL,
  summary      text,
  status       text DEFAULT 'draft' NOT NULL,          -- draft | completed
  -- devices: [{ device_id, name, tag_id, serviced(bool), status(pass|fault|not_done), notes }]
  devices      jsonb DEFAULT '[]'::jsonb NOT NULL,
  completed_at timestamp with time zone,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_reports_schedule ON public.pm_reports USING btree (schedule_id);

CREATE TRIGGER trg_pm_reports_updated_at BEFORE UPDATE ON public.pm_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.pm_reports IS 'PM visit reports generated from a pm_schedule; snapshots covered devices';
