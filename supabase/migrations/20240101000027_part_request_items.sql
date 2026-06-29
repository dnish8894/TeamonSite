-- Project-sourced part requests can ask for multiple pieces of equipment in one
-- submission, each with its own model + remark. Ticket-sourced (breakdown) requests
-- keep using the single equipment_description field for backward compatibility.
ALTER TABLE part_requests ADD COLUMN IF NOT EXISTS items JSONB;
