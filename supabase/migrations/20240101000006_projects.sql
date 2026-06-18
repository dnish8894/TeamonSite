CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  project_no      TEXT UNIQUE,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'planning',
  value           NUMERIC(12,2),
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  surveyed_by TEXT, survey_date DATE, building_type TEXT,
  total_floors INTEGER, total_area_sqft NUMERIC(10,2),
  access_notes TEXT, power_supply TEXT, power_notes TEXT,
  network_available BOOLEAN DEFAULT FALSE, network_notes TEXT,
  cable_route_notes TEXT, systems_scope JSONB DEFAULT '[]',
  areas JSONB DEFAULT '[]', photos JSONB DEFAULT '[]', remarks TEXT,
  prepared_by TEXT, prepared_date TEXT, client_name TEXT, client_date TEXT,
  engineer_signature TEXT, client_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_tnc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  scope_items JSONB DEFAULT '[]', exclusions JSONB DEFAULT '[]',
  warranty_months INTEGER DEFAULT 12, defect_liability_months INTEGER DEFAULT 12,
  payment_terms TEXT, special_conditions TEXT,
  prepared_by TEXT, prepared_date TEXT, client_name TEXT, client_date TEXT,
  engineer_signature TEXT, client_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_uat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  tested_by TEXT, test_date DATE, test_items JSONB DEFAULT '[]',
  overall_result TEXT DEFAULT 'pending', remarks TEXT,
  prepared_by TEXT, prepared_date TEXT, client_name TEXT, client_date TEXT,
  engineer_signature TEXT, client_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE project_seq START 1;

CREATE OR REPLACE FUNCTION generate_project_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.project_no := 'PRJ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('project_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_no
  BEFORE INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.project_no IS NULL OR NEW.project_no = '')
  EXECUTE FUNCTION generate_project_no();
