-- Add report_settings JSONB column to organisations
-- Stores FSR PDF customisation: title, color theme, section labels, show/hide options

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS report_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organisations.report_settings IS
  'FSR PDF customisation: report_title, color_theme, section_labels, ack_labels, show_* flags';
