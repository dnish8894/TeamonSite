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
  sites: Pick<Site, 'id' | 'name' | 'city'> | null
  elv_systems: { id: string; name: string; type: string } | null
  reporter_name: string | null
  reporter_phone: string | null
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
