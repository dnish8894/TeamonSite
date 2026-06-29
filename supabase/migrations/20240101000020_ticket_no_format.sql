CREATE OR REPLACE FUNCTION generate_ticket_no()
RETURNS TRIGGER AS $$
DECLARE
  org_code TEXT;
  client_code TEXT;
  site_code TEXT;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(o.name, '[^a-zA-Z0-9]', '', 'g'), 3))
    INTO org_code
    FROM organisations o WHERE o.id = NEW.organisation_id;

  SELECT UPPER(LEFT(REGEXP_REPLACE(COALESCE(c.name, ''), '[^a-zA-Z0-9]', '', 'g'), 3)),
         UPPER(LEFT(REGEXP_REPLACE(COALESCE(s.name, ''), '[^a-zA-Z0-9]', '', 'g'), 3))
    INTO client_code, site_code
    FROM sites s
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = NEW.site_id;

  NEW.ticket_no := COALESCE(NULLIF(org_code, ''), 'ORG') || '-' ||
                    COALESCE(NULLIF(client_code, ''), 'CLT') || '-' ||
                    COALESCE(NULLIF(site_code, ''), 'STE') || '-' ||
                    TO_CHAR(NOW(), 'DDMMYY') || '-' ||
                    LPAD(NEXTVAL('ticket_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
