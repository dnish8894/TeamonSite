CREATE TYPE milestone_status AS ENUM ('pending','in_progress','completed','not_required','on_hold');
CREATE TYPE milestone_category AS ENUM ('ADMIN','PLANNING','PROCUREMENT','INSTALLATION','HANDOVER','POST-PROJECT');
CREATE TYPE milestone_priority AS ENUM ('High','Medium','Low');

CREATE TABLE IF NOT EXISTS project_milestones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_no          int  NOT NULL,
  title            text NOT NULL,
  status           milestone_status   NOT NULL DEFAULT 'pending',
  completion_date  date,
  category         milestone_category NOT NULL,
  priority         milestone_priority NOT NULL DEFAULT 'Medium',
  notes            text,
  ref_doc          text,
  percent_done     int  NOT NULL DEFAULT 0 CHECK (percent_done BETWEEN 0 AND 100),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
