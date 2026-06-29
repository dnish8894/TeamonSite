-- HR Claims module: staff submit expense claims (with receipt), optionally tagged to
-- a ticket (breakdown) or project; HR/HOD approve or reject.
CREATE TABLE IF NOT EXISTS claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_type     TEXT NOT NULL,            -- travel | meal | parts | accommodation | other
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  claim_date     DATE NOT NULL,
  description    TEXT,
  receipt_url    TEXT,
  ticket_id      UUID REFERENCES tickets(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  reference_note TEXT,                       -- free reference (e.g. a PM visit)
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  review_note    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
