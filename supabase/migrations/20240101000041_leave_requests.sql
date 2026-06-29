-- HR Leave module: staff apply for leave, HR/admin/manager approve or reject.
CREATE TABLE IF NOT EXISTS leave_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type         TEXT NOT NULL,          -- annual | medical | emergency | unpaid | other
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  days               NUMERIC(4,1) NOT NULL DEFAULT 1,
  reason             TEXT,
  supporting_doc_url TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  review_note        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);

-- Public bucket for leave supporting documents (medical certs, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-docs', 'hr-docs', true)
ON CONFLICT (id) DO NOTHING;
