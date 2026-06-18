CREATE TYPE project_member_role AS ENUM ('lead','member','viewer');

CREATE TABLE IF NOT EXISTS project_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  member_role project_member_role NOT NULL DEFAULT 'member',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user    ON project_assignments(user_id);
