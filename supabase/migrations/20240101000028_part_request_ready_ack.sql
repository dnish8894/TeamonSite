-- Procurement marks a request "ready for collection" with a note (e.g. pickup location),
-- and the requester acknowledges/collects it. requested_by tracks who raised the request
-- so the "ready" notification can be routed back to them.
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS ready_note TEXT;
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL;
