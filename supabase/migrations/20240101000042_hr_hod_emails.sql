-- Configurable HR and Head-of-Department contact emails for routing leave/claims approvals.
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS hr_email TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS hod_email TEXT;
