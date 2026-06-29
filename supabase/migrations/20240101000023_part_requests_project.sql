ALTER TABLE part_requests ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE part_requests ADD CONSTRAINT part_requests_source_chk
  CHECK (ticket_id IS NOT NULL OR project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_part_requests_project ON part_requests(project_id);
