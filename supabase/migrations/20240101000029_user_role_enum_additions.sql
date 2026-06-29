-- The Settings UI has offered 'procurement', 'hr', 'sales' role options for a while,
-- but the user_role enum was never actually updated to match — assigning those roles
-- would fail. Adding 'project' here too for the new Project Team role.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'procurement';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project';
