-- Link installed devices to the project that installed them.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_devices_project ON devices(project_id);
