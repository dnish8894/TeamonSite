CREATE TABLE engineer_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE engineer_group_members (
  group_id    UUID NOT NULL REFERENCES engineer_groups(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, engineer_id)
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES engineer_groups(id) ON DELETE SET NULL;
