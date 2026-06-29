ALTER TABLE organisations ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#f97316';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS default_sla JSONB NOT NULL DEFAULT '{
  "P1": {"response": 1, "resolve": 4},
  "P2": {"response": 2, "resolve": 8},
  "P3": {"response": 4, "resolve": 24},
  "P4": {"response": 8, "resolve": 48}
}'::jsonb;

-- Fall back to the org's default SLA hours (by priority) when a ticket has no contract
CREATE OR REPLACE FUNCTION set_sla_due_dates()
RETURNS TRIGGER AS $$
DECLARE
  v_response_hr INTEGER;
  v_resolve_hr  INTEGER;
  v_default_sla JSONB;
BEGIN
  IF NEW.contract_id IS NOT NULL THEN
    SELECT sla_response_hr, sla_resolve_hr
      INTO v_response_hr, v_resolve_hr
      FROM contracts
     WHERE id = NEW.contract_id;

    NEW.sla_response_due := NOW() + (v_response_hr || ' hours')::INTERVAL;
    NEW.sla_resolve_due  := NOW() + (v_resolve_hr  || ' hours')::INTERVAL;
    NEW.is_chargeable    := (SELECT is_chargeable FROM contracts WHERE id = NEW.contract_id);
  ELSE
    SELECT default_sla INTO v_default_sla FROM organisations WHERE id = NEW.organisation_id;
    IF v_default_sla IS NOT NULL AND v_default_sla ? NEW.priority::TEXT THEN
      v_response_hr := (v_default_sla -> NEW.priority::TEXT ->> 'response')::INTEGER;
      v_resolve_hr  := (v_default_sla -> NEW.priority::TEXT ->> 'resolve')::INTEGER;
      NEW.sla_response_due := NOW() + (v_response_hr || ' hours')::INTERVAL;
      NEW.sla_resolve_due  := NOW() + (v_resolve_hr  || ' hours')::INTERVAL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
