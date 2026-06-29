-- Tracks who changed organisation settings and when, for accountability.
CREATE TABLE IF NOT EXISTS settings_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  changes     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settings_audit_created ON settings_audit_log(created_at DESC);
