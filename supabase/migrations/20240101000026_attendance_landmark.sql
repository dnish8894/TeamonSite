-- Store a human-readable nearest landmark/address alongside the raw GPS coordinates
-- so the web attendance log can show a place name instead of just a coordinate pair.
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS check_in_landmark TEXT;
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS check_out_landmark TEXT;
