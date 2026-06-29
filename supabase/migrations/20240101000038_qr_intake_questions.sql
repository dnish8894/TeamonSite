-- Admin-configurable per-system-type intake questionnaire for the public QR fault form.
-- Shape: { "<system_type>": [ { "id": "...", "label": "...", "type": "choice|text", "options": ["..."] } ] }
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS intake_questions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Structured answers captured from the QR form on the resulting ticket.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS intake_answers JSONB;
