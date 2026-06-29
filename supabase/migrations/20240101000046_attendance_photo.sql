-- Photo capture on attendance check-in / check-out, with an org-level toggle so HR
-- can switch it off when not needed.
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS check_in_photo TEXT;
ALTER TABLE attendance_checkins ADD COLUMN IF NOT EXISTS check_out_photo TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS attendance_photo_required BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;
