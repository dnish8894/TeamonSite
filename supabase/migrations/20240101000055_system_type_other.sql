-- Allow ELV systems beyond the fixed 5 — an "Other" type with a free-text label.
ALTER TYPE public.elv_system_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE public.elv_systems
  ADD COLUMN IF NOT EXISTS type_label text;
