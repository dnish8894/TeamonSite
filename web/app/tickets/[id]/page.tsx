'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, Cpu, User, Clock, AlertTriangle,
  CheckCircle, Circle, Send, FileDown, Navigation
} from 'lucide-react'
import { Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import PhotoUpload from '@/components/tickets/PhotoUpload'
import JobReportForm from '@/components/tickets/JobReportForm'
import { generateJobReportPdf } from '@/lib/generateJobReportPdf'

/* ── Types ─────────────────────────────────────────── */
interface Ticket {
  id: string; ticket_no: string; title: string; description: string | null
  type: string; priority: string; status: string; is_chargeable: boolean
  reporter_name: string | null; reporter_phone: string | null
  sla_resolve_due: string | null; sla_response_due: string | null
  created_at: string; resolved_at: string | null
  source_qr_tier: string | null
  sites: { id: string; name: string; address: string | null; city: string | null; site_contact: string | null; site_phone: string | null; clients: { name: string; type: string } | null } | null
  elv_systems: { id: string; name: string; type: string } | null
  devices: { id: string; name: string; tag_id: string | null; device_type: string; model: string | null; location_desc: string | null; floor: number | null } | null
  engineers: { id: string; users: { full_name: string; phone: string | null } | null } | null
}
interface Activity {
  id: string; action: string; old_value: string | null; new_value: string | null
  note: string | null; created_at: string; users: { full_name: string } | null
}
interface Engineer { id: string; users: { full_name: string; phone: string | null } | null }

/* ── Constants ──────────────────────────────────────── */
const STATUSES = ['open','assigned','in_progress','pending_parts','pending_client','resolved','closed','cancelled']
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open:           { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  assigned:       { color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)'   },
  in_progress:    { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  pending_parts:  { color: '#a78bfa',              bg: 'rgba(167,139,250,0.12)'  },
  pending_client: { color: 'var(--text-muted)',    bg: 'var(--border)'           },
  resolved:       { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  closed:         { color: 'var(--text-subtle)',   bg: 'var(--border)'           },
  cancelled:      { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
}
const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  P1: { color: '#fff', bg: 'var(--color-danger)'  },
  P2: { color: '#fff', bg: 'var(--color-warning)' },
  P3: { color: '#000', bg: '#facc15'              },
  P4: { color: '#fff', bg: '#64748b'              },
}
const ACTION_ICONS: Record<string, React.ReactNode> = {
  status_changed: <Circle size={14} />,
  note_added:     <Send size={14} />,
  assigned:       <User size={14} />,
  created:        <CheckCircle size={14} />,
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [ticket, setTicket]       = useState<Ticket | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [loading, setLoading]     = useState(true)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [assignId, setAssignId]   = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [showEta, setShowEta]     = useState(false)
  const [etaDate, setEtaDate]     = useState('')
  const [etaTime, setEtaTime]     = useState('')
  const [etaSaving, setEtaSaving] = useState(false)

  async function load() {
    const [tRes, aRes, eRes] = await Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch(`/api/tickets/${id}/activities`),
      fetch('/api/engineers'),
    ])
    const t = await tRes.json()
    setTicket(t)
    setActivities(await aRes.json())
    setEngineers(await eRes.json())
    setAssignId(t?.engineers?.id ?? '')
    setNewStatus(t?.status ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveChanges() {
    if (!ticket) return
    setSaving(true)
    const body: Record<string, unknown> = {}
    if (newStatus !== ticket.status) body.status = newStatus
    if (assignId !== (ticket.engineers?.id ?? '')) {
      body.assigned_to = assignId || null
      if (assignId) body.status = 'assigned'
    }
    if (Object.keys(body).length > 0) {
      await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    load()
  }

  async function saveEta() {
    if (!etaDate || !etaTime) return
    setEtaSaving(true)
    const eta_at = new Date(`${etaDate}T${etaTime}`).toISOString()
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eta_at }),
    })
    setEtaSaving(false)
    setShowEta(false)
    load()
  }

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    await fetch(`/api/tickets/${id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    setNote('')
    setSaving(false)
    load()
  }

  async function downloadPdf() {
    setPdfLoading(true)
    const res = await fetch(`/api/tickets/${id}/pdf`)
    const data = await res.json()
    await generateJobReportPdf(data)
    setPdfLoading(false)
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading...</div>
  if (!ticket) return <div className="p-8" style={{ color: 'var(--color-danger)' }}>Ticket not found.</div>

  const pStyle = PRIORITY_STYLE[ticket.priority] ?? PRIORITY_STYLE.P3
  const sStyle = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.open
  const slaBreached = ticket.sla_resolve_due && new Date(ticket.sla_resolve_due) < new Date() && !['resolved','closed','cancelled'].includes(ticket.status)
  const hoursLeft = ticket.sla_resolve_due
    ? Math.round((new Date(ticket.sla_resolve_due).getTime() - Date.now()) / 3600000)
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back + Header */}
      <button onClick={() => router.push('/tickets')}
        className="flex items-center gap-2 text-sm mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-base)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={16} /> Back to Tickets
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono" style={{ color: 'var(--text-subtle)' }}>{ticket.ticket_no}</span>
            <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: pStyle.bg, color: pStyle.color }}>{ticket.priority}</span>
            <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: sStyle.bg, color: sStyle.color }}>{ticket.status.replace(/_/g, ' ')}</span>
            {ticket.source_qr_tier && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                via QR scan ({ticket.source_qr_tier})
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold mt-2" style={{ color: 'var(--text-base)' }}>{ticket.title}</h1>
          {ticket.description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{ticket.description}</p>
          )}
        </div>

        {/* Right side — SLA + PDF */}
        <div className="flex flex-col items-end gap-3">
          <button onClick={downloadPdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <FileDown size={15} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <div className="text-right text-sm">
            {slaBreached ? (
              <div className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={14} /> SLA Breached
              </div>
            ) : hoursLeft != null ? (
              <div className="flex items-center gap-1" style={{ color: hoursLeft < 4 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                <Clock size={14} /> {hoursLeft}h remaining
              </div>
            ) : null}
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
              Created {new Date(ticket.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — details */}
        <div className="lg:col-span-2 space-y-4">

          {/* Site & device info */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>Location</h2>
            {ticket.sites && (
              <div className="flex items-start gap-3">
                <MapPin size={16} style={{ color: 'var(--color-info)', marginTop: 2 }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-base)' }}>{ticket.sites.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{ticket.sites.clients?.name}</p>
                  {ticket.sites.address && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{[ticket.sites.address, ticket.sites.city].filter(Boolean).join(', ')}</p>}
                  {ticket.sites.site_contact && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Contact: {ticket.sites.site_contact} {ticket.sites.site_phone}</p>}
                </div>
              </div>
            )}
            {ticket.devices && (
              <div className="flex items-start gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <Cpu size={16} style={{ color: 'var(--color-success)', marginTop: 2 }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-base)' }}>{ticket.devices.name}</p>
                  <div className="flex gap-3 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    {ticket.devices.tag_id && <span className="font-mono">{ticket.devices.tag_id}</span>}
                    {ticket.devices.model && <span>{ticket.devices.model}</span>}
                    {ticket.devices.floor != null && <span>Level {ticket.devices.floor}</span>}
                    {ticket.devices.location_desc && <span>{ticket.devices.location_desc}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reporter */}
          {(ticket.reporter_name || ticket.reporter_phone) && (
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-subtle)' }}>Reported By</h2>
              <div className="flex items-center gap-3">
                <User size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ color: 'var(--text-base)' }}>{ticket.reporter_name ?? '—'}</p>
                  {ticket.reporter_phone && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{ticket.reporter_phone}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Activity log */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-subtle)' }}>Activity</h2>

            {/* Add note */}
            <div className="flex gap-3 mb-5">
              <textarea
                rows={2}
                className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none resize-none"
                style={{ background: 'var(--bg-base)', color: 'var(--text-base)', borderColor: 'var(--border)' }}
                placeholder="Add a note or update..."
                value={note}
                onChange={e => setNote(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <button onClick={addNote} disabled={!note.trim() || saving}
                className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                <Send size={15} />
              </button>
            </div>

            {/* Timeline */}
            {activities.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
                      {ACTION_ICONS[a.action] ?? <Circle size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm" style={{ color: 'var(--text-base)' }}>
                        {a.action === 'status_changed' && (
                          <span>Status changed to <strong>{a.new_value?.replace(/_/g, ' ')}</strong></span>
                        )}
                        {a.action === 'note_added' && <span>{a.note}</span>}
                        {a.action === 'assigned' && <span>Ticket assigned</span>}
                        {!['status_changed','note_added','assigned'].includes(a.action) && (
                          <span className="capitalize">{a.action.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                        {a.users?.full_name && `${a.users.full_name} · `}
                        {new Date(a.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Field Service Report Form */}
          <JobReportForm ticketId={id} onSaved={load} />

          {/* Photos */}
          <PhotoUpload ticketId={id} />
        </div>

        {/* Right — actions */}
        <div className="space-y-4">

          {/* Status & assignment */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>Actions</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status</label>
              <Select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Assigned Engineer</label>
              <Select value={assignId} onChange={e => setAssignId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {engineers.map(e => (
                  <option key={e.id} value={e.id}>{e.users?.full_name ?? 'Unknown'}</option>
                ))}
              </Select>
            </div>

            <Button className="w-full justify-center" loading={saving} onClick={saveChanges}>
              Save Changes
            </Button>
          </div>

          {/* ETA Card */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                  Engineer ETA
                </h2>
                {(ticket as unknown as { eta_at?: string }).eta_at && (
                  <p className="text-sm font-semibold mt-1" style={{ color: '#f97316' }}>
                    {new Date((ticket as unknown as { eta_at: string }).eta_at).toLocaleDateString('en-MY', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const existing = (ticket as unknown as { eta_at?: string }).eta_at
                  if (existing) {
                    const d = new Date(existing)
                    setEtaDate(d.toISOString().split('T')[0])
                    setEtaTime(d.toTimeString().slice(0,5))
                  } else {
                    setEtaDate(new Date().toISOString().split('T')[0])
                    setEtaTime('09:00')
                  }
                  setShowEta(v => !v)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#f97316', color: '#fff' }}>
                <Navigation size={13} />
                {(ticket as unknown as { eta_at?: string }).eta_at ? 'Update ETA' : 'Set ETA'}
              </button>
            </div>
            {showEta && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date</label>
                    <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-sm"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Time</label>
                    <input type="time" value={etaTime} onChange={e => setEtaTime(e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-sm"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }} />
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Client will receive a push notification with this ETA.
                </p>
                <div className="flex gap-2">
                  <button onClick={saveEta} disabled={etaSaving || !etaDate || !etaTime}
                    className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                    style={{ background: '#f97316', color: '#fff', opacity: etaSaving ? 0.6 : 1 }}>
                    {etaSaving ? 'Sending…' : 'Confirm & Notify Client'}
                  </button>
                  <button onClick={() => setShowEta(false)}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ticket meta */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-subtle)' }}>Details</h2>
            {[
              { label: 'Type',     value: ticket.type.replace(/_/g, ' ') },
              { label: 'Priority', value: ticket.priority },
              { label: 'Chargeable', value: ticket.is_chargeable ? 'Yes' : 'No' },
              { label: 'System',   value: ticket.elv_systems?.type?.replace(/_/g, ' ') ?? '—' },
              { label: 'SLA Due',  value: ticket.sla_resolve_due ? new Date(ticket.sla_resolve_due).toLocaleDateString('en-MY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—' },
              { label: 'Resolved', value: ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString('en-MY', { day:'numeric', month:'short' }) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-subtle)' }}>{label}</span>
                <span className="font-medium capitalize" style={{ color: 'var(--text-base)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
