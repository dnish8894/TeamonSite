-- Fixed break (lunch/dinner) auto-deducted from attendance hours on long shifts.
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS attendance_break_minutes INTEGER NOT NULL DEFAULT 60;
