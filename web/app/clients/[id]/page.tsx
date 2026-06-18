'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Wrench, Ticket, ChevronRight, Phone, Mail, FileText } from 'lucide-react'

interface Site {
  id: string; name: string; city: string | null; state: string | null
  is_active: boolean; site_contact: string | null; site_phone: string | null
  elv_systems: { id: string; type: string; name: string }[]
  tickets: { id: string; status: string }[]
}
interface Contract {
  id: string; contract_no: string | null; type: string
  start_date: string; end_date: string
  sla_response_hr: number; sla_resolve_hr: number; is_active: boolean
}
interface Client {
  id: string; name: string; type: string
  registration_no: string | null; address: string | null
  contact_name: string | null; contact_email: string | null; contact_phone: string | null
  notes: string | null; is_active: boolean; created_at: string
  sites: Site[]
  contracts: Contract[]
}

const TYPE_COLOR: Record<string, string> = {
  government: 'var(--color-info)', commercial: 'var(--color-success)',
  industrial: 'var(--color-warning)', residential: 'var(--text-muted)',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(d => { setClient(d); setLoading(false) })
  }, [id])

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading...</div>
  if (!client)  return <div className="p-8" style={{ color: 'var(--color-danger)' }}>Client not found.</div>

  const openTickets = client.sites.reduce((sum, s) => sum + s.tickets.filter(t => !['closed','cancelled'].includes(t.status)).length, 0)
  const typeColor   = TYPE_COLOR[client.type] ?? 'var(--text-muted)'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/clients')}
        className="flex items-center gap-2 text-sm mb-5"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-base)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={16} /> Back to Clients
      </button>

      {/* Header */}
      <div className="rounded-xl border p-6 mb-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                style={{ color: typeColor, background: 'var(--bg-base)' }}>{client.type}</span>
              {!client.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>Inactive</span>
              )}
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{client.name}</h1>
            {client.registration_no && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-subtle)' }}>Reg: {client.registration_no}</p>
            )}
            {client.address && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{client.address}</p>
            )}
          </div>
          <div className="space-y-1 text-sm">
            {client.contact_name && (
              <p className="font-medium" style={{ color: 'var(--text-base)' }}>{client.contact_name}</p>
            )}
            {client.contact_phone && (
              <p className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Phone size={13} /> {client.contact_phone}
              </p>
            )}
            {client.contact_email && (
              <p className="flex items-center gap-1.5" style={{ color: 'var(--color-info)' }}>
                <Mail size={13} /> {client.contact_email}
              </p>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Sites',          value: client.sites.length,           color: 'var(--color-info)'    },
            { label: 'Active Contracts', value: client.contracts.filter(c => c.is_active).length, color: 'var(--color-success)' },
            { label: 'Open Tickets',   value: openTickets,                   color: openTickets > 0 ? 'var(--color-warning)' : 'var(--text-subtle)' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-base)' }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sites list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>
            Sites <span className="text-sm font-normal" style={{ color: 'var(--text-subtle)' }}>({client.sites.length})</span>
          </h2>
          {client.sites.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <MapPin size={24} style={{ color: 'var(--text-subtle)', margin: '0 auto 8px' }} />
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No sites yet.</p>
              <button onClick={() => router.push('/sites')} className="text-xs mt-2 underline" style={{ color: 'var(--color-info)' }}>
                Add a site
              </button>
            </div>
          ) : client.sites.map(site => {
            const openT = site.tickets.filter(t => !['closed','cancelled'].includes(t.status)).length
            return (
              <div key={site.id}
                className="rounded-xl border p-4 cursor-pointer transition-all"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                onClick={() => router.push(`/sites/${site.id}`)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-info)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} style={{ color: 'var(--color-info)' }} />
                      <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{site.name}</span>
                      {!site.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>Inactive</span>
                      )}
                    </div>
                    {(site.city || site.state) && (
                      <p className="text-xs mt-0.5 ml-5" style={{ color: 'var(--text-subtle)' }}>
                        {[site.city, site.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {site.site_contact && (
                      <p className="text-xs mt-0.5 ml-5" style={{ color: 'var(--text-subtle)' }}>
                        {site.site_contact} {site.site_phone}
                      </p>
                    )}
                    {/* Systems badges */}
                    {site.elv_systems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-5">
                        {site.elv_systems.map(sys => (
                          <span key={sys.id} className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                            {sys.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {openT > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: 'var(--color-warning)' }}>
                        <Ticket size={11} /> {openT}
                      </span>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contracts + notes */}
        <div className="space-y-4">
          {/* Contracts */}
          <div>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text-base)' }}>
              Contracts <span className="text-sm font-normal" style={{ color: 'var(--text-subtle)' }}>({client.contracts.length})</span>
            </h2>
            {client.contracts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No contracts.</p>
            ) : client.contracts.map(ct => (
              <div key={ct.id} className="rounded-xl border p-4 mb-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
                    {ct.contract_no ?? 'Contract'}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={ct.is_active
                      ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                      : { background: 'var(--border)', color: 'var(--text-subtle)' }}>
                    {ct.is_active ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div className="space-y-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                  <p className="capitalize">{ct.type.replace(/_/g,' ')}</p>
                  <p>{ct.start_date} → {ct.end_date}</p>
                  <p>Response: {ct.sla_response_hr}h · Resolve: {ct.sla_resolve_hr}h</p>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>Notes</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
