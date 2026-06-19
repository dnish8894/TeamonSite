-- Run this entire block in Supabase Studio (production) → SQL Editor
-- Covers migrations 015 through 019

-- 015: device warranty start date
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warranty_start DATE;

-- 016: engineer groups
CREATE TABLE IF NOT EXISTS engineer_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engineer_group_members (
  group_id    UUID NOT NULL REFERENCES engineer_groups(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, engineer_id)
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES engineer_groups(id) ON DELETE SET NULL;

-- 017: ticket work timer + multi-group assignment
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_last_resume_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ticket_groups (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  group_id  UUID NOT NULL REFERENCES engineer_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, group_id)
);

-- 018: FSR extra fields (custom field answers storage)
ALTER TABLE job_reports ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 019: Expo (mobile) push tokens
CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user ON expo_push_tokens(user_id);
