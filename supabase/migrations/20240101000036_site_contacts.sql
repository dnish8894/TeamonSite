-- Multiple named persons-in-charge per site/branch (replaces the single
-- site_contact/site_phone fields, which are kept for backward compatibility).
CREATE TABLE IF NOT EXISTS site_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,          -- role / designation, e.g. "Building Manager"
  phone       TEXT,
  email       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_contacts_site ON site_contacts(site_id);
