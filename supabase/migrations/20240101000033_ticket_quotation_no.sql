-- Sales-facing quotation number on each breakdown ticket (when a quote is raised
-- for chargeable work / part replacement).
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS quotation_no TEXT;
