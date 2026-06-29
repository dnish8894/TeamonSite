--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: activity_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_action AS ENUM (
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


--
-- Name: client_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_type AS ENUM (
    'government',
    'commercial',
    'industrial',
    'residential'
);


--
-- Name: contract_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contract_type AS ENUM (
    'maintenance',
    'warranty',
    'dlp',
    'ad_hoc'
);


--
-- Name: device_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.device_type AS ENUM (
    'camera',
    'nvr',
    'dvr',
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


--
-- Name: elv_system_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.elv_system_type AS ENUM (
    'cctv',
    'access_control',
    'structured_cabling',
    'av',
    'pa',
    'bms',
    'other'
);


--
-- Name: milestone_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.milestone_category AS ENUM (
    'ADMIN',
    'PLANNING',
    'PROCUREMENT',
    'INSTALLATION',
    'HANDOVER',
    'POST-PROJECT'
);


--
-- Name: milestone_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.milestone_priority AS ENUM (
    'High',
    'Medium',
    'Low'
);


--
-- Name: milestone_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.milestone_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'not_required',
    'on_hold'
);


--
-- Name: project_member_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_member_role AS ENUM (
    'lead',
    'member',
    'viewer'
);


--
-- Name: qr_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qr_tier AS ENUM (
    'site',
    'system',
    'device'
);


--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_priority AS ENUM (
    'P1',
    'P2',
    'P3',
    'P4'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'pending_parts',
    'pending_client',
    'resolved',
    'closed',
    'cancelled'
);


--
-- Name: ticket_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_type AS ENUM (
    'breakdown',
    'preventive_maintenance',
    'installation',
    'inspection',
    'upgrade',
    'relocation'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'manager',
    'engineer',
    'client',
    'procurement',
    'hr',
    'sales',
    'project'
);


--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organisation_id FROM users
   WHERE id = auth.uid()
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;


--
-- Name: generate_project_no(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_project_no() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.project_no := 'PRJ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('project_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generate_ticket_no(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ticket_no() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: log_ticket_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_ticket_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: set_sla_due_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sla_due_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    template_type text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engineer_id uuid NOT NULL,
    check_in_at timestamp with time zone DEFAULT now() NOT NULL,
    check_in_lat numeric(10,7),
    check_in_lng numeric(10,7),
    check_out_at timestamp with time zone,
    check_out_lat numeric(10,7),
    check_out_lng numeric(10,7),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid,
    site_name text,
    check_in_landmark text,
    check_out_landmark text,
    check_in_photo text,
    check_out_photo text
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    system_type public.elv_system_type NOT NULL,
    ticket_type public.ticket_type DEFAULT 'preventive_maintenance'::public.ticket_type NOT NULL,
    name text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE checklist_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checklist_templates IS 'Reusable PM and inspection checklists per ELV system type';


--
-- Name: claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    claim_type text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    claim_date date NOT NULL,
    description text,
    receipt_url text,
    ticket_id uuid,
    project_id uuid,
    reference_note text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ot_from text,
    ot_to text
);


--
-- Name: client_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    can_raise_ticket boolean DEFAULT true NOT NULL,
    can_view_reports boolean DEFAULT true NOT NULL,
    can_view_assets boolean DEFAULT false NOT NULL,
    site_access jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE client_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_users IS 'Portal access control — links users to clients and specific sites';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    type public.client_type DEFAULT 'commercial'::public.client_type NOT NULL,
    registration_no text,
    address text,
    contact_name text,
    contact_email text,
    contact_phone text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE clients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.clients IS 'Client companies that receive ELV services';


--
-- Name: company_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'tool'::text NOT NULL,
    asset_tag text,
    serial_no text,
    brand text,
    model text,
    purchase_date date,
    value numeric(12,2),
    condition text DEFAULT 'good'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    assigned_to uuid,
    location text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    contract_no text,
    type public.contract_type DEFAULT 'maintenance'::public.contract_type NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    sla_response_hr integer DEFAULT 4 NOT NULL,
    sla_resolve_hr integer DEFAULT 24 NOT NULL,
    pm_interval_days integer DEFAULT 90,
    is_chargeable boolean DEFAULT false NOT NULL,
    value numeric(12,2),
    document_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE contracts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contracts IS 'SLA rules, DLP periods, and billing terms per client';


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    system_id uuid NOT NULL,
    device_type public.device_type NOT NULL,
    tag_id text,
    name text,
    brand text,
    model text,
    serial_no text,
    ip_address text,
    mac_address text,
    firmware text,
    location_desc text,
    floor integer,
    install_date date,
    warranty_expiry date,
    meta jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    warranty_start date,
    work_at_height boolean DEFAULT false NOT NULL,
    work_at_height_notes text,
    vendor_warranty_start date,
    vendor_warranty_end date,
    under_contract boolean DEFAULT false NOT NULL,
    last_service_date date,
    project_id uuid
);


--
-- Name: TABLE devices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.devices IS 'Individual ELV devices — cameras, door readers, switches, cable ports etc.';


--
-- Name: elv_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elv_systems (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    site_id uuid NOT NULL,
    type public.elv_system_type NOT NULL,
    name text,
    brand text,
    model text,
    install_date date,
    warranty_expiry date,
    location_desc text,
    ip_range text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type_label text
);


--
-- Name: TABLE elv_systems; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.elv_systems IS 'ELV system types installed at a site (CCTV, access control, cabling etc)';


--
-- Name: engineer_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineer_group_members (
    group_id uuid NOT NULL,
    engineer_id uuid NOT NULL
);


--
-- Name: engineer_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineer_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    group_type text DEFAULT 'maintenance_team'::text NOT NULL,
    CONSTRAINT engineer_groups_group_type_check CHECK ((group_type = ANY (ARRAY['project_team'::text, 'maintenance_team'::text])))
);


--
-- Name: engineers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    employee_id text,
    daily_capacity_hr integer DEFAULT 8 NOT NULL,
    skills jsonb DEFAULT '[]'::jsonb NOT NULL,
    certifications jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    current_lat numeric(10,7),
    current_lng numeric(10,7),
    location_updated_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    engineer_type text DEFAULT 'maintenance'::text NOT NULL
);


--
-- Name: TABLE engineers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.engineers IS 'Extended profile for field engineers including skills, certs, and availability';


--
-- Name: equipment_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipment_id uuid NOT NULL,
    user_id uuid,
    from_date date NOT NULL,
    to_date date NOT NULL,
    purpose text,
    status text DEFAULT 'booked'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: equipment_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipment_id uuid NOT NULL,
    action text NOT NULL,
    user_id uuid,
    recorded_by uuid,
    note text,
    at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expo_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expo_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_reports (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    engineer_id uuid,
    findings text,
    root_cause text,
    work_done text,
    recommendation text,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    parts_used jsonb DEFAULT '[]'::jsonb NOT NULL,
    labour_hrs numeric(5,2) DEFAULT 0,
    travel_hrs numeric(5,2) DEFAULT 0,
    cable_test_results jsonb DEFAULT '[]'::jsonb,
    client_name text,
    client_signature text,
    signed_at timestamp with time zone,
    submit_lat numeric(10,7),
    submit_lng numeric(10,7),
    pdf_url text,
    pdf_generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onsite_time text,
    offsite_time text,
    job_status text,
    remarks text,
    reported_by text,
    reported_date text,
    engineer_signature text,
    client_date text,
    custom_field_values jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE job_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_reports IS 'Completed work record filled by engineer on site — one per ticket';


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days numeric(4,1) DEFAULT 1 NOT NULL,
    reason text,
    supporting_doc_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meeting_minutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_minutes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    meeting_date date NOT NULL,
    location text,
    attendees text,
    agenda text,
    minutes text,
    action_items text,
    next_meeting_date date,
    recurrence text DEFAULT 'none'::text NOT NULL,
    prepared_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meeting_minutes_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text])))
);


--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    logo_url text,
    address text,
    phone text,
    email text,
    timezone text DEFAULT 'Asia/Kuala_Lumpur'::text NOT NULL,
    currency text DEFAULT 'MYR'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    report_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    procurement_email text,
    sales_email text,
    brand_color text DEFAULT '#f97316'::text NOT NULL,
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_sla jsonb DEFAULT '{"P1": {"resolve": 4, "response": 1}, "P2": {"resolve": 8, "response": 2}, "P3": {"resolve": 24, "response": 4}, "P4": {"resolve": 48, "response": 8}}'::jsonb NOT NULL,
    intake_questions jsonb DEFAULT '{}'::jsonb NOT NULL,
    hr_email text,
    hod_email text,
    attendance_photo_required boolean DEFAULT true NOT NULL,
    attendance_break_minutes integer DEFAULT 60 NOT NULL,
    pm_check_items jsonb DEFAULT '[{"key": "cleaned", "label": "Device Cleaned"}, {"key": "power_ok", "label": "Power Supply OK"}, {"key": "functional", "label": "Functioning Normally"}]'::jsonb NOT NULL,
    smtp_host text,
    smtp_port integer,
    smtp_secure boolean DEFAULT false,
    smtp_user text,
    smtp_pass text,
    smtp_from text
);


--
-- Name: TABLE organisations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organisations IS 'Your company — top-level tenant for all data';


--
-- Name: COLUMN organisations.report_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organisations.report_settings IS 'FSR PDF customisation: report_title, color_theme, section_labels, ack_labels, show_* flags';


--
-- Name: part_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid,
    engineer_id uuid,
    equipment_description text NOT NULL,
    request_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    items jsonb,
    requested_by uuid,
    ready_note text,
    ready_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    CONSTRAINT part_requests_source_chk CHECK (((ticket_id IS NOT NULL) OR (project_id IS NOT NULL)))
);


--
-- Name: parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    name text NOT NULL,
    part_no text,
    brand text,
    unit text DEFAULT 'pcs'::text NOT NULL,
    unit_cost numeric(10,2),
    stock_qty numeric(10,2) DEFAULT 0 NOT NULL,
    min_stock_qty numeric(10,2) DEFAULT 0,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE parts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.parts IS 'Spare parts and consumables inventory';


--
-- Name: pm_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_reports (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    schedule_id uuid NOT NULL,
    site_id uuid,
    system_id uuid,
    engineer_id uuid,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    summary text,
    status text DEFAULT 'draft'::text NOT NULL,
    devices jsonb DEFAULT '[]'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    engineer_name text,
    engineer_date date,
    engineer_signature text,
    client_name text,
    client_date date,
    client_signature text,
    service_engineers jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: TABLE pm_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pm_reports IS 'PM visit reports generated from a pm_schedule; snapshots covered devices';


--
-- Name: pm_schedule_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_schedule_devices (
    schedule_id uuid NOT NULL,
    device_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE pm_schedule_devices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pm_schedule_devices IS '12b — devices covered by a PM schedule; empty = whole system';


--
-- Name: pm_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pm_schedules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    site_id uuid NOT NULL,
    system_id uuid,
    contract_id uuid,
    name text NOT NULL,
    ticket_type public.ticket_type DEFAULT 'preventive_maintenance'::public.ticket_type NOT NULL,
    interval_days integer DEFAULT 90 NOT NULL,
    last_run_at timestamp with time zone,
    next_due_at timestamp with time zone,
    assigned_to uuid,
    checklist_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE pm_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pm_schedules IS 'Recurring PM schedule rules — app auto-generates tickets when next_due_at is reached';


--
-- Name: project_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    member_role public.project_member_role DEFAULT 'member'::public.project_member_role NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    item_no integer NOT NULL,
    title text NOT NULL,
    status public.milestone_status DEFAULT 'pending'::public.milestone_status NOT NULL,
    completion_date date,
    category public.milestone_category NOT NULL,
    priority public.milestone_priority DEFAULT 'Medium'::public.milestone_priority NOT NULL,
    notes text,
    ref_doc text,
    percent_done integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_milestones_percent_done_check CHECK (((percent_done >= 0) AND (percent_done <= 100)))
);


--
-- Name: project_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_surveys (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    surveyed_by text,
    survey_date date,
    building_type text,
    total_floors integer,
    total_area_sqft numeric(10,2),
    access_notes text,
    power_supply text,
    power_notes text,
    network_available boolean DEFAULT false,
    network_notes text,
    cable_route_notes text,
    systems_scope jsonb DEFAULT '[]'::jsonb,
    areas jsonb DEFAULT '[]'::jsonb,
    photos jsonb DEFAULT '[]'::jsonb,
    remarks text,
    prepared_by text,
    prepared_date text,
    client_name text,
    client_date text,
    engineer_signature text,
    client_signature text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    acs_survey jsonb
);


--
-- Name: project_tnc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tnc (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    scope_items jsonb DEFAULT '[]'::jsonb,
    exclusions jsonb DEFAULT '[]'::jsonb,
    warranty_months integer DEFAULT 12,
    defect_liability_months integer DEFAULT 12,
    payment_terms text,
    special_conditions text,
    prepared_by text,
    prepared_date text,
    client_name text,
    client_date text,
    engineer_signature text,
    client_signature text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_uat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_uat (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    tested_by text,
    test_date date,
    test_items jsonb DEFAULT '[]'::jsonb,
    overall_result text DEFAULT 'pending'::text,
    remarks text,
    prepared_by text,
    prepared_date text,
    client_name text,
    client_date text,
    engineer_signature text,
    client_signature text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    client_id uuid NOT NULL,
    site_id uuid,
    name text NOT NULL,
    project_no text,
    description text,
    status text DEFAULT 'planning'::text NOT NULL,
    value numeric(12,2),
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qr_scan_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_scan_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tier public.qr_tier NOT NULL,
    ref_id uuid NOT NULL,
    scanned_by uuid,
    ticket_id uuid,
    ip_address text,
    user_agent text,
    lat numeric(10,7),
    lng numeric(10,7),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE qr_scan_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qr_scan_logs IS 'Audit log of every QR code scan — tier, location, and resulting ticket';


--
-- Name: settings_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    changes jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: site_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    title text,
    phone text,
    email text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    contract_id uuid,
    name text NOT NULL,
    address text,
    postcode text,
    city text,
    state text,
    lat numeric(10,7),
    lng numeric(10,7),
    floors integer DEFAULT 1,
    site_contact text,
    site_phone text,
    access_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contract_type text,
    contract_start date,
    contract_end date,
    pm_classification text,
    CONSTRAINT sites_contract_type_check CHECK ((contract_type = ANY (ARRAY['dlp'::text, 'maintenance'::text]))),
    CONSTRAINT sites_pm_classification_check CHECK (((pm_classification IS NULL) OR (pm_classification = ANY (ARRAY['comprehensive'::text, 'non_comprehensive'::text]))))
);


--
-- Name: TABLE sites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sites IS 'Physical client locations where ELV systems are installed';


--
-- Name: standby_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standby_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_date date NOT NULL,
    user_id uuid NOT NULL,
    shift text DEFAULT 'all_day'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT standby_schedule_shift_check CHECK ((shift = ANY (ARRAY['all_day'::text, 'morning'::text, 'afternoon'::text, 'night'::text])))
);


--
-- Name: standby_weeks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standby_weeks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    week_start date NOT NULL,
    user_id uuid NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE standby_weeks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.standby_weeks IS 'Weekly standby roster — week_start is the Monday; multiple users per week allowed';


--
-- Name: ticket_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_activities (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    actor_id uuid,
    action public.activity_action NOT NULL,
    old_value text,
    new_value text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ticket_activities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ticket_activities IS 'Full audit trail — every status change, note, and action per ticket';


--
-- Name: ticket_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_groups (
    ticket_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: ticket_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid NOT NULL,
    ticket_no text NOT NULL,
    site_id uuid NOT NULL,
    system_id uuid,
    device_id uuid,
    contract_id uuid,
    assigned_to uuid,
    created_by uuid,
    type public.ticket_type DEFAULT 'breakdown'::public.ticket_type NOT NULL,
    priority public.ticket_priority DEFAULT 'P3'::public.ticket_priority NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    title text NOT NULL,
    description text,
    reporter_name text,
    reporter_phone text,
    reporter_email text,
    sla_response_due timestamp with time zone,
    sla_resolve_due timestamp with time zone,
    sla_response_met boolean,
    sla_resolve_met boolean,
    is_chargeable boolean DEFAULT false NOT NULL,
    assigned_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    started_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    source_qr_tier public.qr_tier,
    source_qr_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    eta_at timestamp with time zone,
    group_id uuid,
    work_status text DEFAULT 'not_started'::text NOT NULL,
    work_seconds integer DEFAULT 0 NOT NULL,
    work_last_resume_at timestamp with time zone,
    work_started_at timestamp with time zone,
    work_completed_at timestamp with time zone,
    quotation_no text,
    intake_answers jsonb
);


--
-- Name: TABLE tickets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tickets IS 'Core entity — every job, fault report, PM visit, and installation';


--
-- Name: user_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_teams (
    user_id uuid NOT NULL,
    team text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organisation_id uuid,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    role public.user_role DEFAULT 'engineer'::public.user_role NOT NULL,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'All app users — engineers, managers, admins, and client portal users';


--
-- Name: v_device_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_device_history WITH (security_invoker='true') AS
 SELECT d.id AS device_id,
    d.tag_id,
    d.name AS device_name,
    d.device_type,
    d.model,
    d.serial_no,
    d.ip_address,
    d.location_desc,
    d.floor,
    d.meta,
    t.id AS ticket_id,
    t.ticket_no,
    t.type AS job_type,
    t.priority,
    t.status,
    t.title,
    t.created_at AS job_date,
    t.closed_at,
    jr.work_done,
    jr.findings,
    u.full_name AS engineer_name
   FROM ((((public.devices d
     LEFT JOIN public.tickets t ON ((t.device_id = d.id)))
     LEFT JOIN public.job_reports jr ON ((jr.ticket_id = t.id)))
     LEFT JOIN public.engineers e ON ((e.id = jr.engineer_id)))
     LEFT JOIN public.users u ON ((u.id = e.user_id)))
  ORDER BY d.id, t.created_at DESC;


--
-- Name: VIEW v_device_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_device_history IS 'Device detail with full service history — used when engineer scans QR';


--
-- Name: v_engineer_workload; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_engineer_workload WITH (security_invoker='true') AS
 SELECT e.id AS engineer_id,
    u.full_name,
    u.phone,
    e.is_available,
    e.skills,
    e.certifications,
    count(t.id) FILTER (WHERE (t.status = ANY (ARRAY['assigned'::public.ticket_status, 'in_progress'::public.ticket_status]))) AS active_jobs,
    sum(COALESCE(jr.labour_hrs, (2)::numeric)) FILTER (WHERE ((t.status = ANY (ARRAY['assigned'::public.ticket_status, 'in_progress'::public.ticket_status])) AND (date(t.created_at) = CURRENT_DATE))) AS estimated_hrs_today,
    e.daily_capacity_hr,
    round(((100.0 * COALESCE(sum(COALESCE(jr.labour_hrs, (2)::numeric)) FILTER (WHERE ((t.status = ANY (ARRAY['assigned'::public.ticket_status, 'in_progress'::public.ticket_status])) AND (date(t.created_at) = CURRENT_DATE))), (0)::numeric)) / (NULLIF(e.daily_capacity_hr, 0))::numeric), 1) AS load_pct
   FROM (((public.engineers e
     JOIN public.users u ON ((u.id = e.user_id)))
     LEFT JOIN public.tickets t ON ((t.assigned_to = e.id)))
     LEFT JOIN public.job_reports jr ON ((jr.ticket_id = t.id)))
  WHERE (u.is_active = true)
  GROUP BY e.id, u.full_name, u.phone, e.is_available, e.skills, e.certifications, e.daily_capacity_hr;


--
-- Name: VIEW v_engineer_workload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_engineer_workload IS 'Real-time engineer workload for dispatch board and auto-assignment';


--
-- Name: v_open_tickets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_open_tickets WITH (security_invoker='true') AS
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
    u.phone AS engineer_phone
   FROM ((((public.tickets t
     LEFT JOIN public.sites s ON ((s.id = t.site_id)))
     LEFT JOIN public.clients c ON ((c.id = s.client_id)))
     LEFT JOIN public.engineers e ON ((e.id = t.assigned_to)))
     LEFT JOIN public.users u ON ((u.id = e.user_id)))
  WHERE (t.status <> ALL (ARRAY['closed'::public.ticket_status, 'cancelled'::public.ticket_status]));


--
-- Name: VIEW v_open_tickets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_open_tickets IS 'All open tickets with SLA breach status — for manager dashboard';


--
-- Name: app_templates app_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_templates
    ADD CONSTRAINT app_templates_pkey PRIMARY KEY (id);


--
-- Name: attendance_checkins attendance_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_checkins
    ADD CONSTRAINT attendance_checkins_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: client_users client_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_pkey PRIMARY KEY (id);


--
-- Name: client_users client_users_user_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_user_id_client_id_key UNIQUE (user_id, client_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_equipment company_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_equipment
    ADD CONSTRAINT company_equipment_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_tag_id_key UNIQUE (tag_id);


--
-- Name: elv_systems elv_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elv_systems
    ADD CONSTRAINT elv_systems_pkey PRIMARY KEY (id);


--
-- Name: engineer_group_members engineer_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_group_members
    ADD CONSTRAINT engineer_group_members_pkey PRIMARY KEY (group_id, engineer_id);


--
-- Name: engineer_groups engineer_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_groups
    ADD CONSTRAINT engineer_groups_pkey PRIMARY KEY (id);


--
-- Name: engineers engineers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineers
    ADD CONSTRAINT engineers_pkey PRIMARY KEY (id);


--
-- Name: engineers engineers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineers
    ADD CONSTRAINT engineers_user_id_key UNIQUE (user_id);


--
-- Name: equipment_bookings equipment_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_bookings
    ADD CONSTRAINT equipment_bookings_pkey PRIMARY KEY (id);


--
-- Name: equipment_log equipment_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_log
    ADD CONSTRAINT equipment_log_pkey PRIMARY KEY (id);


--
-- Name: expo_push_tokens expo_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: expo_push_tokens expo_push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_token_key UNIQUE (token);


--
-- Name: job_reports job_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_reports
    ADD CONSTRAINT job_reports_pkey PRIMARY KEY (id);


--
-- Name: job_reports job_reports_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_reports
    ADD CONSTRAINT job_reports_ticket_id_key UNIQUE (ticket_id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: meeting_minutes meeting_minutes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);


--
-- Name: part_requests part_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: pm_reports pm_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_reports
    ADD CONSTRAINT pm_reports_pkey PRIMARY KEY (id);


--
-- Name: pm_schedule_devices pm_schedule_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedule_devices
    ADD CONSTRAINT pm_schedule_devices_pkey PRIMARY KEY (schedule_id, device_id);


--
-- Name: pm_schedules pm_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_surveys project_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_surveys
    ADD CONSTRAINT project_surveys_pkey PRIMARY KEY (id);


--
-- Name: project_surveys project_surveys_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_surveys
    ADD CONSTRAINT project_surveys_project_id_key UNIQUE (project_id);


--
-- Name: project_tnc project_tnc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tnc
    ADD CONSTRAINT project_tnc_pkey PRIMARY KEY (id);


--
-- Name: project_tnc project_tnc_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tnc
    ADD CONSTRAINT project_tnc_project_id_key UNIQUE (project_id);


--
-- Name: project_uat project_uat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_uat
    ADD CONSTRAINT project_uat_pkey PRIMARY KEY (id);


--
-- Name: project_uat project_uat_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_uat
    ADD CONSTRAINT project_uat_project_id_key UNIQUE (project_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_no_key UNIQUE (project_no);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: qr_scan_logs qr_scan_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_scan_logs
    ADD CONSTRAINT qr_scan_logs_pkey PRIMARY KEY (id);


--
-- Name: settings_audit_log settings_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_audit_log
    ADD CONSTRAINT settings_audit_log_pkey PRIMARY KEY (id);


--
-- Name: site_contacts site_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_contacts
    ADD CONSTRAINT site_contacts_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: standby_schedule standby_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_schedule
    ADD CONSTRAINT standby_schedule_pkey PRIMARY KEY (id);


--
-- Name: standby_weeks standby_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_weeks
    ADD CONSTRAINT standby_weeks_pkey PRIMARY KEY (id);


--
-- Name: standby_weeks standby_weeks_week_start_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_weeks
    ADD CONSTRAINT standby_weeks_week_start_user_id_key UNIQUE (week_start, user_id);


--
-- Name: ticket_activities ticket_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT ticket_activities_pkey PRIMARY KEY (id);


--
-- Name: ticket_groups ticket_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_groups
    ADD CONSTRAINT ticket_groups_pkey PRIMARY KEY (ticket_id, group_id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_no_key UNIQUE (ticket_no);


--
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY (user_id, team);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_activities_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_created ON public.ticket_activities USING btree (created_at DESC);


--
-- Name: idx_activities_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_ticket ON public.ticket_activities USING btree (ticket_id);


--
-- Name: idx_attendance_checkin_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_checkin_at ON public.attendance_checkins USING btree (check_in_at);


--
-- Name: idx_attendance_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_engineer ON public.attendance_checkins USING btree (engineer_id);


--
-- Name: idx_attendance_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_site ON public.attendance_checkins USING btree (site_id);


--
-- Name: idx_checklist_tpl_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_tpl_org ON public.checklist_templates USING btree (organisation_id);


--
-- Name: idx_checklist_tpl_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_tpl_type ON public.checklist_templates USING btree (system_type, ticket_type);


--
-- Name: idx_claims_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_status ON public.claims USING btree (status);


--
-- Name: idx_claims_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claims_user ON public.claims USING btree (user_id);


--
-- Name: idx_client_users_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_users_client ON public.client_users USING btree (client_id);


--
-- Name: idx_client_users_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_users_user ON public.client_users USING btree (user_id);


--
-- Name: idx_clients_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_org ON public.clients USING btree (organisation_id);


--
-- Name: idx_contracts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_active ON public.contracts USING btree (is_active, end_date);


--
-- Name: idx_contracts_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_client ON public.contracts USING btree (client_id);


--
-- Name: idx_devices_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_meta ON public.devices USING gin (meta);


--
-- Name: idx_devices_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_project ON public.devices USING btree (project_id);


--
-- Name: idx_devices_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_system ON public.devices USING btree (system_id);


--
-- Name: idx_devices_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_tag ON public.devices USING btree (tag_id);


--
-- Name: idx_devices_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_type ON public.devices USING btree (device_type);


--
-- Name: idx_elv_systems_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_elv_systems_site ON public.elv_systems USING btree (site_id);


--
-- Name: idx_elv_systems_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_elv_systems_type ON public.elv_systems USING btree (type);


--
-- Name: idx_engineers_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineers_available ON public.engineers USING btree (is_available);


--
-- Name: idx_engineers_skills; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineers_skills ON public.engineers USING gin (skills);


--
-- Name: idx_engineers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineers_user ON public.engineers USING btree (user_id);


--
-- Name: idx_eq_bookings_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eq_bookings_dates ON public.equipment_bookings USING btree (from_date, to_date);


--
-- Name: idx_eq_bookings_eq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eq_bookings_eq ON public.equipment_bookings USING btree (equipment_id);


--
-- Name: idx_equipment_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_assigned ON public.company_equipment USING btree (assigned_to);


--
-- Name: idx_equipment_log_eq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_log_eq ON public.equipment_log USING btree (equipment_id);


--
-- Name: idx_equipment_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_org ON public.company_equipment USING btree (organisation_id);


--
-- Name: idx_expo_push_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expo_push_tokens_user ON public.expo_push_tokens USING btree (user_id);


--
-- Name: idx_job_reports_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_reports_engineer ON public.job_reports USING btree (engineer_id);


--
-- Name: idx_job_reports_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_reports_ticket ON public.job_reports USING btree (ticket_id);


--
-- Name: idx_leave_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_user ON public.leave_requests USING btree (user_id);


--
-- Name: idx_meeting_minutes_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_minutes_project ON public.meeting_minutes USING btree (project_id);


--
-- Name: idx_part_requests_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_project ON public.part_requests USING btree (project_id);


--
-- Name: idx_part_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_status ON public.part_requests USING btree (status);


--
-- Name: idx_part_requests_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_part_requests_ticket ON public.part_requests USING btree (ticket_id);


--
-- Name: idx_parts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parts_org ON public.parts USING btree (organisation_id);


--
-- Name: idx_pm_reports_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_reports_schedule ON public.pm_reports USING btree (schedule_id);


--
-- Name: idx_pm_schedule_devices_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_schedule_devices_device ON public.pm_schedule_devices USING btree (device_id);


--
-- Name: idx_pm_schedules_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_schedules_due ON public.pm_schedules USING btree (next_due_at, is_active);


--
-- Name: idx_pm_schedules_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_schedules_site ON public.pm_schedules USING btree (site_id);


--
-- Name: idx_project_assignments_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_project ON public.project_assignments USING btree (project_id);


--
-- Name: idx_project_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_user ON public.project_assignments USING btree (user_id);


--
-- Name: idx_project_milestones_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_milestones_project ON public.project_milestones USING btree (project_id);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_qr_scans_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_scans_created ON public.qr_scan_logs USING btree (created_at DESC);


--
-- Name: idx_qr_scans_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_scans_ref ON public.qr_scan_logs USING btree (tier, ref_id);


--
-- Name: idx_settings_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_audit_created ON public.settings_audit_log USING btree (created_at DESC);


--
-- Name: idx_site_contacts_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_contacts_site ON public.site_contacts USING btree (site_id);


--
-- Name: idx_sites_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_client ON public.sites USING btree (client_id);


--
-- Name: idx_sites_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_contract ON public.sites USING btree (contract_id);


--
-- Name: idx_standby_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standby_date ON public.standby_schedule USING btree (schedule_date);


--
-- Name: idx_standby_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standby_month ON public.standby_schedule USING btree (EXTRACT(year FROM schedule_date), EXTRACT(month FROM schedule_date));


--
-- Name: idx_standby_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standby_user ON public.standby_schedule USING btree (user_id);


--
-- Name: idx_standby_weeks_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standby_weeks_start ON public.standby_weeks USING btree (week_start);


--
-- Name: idx_standby_weeks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standby_weeks_user ON public.standby_weeks USING btree (user_id);


--
-- Name: idx_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_org ON public.app_templates USING btree (organisation_id);


--
-- Name: idx_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_type ON public.app_templates USING btree (template_type);


--
-- Name: idx_tickets_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned ON public.tickets USING btree (assigned_to);


--
-- Name: idx_tickets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_created ON public.tickets USING btree (created_at DESC);


--
-- Name: idx_tickets_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_device ON public.tickets USING btree (device_id);


--
-- Name: idx_tickets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_org ON public.tickets USING btree (organisation_id);


--
-- Name: idx_tickets_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_priority ON public.tickets USING btree (priority);


--
-- Name: idx_tickets_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_site ON public.tickets USING btree (site_id);


--
-- Name: idx_tickets_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sla ON public.tickets USING btree (sla_resolve_due, status);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_user_teams_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_teams_team ON public.user_teams USING btree (team);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_org ON public.users USING btree (organisation_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: uq_standby_user_date_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_standby_user_date_shift ON public.standby_schedule USING btree (user_id, schedule_date, shift);


--
-- Name: checklist_templates trg_checklist_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clients trg_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contracts trg_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: devices trg_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: elv_systems trg_elv_systems_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_elv_systems_updated_at BEFORE UPDATE ON public.elv_systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: engineers trg_engineers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_engineers_updated_at BEFORE UPDATE ON public.engineers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: job_reports trg_job_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_job_reports_updated_at BEFORE UPDATE ON public.job_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organisations trg_organisations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organisations_updated_at BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: parts trg_parts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pm_reports trg_pm_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pm_reports_updated_at BEFORE UPDATE ON public.pm_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pm_schedules trg_pm_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pm_schedules_updated_at BEFORE UPDATE ON public.pm_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects trg_project_no; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_no BEFORE INSERT ON public.projects FOR EACH ROW WHEN (((new.project_no IS NULL) OR (new.project_no = ''::text))) EXECUTE FUNCTION public.generate_project_no();


--
-- Name: sites trg_sites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tickets trg_sla_due_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sla_due_dates BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_sla_due_dates();


--
-- Name: tickets trg_ticket_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ticket_activity AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();


--
-- Name: tickets trg_ticket_no; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ticket_no BEFORE INSERT ON public.tickets FOR EACH ROW WHEN (((new.ticket_no IS NULL) OR (new.ticket_no = ''::text))) EXECUTE FUNCTION public.generate_ticket_no();


--
-- Name: tickets trg_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_templates app_templates_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_templates
    ADD CONSTRAINT app_templates_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: attendance_checkins attendance_checkins_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_checkins
    ADD CONSTRAINT attendance_checkins_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE CASCADE;


--
-- Name: attendance_checkins attendance_checkins_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_checkins
    ADD CONSTRAINT attendance_checkins_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: checklist_templates checklist_templates_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: claims claims_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: claims claims_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: claims claims_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: claims claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: client_users client_users_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_users client_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_users
    ADD CONSTRAINT client_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clients clients_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: company_equipment company_equipment_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_equipment
    ADD CONSTRAINT company_equipment_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_equipment company_equipment_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_equipment
    ADD CONSTRAINT company_equipment_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: devices devices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: devices devices_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.elv_systems(id) ON DELETE CASCADE;


--
-- Name: elv_systems elv_systems_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elv_systems
    ADD CONSTRAINT elv_systems_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: engineer_group_members engineer_group_members_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_group_members
    ADD CONSTRAINT engineer_group_members_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE CASCADE;


--
-- Name: engineer_group_members engineer_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_group_members
    ADD CONSTRAINT engineer_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.engineer_groups(id) ON DELETE CASCADE;


--
-- Name: engineers engineers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineers
    ADD CONSTRAINT engineers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: equipment_bookings equipment_bookings_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_bookings
    ADD CONSTRAINT equipment_bookings_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.company_equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_bookings equipment_bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_bookings
    ADD CONSTRAINT equipment_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: equipment_log equipment_log_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_log
    ADD CONSTRAINT equipment_log_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.company_equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_log equipment_log_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_log
    ADD CONSTRAINT equipment_log_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: equipment_log equipment_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_log
    ADD CONSTRAINT equipment_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expo_push_tokens expo_push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tokens
    ADD CONSTRAINT expo_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_reports job_reports_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_reports
    ADD CONSTRAINT job_reports_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE SET NULL;


--
-- Name: job_reports job_reports_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_reports
    ADD CONSTRAINT job_reports_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: meeting_minutes meeting_minutes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_minutes
    ADD CONSTRAINT meeting_minutes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: part_requests part_requests_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: part_requests part_requests_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE SET NULL;


--
-- Name: part_requests part_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: part_requests part_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: part_requests part_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_requests
    ADD CONSTRAINT part_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: parts parts_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: pm_reports pm_reports_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_reports
    ADD CONSTRAINT pm_reports_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineers(id) ON DELETE SET NULL;


--
-- Name: pm_reports pm_reports_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_reports
    ADD CONSTRAINT pm_reports_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.pm_schedules(id) ON DELETE CASCADE;


--
-- Name: pm_reports pm_reports_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_reports
    ADD CONSTRAINT pm_reports_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: pm_reports pm_reports_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_reports
    ADD CONSTRAINT pm_reports_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.elv_systems(id) ON DELETE SET NULL;


--
-- Name: pm_schedule_devices pm_schedule_devices_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedule_devices
    ADD CONSTRAINT pm_schedule_devices_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- Name: pm_schedule_devices pm_schedule_devices_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedule_devices
    ADD CONSTRAINT pm_schedule_devices_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.pm_schedules(id) ON DELETE CASCADE;


--
-- Name: pm_schedules pm_schedules_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.engineers(id) ON DELETE SET NULL;


--
-- Name: pm_schedules pm_schedules_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.checklist_templates(id) ON DELETE SET NULL;


--
-- Name: pm_schedules pm_schedules_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: pm_schedules pm_schedules_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: pm_schedules pm_schedules_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.elv_systems(id) ON DELETE SET NULL;


--
-- Name: project_assignments project_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_surveys project_surveys_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_surveys
    ADD CONSTRAINT project_surveys_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tnc project_tnc_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tnc
    ADD CONSTRAINT project_tnc_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_uat project_uat_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_uat
    ADD CONSTRAINT project_uat_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: projects projects_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: projects projects_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: qr_scan_logs qr_scan_logs_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_scan_logs
    ADD CONSTRAINT qr_scan_logs_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: qr_scan_logs qr_scan_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_scan_logs
    ADD CONSTRAINT qr_scan_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: settings_audit_log settings_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_audit_log
    ADD CONSTRAINT settings_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_contacts site_contacts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_contacts
    ADD CONSTRAINT site_contacts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: sites sites_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: sites sites_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: standby_schedule standby_schedule_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_schedule
    ADD CONSTRAINT standby_schedule_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: standby_schedule standby_schedule_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_schedule
    ADD CONSTRAINT standby_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: standby_weeks standby_weeks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_weeks
    ADD CONSTRAINT standby_weeks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: standby_weeks standby_weeks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standby_weeks
    ADD CONSTRAINT standby_weeks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ticket_activities ticket_activities_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT ticket_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_activities ticket_activities_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT ticket_activities_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_groups ticket_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_groups
    ADD CONSTRAINT ticket_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.engineer_groups(id) ON DELETE CASCADE;


--
-- Name: ticket_groups ticket_groups_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_groups
    ADD CONSTRAINT ticket_groups_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.engineers(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.engineer_groups(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.elv_systems(id) ON DELETE SET NULL;


--
-- Name: user_teams user_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: client_users client_own_tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_own_tickets ON public.client_users USING ((user_id = auth.uid()));


--
-- Name: client_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: elv_systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.elv_systems ENABLE ROW LEVEL SECURITY;

--
-- Name: engineers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

--
-- Name: job_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations org_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_isolation ON public.organisations USING ((id = public.current_org_id()));


--
-- Name: checklist_templates org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.checklist_templates USING ((organisation_id = public.current_org_id()));


--
-- Name: clients org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.clients USING ((organisation_id = public.current_org_id()));


--
-- Name: contracts org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.contracts USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.organisation_id = public.current_org_id()))));


--
-- Name: devices org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.devices USING ((system_id IN ( SELECT elv_systems.id
   FROM public.elv_systems
  WHERE (elv_systems.site_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.client_id IN ( SELECT clients.id
                   FROM public.clients
                  WHERE (clients.organisation_id = public.current_org_id()))))))));


--
-- Name: elv_systems org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.elv_systems USING ((site_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.organisation_id = public.current_org_id()))))));


--
-- Name: engineers org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.engineers USING ((user_id IN ( SELECT users.id
   FROM public.users
  WHERE (users.organisation_id = public.current_org_id()))));


--
-- Name: job_reports org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.job_reports USING ((ticket_id IN ( SELECT tickets.id
   FROM public.tickets
  WHERE (tickets.organisation_id = public.current_org_id()))));


--
-- Name: parts org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.parts USING ((organisation_id = public.current_org_id()));


--
-- Name: pm_schedules org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.pm_schedules USING ((site_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.organisation_id = public.current_org_id()))))));


--
-- Name: qr_scan_logs org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.qr_scan_logs USING ((((tier = 'site'::public.qr_tier) AND (ref_id IN ( SELECT sites.id
   FROM public.sites
  WHERE (sites.client_id IN ( SELECT clients.id
           FROM public.clients
          WHERE (clients.organisation_id = public.current_org_id())))))) OR ((tier = 'system'::public.qr_tier) AND (ref_id IN ( SELECT elv_systems.id
   FROM public.elv_systems
  WHERE (elv_systems.site_id IN ( SELECT sites.id
           FROM public.sites
          WHERE (sites.client_id IN ( SELECT clients.id
                   FROM public.clients
                  WHERE (clients.organisation_id = public.current_org_id())))))))) OR ((tier = 'device'::public.qr_tier) AND (ref_id IN ( SELECT devices.id
   FROM public.devices
  WHERE (devices.system_id IN ( SELECT elv_systems.id
           FROM public.elv_systems
          WHERE (elv_systems.site_id IN ( SELECT sites.id
                   FROM public.sites
                  WHERE (sites.client_id IN ( SELECT clients.id
                           FROM public.clients
                          WHERE (clients.organisation_id = public.current_org_id()))))))))))));


--
-- Name: sites org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.sites USING ((client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.organisation_id = public.current_org_id()))));


--
-- Name: ticket_activities org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.ticket_activities USING ((ticket_id IN ( SELECT tickets.id
   FROM public.tickets
  WHERE (tickets.organisation_id = public.current_org_id()))));


--
-- Name: tickets org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.tickets USING ((organisation_id = public.current_org_id()));


--
-- Name: users org_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_scope ON public.users USING ((organisation_id = public.current_org_id()));


--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

--
-- Name: pm_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pm_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: qr_scan_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qr_scan_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- ── Storage buckets (public) ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('ticket-photos','ticket-photos',true),
  ('org-assets','org-assets',true),
  ('hr-docs','hr-docs',true),
  ('attendance-photos','attendance-photos',true)
ON CONFLICT (id) DO NOTHING;
