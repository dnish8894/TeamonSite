-- Meeting Minutes for Projects
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  meeting_date    date NOT NULL,
  location        text,
  attendees       text,                  -- free-text or newline-separated
  agenda          text,
  minutes         text,                  -- discussion notes
  action_items    text,                  -- decisions / follow-up tasks
  next_meeting_date date,
  recurrence      text NOT NULL DEFAULT 'none'
                  CHECK (recurrence IN ('none','daily','weekly','monthly')),
  prepared_by     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_project ON meeting_minutes(project_id);
