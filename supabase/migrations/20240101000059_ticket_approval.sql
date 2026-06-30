-- Floating tickets: public QR/client submissions land as "pending approval"
-- until an engineer or admin approves them.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_pending_approval boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_tickets_pending_approval
  ON public.tickets (is_pending_approval) WHERE is_pending_approval = true;

-- Expose is_pending_approval on the open-tickets view (appended at the end).
CREATE OR REPLACE VIEW public.v_open_tickets WITH (security_invoker='true') AS
 SELECT t.id,
    t.ticket_no,
    t.title,
    t.type,
    t.priority,
    t.status,
    t.is_chargeable,
    t.created_at,
    t.sla_resolve_due,
        CASE
            WHEN ((t.sla_resolve_due < now()) AND (t.status <> ALL (ARRAY['resolved'::public.ticket_status, 'closed'::public.ticket_status, 'cancelled'::public.ticket_status]))) THEN true
            ELSE false
        END AS is_sla_breached,
    (EXTRACT(epoch FROM (t.sla_resolve_due - now())) / (3600)::numeric) AS hours_remaining,
    s.name AS site_name,
    c.name AS client_name,
    c.type AS client_type,
    u.full_name AS engineer_name,
    u.phone AS engineer_phone,
    t.is_pending_approval
   FROM ((((public.tickets t
     LEFT JOIN public.sites s ON ((s.id = t.site_id)))
     LEFT JOIN public.clients c ON ((c.id = s.client_id)))
     LEFT JOIN public.engineers e ON ((e.id = t.assigned_to)))
     LEFT JOIN public.users u ON ((u.id = e.user_id)))
  WHERE (t.status <> ALL (ARRAY['closed'::public.ticket_status, 'cancelled'::public.ticket_status]));
