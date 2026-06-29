-- IQL Inventory: company-owned equipment register (tools, instruments, laptops,
-- ladders, etc.) — distinct from spare-parts stock and client device assets.
CREATE TABLE IF NOT EXISTS company_equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'tool',     -- tool | instrument | laptop | ladder | vehicle | other
  asset_tag       TEXT,
  serial_no       TEXT,
  brand           TEXT,
  model           TEXT,
  purchase_date   DATE,
  value           NUMERIC(12,2),
  condition       TEXT NOT NULL DEFAULT 'good',     -- new | good | fair | poor
  status          TEXT NOT NULL DEFAULT 'available', -- available | in_use | under_repair | retired
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  location        TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_org ON company_equipment(organisation_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assigned ON company_equipment(assigned_to);

-- Check-out / return history
CREATE TABLE IF NOT EXISTS equipment_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES company_equipment(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,            -- checkout | return
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,   -- holder
  recorded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  note         TEXT,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_log_eq ON equipment_log(equipment_id);
