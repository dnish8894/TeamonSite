-- Groups now carry a "type" — Project Team or Maintenance Team — which is used to
-- set the privilege (users.role) of any engineer assigned into that group.
ALTER TABLE engineer_groups ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'maintenance_team';
ALTER TABLE engineer_groups DROP CONSTRAINT IF EXISTS engineer_groups_group_type_check;
ALTER TABLE engineer_groups ADD CONSTRAINT engineer_groups_group_type_check
  CHECK (group_type IN ('project_team', 'maintenance_team'));
