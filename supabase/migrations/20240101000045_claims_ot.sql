-- Overtime claims: capture the from/to time window (claim_date holds the day).
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ot_from TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ot_to TEXT;
