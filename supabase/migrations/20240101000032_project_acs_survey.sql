-- Access-control-specific site survey fields (doors, readers, controllers, cabling),
-- captured by the mobile app, stored alongside the existing generic site survey.
ALTER TABLE project_surveys ADD COLUMN IF NOT EXISTS acs_survey JSONB;
