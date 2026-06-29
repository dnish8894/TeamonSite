-- 12b — Link specific devices to a PM schedule.
-- A schedule with no rows here is treated as "whole system / site-wide" (current behaviour).
CREATE TABLE IF NOT EXISTS public.pm_schedule_devices (
  schedule_id uuid NOT NULL REFERENCES public.pm_schedules(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES public.devices(id)      ON DELETE CASCADE,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (schedule_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_schedule_devices_device ON public.pm_schedule_devices USING btree (device_id);

COMMENT ON TABLE public.pm_schedule_devices IS '12b — devices covered by a PM schedule; empty = whole system';
