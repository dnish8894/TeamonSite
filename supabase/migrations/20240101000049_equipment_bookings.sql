-- Forward-looking reservations for company equipment (self-service, whole-day ranges).
CREATE TABLE IF NOT EXISTS equipment_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES company_equipment(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  from_date    DATE NOT NULL,
  to_date      DATE NOT NULL,
  purpose      TEXT,
  status       TEXT NOT NULL DEFAULT 'booked',  -- booked | cancelled
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eq_bookings_eq ON equipment_bookings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eq_bookings_dates ON equipment_bookings(from_date, to_date);
