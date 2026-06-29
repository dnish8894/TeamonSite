export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'engineer' | 'client'
  phone: string | null
  avatar_url: string | null
}

export interface Site {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  site_contact: string | null
  site_phone: string | null
}

export interface Ticket {
  id: string
  ticket_no: string
  title: string
  description: string | null
  type: string
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: string
  created_at: string
  resolved_at: string | null
  sla_resolve_due: string | null
  sites: (Pick<Site, 'id' | 'name' | 'city'> & {
    pm_classification?: 'comprehensive' | 'non_comprehensive' | null
    contract_type?: string | null
    site_contacts?: { name: string; title: string | null; phone: string | null; is_primary: boolean }[]
  }) | null
  elv_systems: { id: string; name: string; type: string } | null
  devices: { name: string; tag_id: string | null; work_at_height: boolean; work_at_height_notes: string | null; warranty_expiry: string | null; vendor_warranty_end: string | null; under_contract?: boolean; last_service_date?: string | null } | null
  reporter_name: string | null
  reporter_phone: string | null
  quotation_no: string | null
  assigned_to: string | null
  work_status: 'not_started' | 'in_progress' | 'paused' | 'completed'
  work_seconds: number
  work_last_resume_at: string | null
  work_started_at: string | null
  work_completed_at: string | null
  created_by_user: { full_name: string } | null
}

export interface Part {
  device: string
  qty: string
  model: string
  serial_no: string
  remarks: string
}

export interface ReportPhoto {
  url: string
  label: 'before' | 'after'
  caption: string
  taken_at: string
}

export interface JobReport {
  id?: string
  ticket_id: string
  engineer_id: string | null
  findings: string | null
  root_cause: string | null
  work_done: string | null
  recommendation: string | null
  job_status: string | null
  remarks: string | null
  parts_used: Part[]
  reported_by: string | null
  reported_date: string | null
  engineer_signature: string | null
  client_name: string | null
  client_date: string | null
  client_signature: string | null
}

export interface TicketActivity {
  id: string
  ticket_id: string
  action: string
  note: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}
