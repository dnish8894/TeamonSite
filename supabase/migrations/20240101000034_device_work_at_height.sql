-- Flag devices that require work-at-height equipment (ladder/scaffold) to service,
-- so engineers know to bring the right gear before going on site.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS work_at_height BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS work_at_height_notes TEXT;
