-- Procurement requests raised when a ticket is closed/paused due to a faulty part
CREATE TABLE IF NOT EXISTS part_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id               UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  engineer_id             UUID REFERENCES engineers(id) ON DELETE SET NULL,
  equipment_description   TEXT NOT NULL,
  request_type            TEXT NOT NULL, -- warranty | preventive_maintenance | quotation
  status                  TEXT NOT NULL DEFAULT 'pending', -- pending | reviewed | closed
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_part_requests_ticket ON part_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);

-- Engineer GPS attendance check-in / check-out (general, not tied to a specific ticket)
CREATE TABLE IF NOT EXISTS attendance_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id     UUID NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  check_in_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_lat    NUMERIC(10,7),
  check_in_lng    NUMERIC(10,7),
  check_out_at    TIMESTAMPTZ,
  check_out_lat   NUMERIC(10,7),
  check_out_lng   NUMERIC(10,7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_engineer ON attendance_checkins(engineer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin_at ON attendance_checkins(check_in_at);
