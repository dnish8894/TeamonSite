'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NewTicketForm from '@/components/forms/NewTicketForm'
import { AlertTriangle, Clock, Plus } from 'lucide-react'

// Uses CSS variables so colours adapt to dark/light theme
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open:           { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  assigned:       { color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)'   },
  in_progress:    { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  pending_parts:  { color: '#a78bfa',              bg: 'rgba(167,139,250,0.12)'  },
  pending_client: { color: 'var(--text-muted)',    bg: 'var(--border)'           },
  resolved:       { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
}

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  P1: { color: '#fff',    bg: 'var(--color-danger)'  },
  P2: { color: '#fff',    bg: 'var(--color-warning)'  },
  P3: { color: '#000',    bg: '#facc15'               },
  P4: { color: '#fff',    bg: '#64748b'               },
}

interface Ticket {
  id: string
  ticket_no: string
  title: string
  type: string
  priority: string
  status: string
  is_sla_breached: boolean
  hours_remaining: number | null
  site_name: string
  client_name: string
  engineer_name: string | null
  created_at: string
}

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)

  async function load() {
    const res = await fetch('/api/tickets')
    const data = await res.json()
    setTickets(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all'
    ? tickets
    : filter === 'breached'
    ? tickets.filter(t => t.is_sla_breached)
    : tickets.filter(t => t.priority === filter)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Tickets</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{tickets.length} open tickets</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all',     label: 'All' },
          { key: 'breached',label: 'SLA Breached' },
          { key: 'P1',      label: 'P1 Critical' },
          { key: 'P2',      label: 'P2 High' },
          { key: 'P3',      label: 'P3 Medium' },
          { key: 'P4',      label: 'P4 Low' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border"
            style={
              filter === key
                ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {showNew && <NewTicketForm onClose={() => setShowNew(false)} onSaved={load} />}

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-subtle)' }}>Loading tickets...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>No tickets found.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>Create your first ticket to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">Site / Client</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Engineer</th>
                <th className="px-4 py-3 font-semibold">SLA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const pStyle = PRIORITY_STYLE[ticket.priority]
                const sStyle = STATUS_STYLE[ticket.status] ?? STATUS_STYLE['open']
                return (
                  <tr key={ticket.id} className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--text-base)' }}>{ticket.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                        {ticket.ticket_no} · {ticket.type.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--text-base)' }}>{ticket.site_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{ticket.client_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold"
                        style={{ background: pStyle?.bg, color: pStyle?.color }}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ background: sStyle.bg, color: sStyle.color }}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {ticket.engineer_name ?? (
                        <span style={{ color: 'var(--text-subtle)' }}>Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ticket.is_sla_breached ? (
                        <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: 'var(--color-danger)' }}>
                          <AlertTriangle size={12} /> Breached
                        </span>
                      ) : ticket.hours_remaining != null ? (
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: 'var(--color-success)' }}>
                          <Clock size={12} /> {Math.round(ticket.hours_remaining)}h left
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>No SLA</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
