-- Configurable email (SMTP) provider, editable in Settings → Notifications.
-- Falls back to env vars / local Mailpit when smtp_host is empty.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS smtp_host   text,
  ADD COLUMN IF NOT EXISTS smtp_port   integer,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS smtp_user   text,
  ADD COLUMN IF NOT EXISTS smtp_pass   text,
  ADD COLUMN IF NOT EXISTS smtp_from   text;
