CREATE TABLE app_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  template_type   TEXT NOT NULL,  -- 'fsr' | 'tnc' | 'uat' | 'survey'
  name            TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_templates_org  ON app_templates(organisation_id);
CREATE INDEX idx_templates_type ON app_templates(template_type);
