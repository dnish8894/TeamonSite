-- =============================================================================
-- ELV Field Service App — Full Database Schema
-- Migration: 20240101000000_create_elv_schema.sql
-- Description: Creates all tables for the ELV FSM application including
--              organisations, clients, contracts, sites, ELV systems,
--              devices, tickets, job reports, users, and supporting tables.
-- Run with: supabase db reset  (local)
--        or: supabase db push   (deploy to cloud)
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- Define all enumerated types first — referenced by table columns below
-- =============================================================================

CREATE TYPE client_type AS ENUM (
  'government',
  'commercial',
  'industrial',
  'residential'
);

CREATE TYPE contract_type AS ENUM (
  'maintenance',
  'warranty',
  'dlp',        -- Defect Liability Period
  'ad_hoc'
);

CREATE TYPE elv_system_type AS ENUM (
  'cctv',
  'access_control',
  'structured_cabling',
  'av',         -- Audio Visual
  'pa',         -- Public Address
  'bms'         -- Building Management System
);

CREATE TYPE device_type AS ENUM (
  'camera',
  'nvr',        -- Network Video Recorder
  'dvr',        -- Digital Video Recorder
  'door_reader',
  'door_controller',
  'door_lock',
  'network_switch',
  'patch_panel',
  'cable_port',
  'access_point',
  'server',
  'other'
);

CREATE TYPE ticket_type AS ENUM (
  'breakdown',
  'preventive_maintenance',
  'installation',
  'inspection',
  'upgrade',
  'relocation'
);

CREATE TYPE ticket_priority AS ENUM (
  'P1',   -- Critical / Emergency
  'P2',   -- High
  'P3',   -- Medium
  'P4'    -- Low / Routine
);

CREATE TYPE ticket_status AS ENUM (
  'open',
  'assigned',
  'in_progress',
  'pending_parts',
  'pending_client',
  'resolved',
  'closed',
  'cancelled'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'manager',
  'engineer',
  'client'
);

CREATE TYPE activity_action AS ENUM (
  'created',
  'assigned',
  'status_changed',
  'priority_changed',
  'note_added',
  'photo_added',
  'parts_requested',
  'report_submitted',
  'signed_off',
  'closed',
  'reopened',
  'sla_breached'
);

CREATE TYPE qr_tier AS ENUM (
  'site',
  'system',
  'device'
);

-- =============================================================================
-- ORGANISATIONS
-- Top-level tenant — your company
-- =============================================================================

CREATE TABLE organisations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  logo_url      TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  currency      TEXT NOT NULL DEFAULT 'MYR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organisations IS 'Your company — top-level tenant for all data';

-- =============================================================================
-- CLIENTS
-- Companies you provide ELV services to
-- =============================================================================

CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            client_type NOT NULL DEFAULT 'commercial',
  registration_no TEXT,                        -- SSM / company reg number
  address         TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE clients IS 'Client companies that receive ELV services';
CREATE INDEX idx_clients_org ON clients(organisation_id);

-- =============================================================================
-- CONTRACTS
-- SLA rules, DLP periods, and billing terms per client
-- =============================================================================

CREATE TABLE contracts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_no         TEXT,                    -- e.g. "CON-2024-001"
  type                contract_type NOT NULL DEFAULT 'maintenance',
  description         TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  sla_response_hr     INTEGER NOT NULL DEFAULT 4,   -- hours to first response
  sla_resolve_hr      INTEGER NOT NULL DEFAULT 24,  -- hours to resolution
  pm_interval_days    INTEGER DEFAULT 90,           -- preventive maintenance every N days
  is_chargeable       BOOLEAN NOT NULL DEFAULT FALSE,
  value               NUMERIC(12, 2),               -- contract value in MYR
  document_url        TEXT,                         -- uploaded contract PDF
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contracts IS 'SLA rules, DLP periods, and billing terms per client';
CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_active ON contracts(is_active, end_date);

-- =============================================================================
-- SITES
-- Physical locations belonging to clients
-- =============================================================================

CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,               -- e.g. "Menara XYZ — Level 1–10"
  address         TEXT,
  postcode        TEXT,
  city            TEXT,
  state           TEXT,
  lat             NUMERIC(10, 7),              -- GPS latitude
  lng             NUMERIC(10, 7),              -- GPS longitude
  floors          INTEGER DEFAULT 1,
  site_contact    TEXT,
  site_phone      TEXT,
  access_notes    TEXT,                        -- entry procedures, permit requirements
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sites IS 'Physical client locations where ELV systems are installed';
CREATE INDEX idx_sites_client ON sites(client_id);
CREATE INDEX idx_sites_contract ON sites(contract_id);

-- =============================================================================
-- ELV SYSTEMS
-- A system type installed within a site (e.g. CCTV system at Site A)
-- =============================================================================

CREATE TABLE elv_systems (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type            elv_system_type NOT NULL,
  name            TEXT,                        -- e.g. "CCTV System — Block A"
  brand           TEXT,                        -- e.g. "Hikvision", "HID"
  model           TEXT,                        -- main controller / head-end model
  install_date    DATE,
  warranty_expiry DATE,
  location_desc   TEXT,                        -- e.g. "Server Room, Level B1"
  ip_range        TEXT,                        -- e.g. "192.168.10.0/24"
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE elv_systems IS 'ELV system types installed at a site (CCTV, access control, cabling etc)';
CREATE INDEX idx_elv_systems_site ON elv_systems(site_id);
CREATE INDEX idx_elv_systems_type ON elv_systems(type);

-- =============================================================================
-- DEVICES
-- Individual ELV devices — cameras, readers, switches, ports etc.
-- =============================================================================

CREATE TABLE devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id       UUID NOT NULL REFERENCES elv_systems(id) ON DELETE CASCADE,
  device_type     device_type NOT NULL,
  tag_id          TEXT UNIQUE,                 -- QR code identifier e.g. "DEV-CAM-0089"
  name            TEXT,                        -- e.g. "CAM-001 Main Lobby"
  brand           TEXT,
  model           TEXT,                        -- e.g. "DS-2CD2143G2"
  serial_no       TEXT,
  ip_address      TEXT,
  mac_address     TEXT,
  firmware        TEXT,
  location_desc   TEXT,                        -- e.g. "Level 1, Main Lobby entrance"
  floor           INTEGER,
  install_date    DATE,
  warranty_expiry DATE,
  -- Flexible JSON for device-type specific fields:
  -- CCTV camera:     { "channel": 6, "lens_mm": 4, "recording_mode": "continuous", "nvr_id": "..." }
  -- Door reader:     { "door_id": "DR-001", "access_group": "staff", "controller_id": "..." }
  -- Network port:    { "port_no": 24, "patch_panel": "PP-B", "endpoint": "Workstation 47, Finance" }
  -- Patch panel:     { "rack": "Rack A", "total_ports": 48 }
  meta            JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE devices IS 'Individual ELV devices — cameras, door readers, switches, cable ports etc.';
CREATE INDEX idx_devices_system ON devices(system_id);
CREATE INDEX idx_devices_tag ON devices(tag_id);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_meta ON devices USING GIN(meta);

-- =============================================================================
-- USERS
-- All app logins — engineers, managers, admins, client contacts
-- =============================================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role            user_role NOT NULL DEFAULT 'engineer',
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'All app users — engineers, managers, admins, and client portal users';
CREATE INDEX idx_users_org ON users(organisation_id);
CREATE INDEX idx_users_role ON users(role);
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- =============================================================================
-- ENGINEERS
-- Extended profile for field engineers (role = 'engineer')
-- =============================================================================

CREATE TABLE engineers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_id         TEXT,                    -- internal staff number
  daily_capacity_hr   INTEGER NOT NULL DEFAULT 8,
  -- Skills array e.g. ["cctv", "access_control", "structured_cabling"]
  skills              JSONB NOT NULL DEFAULT '[]',
  -- Certifications e.g. [{"brand": "Hikvision", "level": "certified", "expiry": "2026-01-01"}]
  certifications      JSONB NOT NULL DEFAULT '[]',
  is_available        BOOLEAN NOT NULL DEFAULT TRUE,
  current_lat         NUMERIC(10, 7),          -- last known GPS location
  current_lng         NUMERIC(10, 7),
  location_updated_at TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE engineers IS 'Extended profile for field engineers including skills, certs, and availability';
CREATE INDEX idx_engineers_user ON engineers(user_id);
CREATE INDEX idx_engineers_available ON engineers(is_available);
CREATE INDEX idx_engineers_skills ON engineers USING GIN(skills);

-- =============================================================================
-- CLIENT USERS
-- Links a user to a client — controls portal access per site
-- =============================================================================

CREATE TABLE client_users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  can_raise_ticket  BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_reports  BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_assets   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Array of site UUIDs this user can access. Empty = all sites.
  site_access       JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

COMMENT ON TABLE client_users IS 'Portal access control — links users to clients and specific sites';
CREATE INDEX idx_client_users_user ON client_users(user_id);
CREATE INDEX idx_client_users_client ON client_users(client_id);

-- =============================================================================
-- TICKETS
-- The core entity — every job, fault, and maintenance visit
-- =============================================================================

CREATE TABLE tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_no       TEXT NOT NULL UNIQUE,        -- auto-generated e.g. "TKT-2024-00042"
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  system_id       UUID REFERENCES elv_systems(id) ON DELETE SET NULL,
  device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,  -- nullable
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES engineers(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  type            ticket_type NOT NULL DEFAULT 'breakdown',
  priority        ticket_priority NOT NULL DEFAULT 'P3',
  status          ticket_status NOT NULL DEFAULT 'open',
  title           TEXT NOT NULL,
  description     TEXT,
  -- Client contact for this specific ticket (may differ from site contact)
  reporter_name   TEXT,
  reporter_phone  TEXT,
  reporter_email  TEXT,
  -- SLA fields — auto-calculated from contract when ticket is created
  sla_response_due  TIMESTAMPTZ,
  sla_resolve_due   TIMESTAMPTZ,
  sla_response_met  BOOLEAN,
  sla_resolve_met   BOOLEAN,
  is_chargeable     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timestamps
  assigned_at       TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,             -- engineer confirmed receipt
  started_at        TIMESTAMPTZ,             -- engineer checked in on site
  resolved_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  -- QR scan source — which QR was scanned to create this ticket
  source_qr_tier    qr_tier,
  source_qr_id      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tickets IS 'Core entity — every job, fault report, PM visit, and installation';
CREATE INDEX idx_tickets_org ON tickets(organisation_id);
CREATE INDEX idx_tickets_site ON tickets(site_id);
CREATE INDEX idx_tickets_device ON tickets(device_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_sla ON tickets(sla_resolve_due, status);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);

-- Auto-generate ticket_no: TKT-YYYY-NNNNN
CREATE SEQUENCE ticket_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_no := 'TKT-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                   LPAD(NEXTVAL('ticket_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_no
  BEFORE INSERT ON tickets
  FOR EACH ROW
  WHEN (NEW.ticket_no IS NULL OR NEW.ticket_no = '')
  EXECUTE FUNCTION generate_ticket_no();

-- Auto-calculate SLA due timestamps from contract when ticket is created
CREATE OR REPLACE FUNCTION set_sla_due_dates()
RETURNS TRIGGER AS $$
DECLARE
  v_response_hr INTEGER;
  v_resolve_hr  INTEGER;
BEGIN
  IF NEW.contract_id IS NOT NULL THEN
    SELECT sla_response_hr, sla_resolve_hr
      INTO v_response_hr, v_resolve_hr
      FROM contracts
     WHERE id = NEW.contract_id;

    NEW.sla_response_due := NOW() + (v_response_hr || ' hours')::INTERVAL;
    NEW.sla_resolve_due  := NOW() + (v_resolve_hr  || ' hours')::INTERVAL;
    NEW.is_chargeable    := (SELECT is_chargeable FROM contracts WHERE id = NEW.contract_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sla_due_dates
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_sla_due_dates();

-- =============================================================================
-- JOB REPORTS
-- Completed work record — one per ticket, filled by engineer on site
-- =============================================================================

CREATE TABLE job_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id         UUID NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  engineer_id       UUID REFERENCES engineers(id) ON DELETE SET NULL,
  -- Work details
  findings          TEXT,                      -- what the engineer found
  root_cause        TEXT,                      -- diagnosed root cause
  work_done         TEXT,                      -- actions taken
  recommendation    TEXT,                      -- follow-up recommendations
  -- Checklist: typed per system e.g. CCTV = image quality, recording, IR working
  -- [ { "item": "Camera image quality", "status": "pass", "note": "" }, ... ]
  checklist         JSONB NOT NULL DEFAULT '[]',
  -- Photos: [ { "url": "...", "caption": "Before", "taken_at": "..." }, ... ]
  photos            JSONB NOT NULL DEFAULT '[]',
  -- Parts used: [ { "name": "Cat6 cable", "qty": 10, "unit": "m", "unit_cost": 2.50 }, ... ]
  parts_used        JSONB NOT NULL DEFAULT '[]',
  labour_hrs        NUMERIC(5, 2) DEFAULT 0,
  travel_hrs        NUMERIC(5, 2) DEFAULT 0,
  -- Cable test results (for structured cabling jobs)
  -- [ { "point_id": "P01", "from": "PP-A:01", "to": "WS-47", "result": "pass", "length_m": 42 } ]
  cable_test_results JSONB DEFAULT '[]',
  -- Site acceptance
  client_name       TEXT,                      -- name of person who signed off
  client_signature  TEXT,                      -- URL to signature image
  signed_at         TIMESTAMPTZ,
  -- Location stamp when report was submitted
  submit_lat        NUMERIC(10, 7),
  submit_lng        NUMERIC(10, 7),
  -- Generated PDF
  pdf_url           TEXT,
  pdf_generated_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE job_reports IS 'Completed work record filled by engineer on site — one per ticket';
CREATE INDEX idx_job_reports_ticket ON job_reports(ticket_id);
CREATE INDEX idx_job_reports_engineer ON job_reports(engineer_id);

-- =============================================================================
-- TICKET ACTIVITY LOG
-- Full audit trail for every ticket — every action, status change, and note
-- =============================================================================

CREATE TABLE ticket_activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      activity_action NOT NULL,
  old_value   TEXT,                            -- previous value (for status changes)
  new_value   TEXT,                            -- new value
  note        TEXT,                            -- free-text note or comment
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ticket_activities IS 'Full audit trail — every status change, note, and action per ticket';
CREATE INDEX idx_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX idx_activities_created ON ticket_activities(created_at DESC);

-- Auto-log status changes on tickets
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_activities (ticket_id, action, old_value, new_value)
    VALUES (NEW.id, 'status_changed', OLD.status::TEXT, NEW.status::TEXT);
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO ticket_activities (ticket_id, action, new_value)
    VALUES (NEW.id, 'assigned', NEW.assigned_to::TEXT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_activity
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_status_change();

-- =============================================================================
-- QR SCAN LOG
-- Records every QR code scan — who, when, where, and what tier
-- Important for government site audit trails
-- =============================================================================

CREATE TABLE qr_scan_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier          qr_tier NOT NULL,
  ref_id        UUID NOT NULL,                 -- site_id / system_id / device_id
  scanned_by    UUID REFERENCES users(id) ON DELETE SET NULL,  -- null = public/client scan
  ticket_id     UUID REFERENCES tickets(id) ON DELETE SET NULL, -- if a ticket was raised
  ip_address    TEXT,
  user_agent    TEXT,
  lat           NUMERIC(10, 7),
  lng           NUMERIC(10, 7),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE qr_scan_logs IS 'Audit log of every QR code scan — tier, location, and resulting ticket';
CREATE INDEX idx_qr_scans_ref ON qr_scan_logs(tier, ref_id);
CREATE INDEX idx_qr_scans_created ON qr_scan_logs(created_at DESC);

-- =============================================================================
-- CHECKLIST TEMPLATES
-- System-type specific checklists used in job reports
-- e.g. CCTV gets different checklist items than access_control
-- =============================================================================

CREATE TABLE checklist_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_type   elv_system_type NOT NULL,
  ticket_type   ticket_type NOT NULL DEFAULT 'preventive_maintenance',
  name          TEXT NOT NULL,                 -- e.g. "CCTV Quarterly PM Checklist"
  -- items: [ { "id": "1", "label": "Camera image quality", "type": "pass_fail" }, ... ]
  items         JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE checklist_templates IS 'Reusable PM and inspection checklists per ELV system type';
CREATE INDEX idx_checklist_tpl_org ON checklist_templates(organisation_id);
CREATE INDEX idx_checklist_tpl_type ON checklist_templates(system_type, ticket_type);

-- =============================================================================
-- PARTS / INVENTORY
-- Spare parts and materials stock tracking
-- =============================================================================

CREATE TABLE parts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,               -- e.g. "Cat6 UTP Cable"
  part_no         TEXT,                        -- internal part number
  brand           TEXT,
  unit            TEXT NOT NULL DEFAULT 'pcs', -- pcs, m, roll, set
  unit_cost       NUMERIC(10, 2),
  stock_qty       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_stock_qty   NUMERIC(10, 2) DEFAULT 0,    -- triggers low-stock alert
  location        TEXT,                        -- e.g. "Warehouse Shelf B3"
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parts IS 'Spare parts and consumables inventory';
CREATE INDEX idx_parts_org ON parts(organisation_id);

-- =============================================================================
-- PM SCHEDULES
-- Defines the recurring preventive maintenance schedule per site/system
-- App auto-generates tickets based on these rules
-- =============================================================================

CREATE TABLE pm_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  system_id       UUID REFERENCES elv_systems(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,               -- e.g. "Quarterly CCTV PM"
  ticket_type     ticket_type NOT NULL DEFAULT 'preventive_maintenance',
  interval_days   INTEGER NOT NULL DEFAULT 90,
  last_run_at     TIMESTAMPTZ,
  next_due_at     TIMESTAMPTZ,
  assigned_to     UUID REFERENCES engineers(id) ON DELETE SET NULL,
  checklist_id    UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pm_schedules IS 'Recurring PM schedule rules — app auto-generates tickets when next_due_at is reached';
CREATE INDEX idx_pm_schedules_site ON pm_schedules(site_id);
CREATE INDEX idx_pm_schedules_due ON pm_schedules(next_due_at, is_active);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- Auto-update updated_at on every row change
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organisations', 'clients', 'contracts', 'sites',
    'elv_systems', 'devices', 'users', 'engineers',
    'tickets', 'job_reports', 'checklist_templates',
    'parts', 'pm_schedules'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Ensures each organisation only sees its own data.
-- Users can only access records belonging to their organisation.
-- =============================================================================

ALTER TABLE organisations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites                ENABLE ROW LEVEL SECURITY;
ALTER TABLE elv_systems          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedules         ENABLE ROW LEVEL SECURITY;

-- Helper function: returns the organisation_id of the current logged-in user
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
  SELECT organisation_id FROM users
   WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: returns the role of the current logged-in user
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Organisations: user sees only their own org
CREATE POLICY "org_isolation" ON organisations
  USING (id = current_org_id());

-- Clients, contracts, sites: scoped to organisation
CREATE POLICY "org_scope" ON clients
  USING (organisation_id = current_org_id());

CREATE POLICY "org_scope" ON contracts
  USING (client_id IN (SELECT id FROM clients WHERE organisation_id = current_org_id()));

CREATE POLICY "org_scope" ON sites
  USING (client_id IN (SELECT id FROM clients WHERE organisation_id = current_org_id()));

CREATE POLICY "org_scope" ON elv_systems
  USING (site_id IN (SELECT id FROM sites WHERE client_id IN
         (SELECT id FROM clients WHERE organisation_id = current_org_id())));

CREATE POLICY "org_scope" ON devices
  USING (system_id IN (SELECT id FROM elv_systems WHERE site_id IN
         (SELECT id FROM sites WHERE client_id IN
          (SELECT id FROM clients WHERE organisation_id = current_org_id()))));

-- Users: scoped to organisation
CREATE POLICY "org_scope" ON users
  USING (organisation_id = current_org_id());

CREATE POLICY "org_scope" ON engineers
  USING (user_id IN (SELECT id FROM users WHERE organisation_id = current_org_id()));

-- Tickets and job reports: scoped to organisation
CREATE POLICY "org_scope" ON tickets
  USING (organisation_id = current_org_id());

CREATE POLICY "org_scope" ON job_reports
  USING (ticket_id IN (SELECT id FROM tickets WHERE organisation_id = current_org_id()));

CREATE POLICY "org_scope" ON ticket_activities
  USING (ticket_id IN (SELECT id FROM tickets WHERE organisation_id = current_org_id()));

CREATE POLICY "org_scope" ON qr_scan_logs
  USING (
    (tier = 'site'   AND ref_id IN (SELECT id FROM sites WHERE client_id IN
                         (SELECT id FROM clients WHERE organisation_id = current_org_id())))
    OR
    (tier = 'system' AND ref_id IN (SELECT id FROM elv_systems WHERE site_id IN
                         (SELECT id FROM sites WHERE client_id IN
                          (SELECT id FROM clients WHERE organisation_id = current_org_id()))))
    OR
    (tier = 'device' AND ref_id IN (SELECT id FROM devices WHERE system_id IN
                         (SELECT id FROM elv_systems WHERE site_id IN
                          (SELECT id FROM sites WHERE client_id IN
                           (SELECT id FROM clients WHERE organisation_id = current_org_id())))))
  );

CREATE POLICY "org_scope" ON checklist_templates
  USING (organisation_id = current_org_id());

CREATE POLICY "org_scope" ON parts
  USING (organisation_id = current_org_id());

CREATE POLICY "org_scope" ON pm_schedules
  USING (site_id IN (SELECT id FROM sites WHERE client_id IN
         (SELECT id FROM clients WHERE organisation_id = current_org_id())));

-- Client portal: client users see only their own tickets
CREATE POLICY "client_own_tickets" ON client_users
  USING (user_id = auth.uid());

-- =============================================================================
-- SEED DATA — Default checklist templates
-- These get created when you first set up your organisation.
-- Replace the organisation_id with your real org UUID after inserting.
-- =============================================================================

-- NOTE: Uncomment and update the organisation_id below after creating your org.
-- INSERT INTO checklist_templates (organisation_id, system_type, ticket_type, name, items)
-- VALUES
-- (
--   'YOUR-ORG-UUID-HERE',
--   'cctv',
--   'preventive_maintenance',
--   'CCTV Quarterly PM Checklist',
--   '[
--     {"id":"1","label":"Camera image quality — clear and sharp","type":"pass_fail"},
--     {"id":"2","label":"Camera housing — clean, no condensation","type":"pass_fail"},
--     {"id":"3","label":"IR night vision — functioning","type":"pass_fail"},
--     {"id":"4","label":"Camera angle — not shifted or blocked","type":"pass_fail"},
--     {"id":"5","label":"NVR recording — all channels active","type":"pass_fail"},
--     {"id":"6","label":"HDD status — no warnings or errors","type":"pass_fail"},
--     {"id":"7","label":"Playback test — 72hr footage accessible","type":"pass_fail"},
--     {"id":"8","label":"Network connectivity — all cameras pingable","type":"pass_fail"},
--     {"id":"9","label":"Cable routing — no damage or exposed wires","type":"pass_fail"},
--     {"id":"10","label":"Remarks","type":"text"}
--   ]'
-- ),
-- (
--   'YOUR-ORG-UUID-HERE',
--   'access_control',
--   'preventive_maintenance',
--   'Access Control Quarterly PM Checklist',
--   '[
--     {"id":"1","label":"Door reader — card and fob read correctly","type":"pass_fail"},
--     {"id":"2","label":"Door lock — engaging and releasing properly","type":"pass_fail"},
--     {"id":"3","label":"Door sensor — open/close detecting correctly","type":"pass_fail"},
--     {"id":"4","label":"Access controller — no fault LEDs","type":"pass_fail"},
--     {"id":"5","label":"Software — event logs accessible and current","type":"pass_fail"},
--     {"id":"6","label":"Backup power — battery test passed","type":"pass_fail"},
--     {"id":"7","label":"Emergency release — manual override tested","type":"pass_fail"},
--     {"id":"8","label":"Remarks","type":"text"}
--   ]'
-- ),
-- (
--   'YOUR-ORG-UUID-HERE',
--   'structured_cabling',
--   'inspection',
--   'Structured Cabling Inspection Checklist',
--   '[
--     {"id":"1","label":"Patch panel — all ports labelled and secure","type":"pass_fail"},
--     {"id":"2","label":"Cable routing — contained in trunking/trays","type":"pass_fail"},
--     {"id":"3","label":"Terminations — no loose or damaged ends","type":"pass_fail"},
--     {"id":"4","label":"Cable test — all active ports pass Cat6 standard","type":"pass_fail"},
--     {"id":"5","label":"Port schedule — updated and accurate","type":"pass_fail"},
--     {"id":"6","label":"Remarks","type":"text"}
--   ]'
-- );

-- =============================================================================
-- USEFUL VIEWS
-- Pre-built queries for common dashboard and reporting needs
-- =============================================================================

-- Open tickets with SLA status — used by manager dashboard
CREATE OR REPLACE VIEW v_open_tickets AS
SELECT
  t.id,
  t.ticket_no,
  t.title,
  t.type,
  t.priority,
  t.status,
  t.is_chargeable,
  t.created_at,
  t.sla_resolve_due,
  CASE
    WHEN t.sla_resolve_due < NOW() AND t.status NOT IN ('resolved','closed','cancelled')
    THEN TRUE ELSE FALSE
  END AS is_sla_breached,
  EXTRACT(EPOCH FROM (t.sla_resolve_due - NOW()))/3600 AS hours_remaining,
  s.name  AS site_name,
  c.name  AS client_name,
  c.type  AS client_type,
  u.full_name AS engineer_name,
  u.phone     AS engineer_phone
FROM tickets t
LEFT JOIN sites    s ON s.id = t.site_id
LEFT JOIN clients  c ON c.id = s.client_id
LEFT JOIN engineers e ON e.id = t.assigned_to
LEFT JOIN users    u ON u.id = e.user_id
WHERE t.status NOT IN ('closed','cancelled');

COMMENT ON VIEW v_open_tickets IS 'All open tickets with SLA breach status — for manager dashboard';

-- Engineer workload today — used by dispatch board
CREATE OR REPLACE VIEW v_engineer_workload AS
SELECT
  e.id AS engineer_id,
  u.full_name,
  u.phone,
  e.is_available,
  e.skills,
  e.certifications,
  COUNT(t.id) FILTER (WHERE t.status IN ('assigned','in_progress')) AS active_jobs,
  SUM(COALESCE(jr.labour_hrs, 2)) FILTER (
    WHERE t.status IN ('assigned','in_progress')
    AND DATE(t.created_at) = CURRENT_DATE
  ) AS estimated_hrs_today,
  e.daily_capacity_hr,
  ROUND(
    100.0 * COALESCE(SUM(COALESCE(jr.labour_hrs, 2)) FILTER (
      WHERE t.status IN ('assigned','in_progress')
      AND DATE(t.created_at) = CURRENT_DATE
    ), 0) / NULLIF(e.daily_capacity_hr, 0), 1
  ) AS load_pct
FROM engineers e
JOIN users u ON u.id = e.user_id
LEFT JOIN tickets t ON t.assigned_to = e.id
LEFT JOIN job_reports jr ON jr.ticket_id = t.id
WHERE u.is_active = TRUE
GROUP BY e.id, u.full_name, u.phone, e.is_available, e.skills, e.certifications, e.daily_capacity_hr;

COMMENT ON VIEW v_engineer_workload IS 'Real-time engineer workload for dispatch board and auto-assignment';

-- Device service history — used when engineer scans a QR
CREATE OR REPLACE VIEW v_device_history AS
SELECT
  d.id AS device_id,
  d.tag_id,
  d.name AS device_name,
  d.device_type,
  d.model,
  d.serial_no,
  d.ip_address,
  d.location_desc,
  d.floor,
  d.meta,
  t.id         AS ticket_id,
  t.ticket_no,
  t.type       AS job_type,
  t.priority,
  t.status,
  t.title,
  t.created_at AS job_date,
  t.closed_at,
  jr.work_done,
  jr.findings,
  u.full_name  AS engineer_name
FROM devices d
LEFT JOIN tickets t ON t.device_id = d.id
LEFT JOIN job_reports jr ON jr.ticket_id = t.id
LEFT JOIN engineers e ON e.id = jr.engineer_id
LEFT JOIN users u ON u.id = e.user_id
ORDER BY d.id, t.created_at DESC;

COMMENT ON VIEW v_device_history IS 'Device detail with full service history — used when engineer scans QR';

-- =============================================================================
-- END OF MIGRATION
-- Tables created: 14
-- Enums created:  9
-- Triggers:       16 (updated_at x13 + ticket_no + sla_due + status_log)
-- Functions:      5
-- Views:          3
-- RLS policies:   16
-- =============================================================================
