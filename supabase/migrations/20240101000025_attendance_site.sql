-- Attendance check-ins now record which site the engineer is checking in at.
-- site_id references an existing site; site_name holds a free-typed custom site
-- when the engineer is at a location not yet in the sites table.
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS site_name TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_site ON attendance_checkins(site_id);
