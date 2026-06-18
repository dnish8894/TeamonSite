-- Standby engineer schedule
-- Tracks which engineer(s) are on standby per day

CREATE TABLE IF NOT EXISTS standby_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date date NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift         text NOT NULL DEFAULT 'all_day'
                  CHECK (shift IN ('all_day','morning','afternoon','night')),
  notes         text,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standby_date   ON standby_schedule(schedule_date);
CREATE INDEX IF NOT EXISTS idx_standby_user   ON standby_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_standby_month  ON standby_schedule(EXTRACT(YEAR FROM schedule_date), EXTRACT(MONTH FROM schedule_date));

-- Prevent duplicate user on same date+shift
CREATE UNIQUE INDEX IF NOT EXISTS uq_standby_user_date_shift
  ON standby_schedule(user_id, schedule_date, shift);
