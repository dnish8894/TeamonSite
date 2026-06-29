-- Configurable PM report checklist items (per device).
-- Each item: { key, label }. Seeded with the original three.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS pm_check_items jsonb DEFAULT '[
    {"key":"cleaned","label":"Device Cleaned"},
    {"key":"power_ok","label":"Power Supply OK"},
    {"key":"functional","label":"Functioning Normally"}
  ]'::jsonb NOT NULL;
