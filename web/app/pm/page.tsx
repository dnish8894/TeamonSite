'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import {
  Plus, CalendarClock, AlertTriangle, CheckCircle,
  Clock, Play, Trash2, ToggleLeft, ToggleRight, Wrench
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Schedule {
  id: string; name: string; ticket_type: string
  interval_days: number; last_run_at: string | null; next_due_at: string | null
  is_active: boolean
  sites:       { id: string; name: string; clients: { name: string } | null } | null
  elv_systems: { id: string; name: string; type: string } | null
  engineers:   { id: string; users: { full_name: string } | null } | null
}
interface Site     { id: string; name: string; clients: { name: string } | null }
interface System   { id: string; name: string; type: string; site_id: string }
interface Engineer { id: string; users: { full_name: string } | null }

const INTERVAL_OPTIONS = [
  { label: 'Monthly (30 days)',    value: 30  },
  { label: 'Quarterly (90 days)',  value: 90  },
  { label: 'Half-yearly (180 days)', value: 180 },
  { label: 'Annually (365 days)', value: 365 },
]

const TYPE_LABELS: Record<string, string> = {
  preventive_maintenance: 'PM Visit',
  inspection: 'Inspection',
  upgrade: 'Upgrade',
}

const SYS_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control',
  structured_cabling: 'Structured Cabling', av: 'AV', pa: 'PA', bms: 'BMS',
}

const emptyForm = {
  name: '', site_id: '', system_id: '', assigned_to: '',
  ticket_type: 'preventive_maintenance', interval_days: '90',
  start_date: new Date().toISOString().split('T')[0],
}

/* ── Helpers ────────────────────────────────────────── */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Component ──────────────────────────────────────── */
export default function PMSchedulePage() {
  const router = useRouter()
  const [schedules, setSchedules]   = useState<Schedule[]>([])
  const [sites, setSites]           = useState<Site[]>([])
  const [systems, setSystems]       = useState<System[]>([])
  const [engineers, setEngineers]   = useState<Engineer[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [form, setForm]             = useState(emptyForm)
  const [filter, setFilter]         = useState<'all' | 'overdue' | 'upcoming' | 'inactive'>('all')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    const [pmRes, siteRes, engRes] = await Promise.all([
      fetch('/api/pm'),
      fetch('/api/sites'),
      fetch('/api/engineers'),
    ])
    setSchedules(await pmRes.json())
    setSites(await siteRes.json())
    setEngineers(await engRes.json())
    setLoading(false)
  }

  // Load systems when site changes in form
  useEffect(() => {
    if (!form.site_id) { setSystems([]); return }
    fetch(`/api/systems?site_id=${form.site_id}`)
      .then(r => r.json()).then(d => setSystems(Array.isArray(d) ? d : []))
  }, [form.site_id])

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.site_id)    return setError('Site is required.')
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/pm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, interval_days: parseInt(form.interval_days) }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowModal(false); setForm(emptyForm); load()
  }

  async function generateTicket(schedId: string) {
    setGenerating(schedId)
    const res  = await fetch(`/api/pm/${schedId}/generate`, { method: 'POST' })
    const json = await res.json()
    setGenerating(null)
    if (res.ok) {
      load()
      router.push(`/tickets/${json.ticketId}`)
    }
  }

  async function toggleActive(sched: Schedule) {
    await fetch(`/api/pm/${sched.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !sched.is_active }),
    })
    load()
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this schedule?')) return
    await fetch(`/api/pm/${id}`, { method: 'DELETE' })
    load()
  }

  // Categorise
  const overdue  = schedules.filter(s => s.is_active && daysUntil(s.next_due_at) !== null && daysUntil(s.next_due_at)! < 0)
  const dueSoon  = schedules.filter(s => s.is_active && daysUntil(s.next_due_at) !== null && daysUntil(s.next_due_at)! >= 0 && daysUntil(s.next_due_at)! <= 14)
  const upcoming = schedules.filter(s => s.is_active && daysUntil(s.next_due_at) !== null && daysUntil(s.next_due_at)! > 14)
  const inactive = schedules.filter(s => !s.is_active)

  const filtered = filter === 'all'      ? schedules
    : filter === 'overdue'  ? [...overdue, ...dueSoon]
    : filter === 'upcoming' ? upcoming
    : inactive

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>PM Schedules</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Recurring preventive maintenance visits
          </p>
        </div>
        <Button onClick={() => { setShowModal(true); setError('') }}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Schedule</span>
        </Button>
      </div>

      {/* Summary cards */}
      {schedules.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Overdue',       value: overdue.length,   color: 'var(--color-danger)',  icon: AlertTriangle, key: 'overdue'   },
            { label: 'Due ≤ 14 days', value: dueSoon.length,   color: 'var(--color-warning)', icon: Clock,         key: 'overdue'   },
            { label: 'Upcoming',      value: upcoming.length,  color: 'var(--color-success)', icon: CalendarClock, key: 'upcoming'  },
            { label: 'Inactive',      value: inactive.length,  color: 'var(--text-subtle)',   icon: CheckCircle,   key: 'inactive'  },
          ].map(s => (
            <button key={s.label} onClick={() => setFilter(filter === s.key as typeof filter ? 'all' : s.key as typeof filter)}
              className="rounded-xl border p-4 flex items-center gap-3 text-left transition-all"
              style={{
                background: 'var(--bg-card)', borderColor: filter === s.key ? s.color : 'var(--border)',
              }}>
              <s.icon size={20} style={{ color: s.color, flexShrink: 0 }} />
              <div>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {schedules.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { key: 'all',      label: `All (${schedules.length})`        },
            { key: 'overdue',  label: `Overdue / Due Soon (${overdue.length + dueSoon.length})` },
            { key: 'upcoming', label: `Upcoming (${upcoming.length})`    },
            { key: 'inactive', label: `Inactive (${inactive.length})`    },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={filter === f.key
                ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <CalendarClock size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No PM schedules yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Add a schedule to track recurring maintenance visits.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sched => {
            const days        = daysUntil(sched.next_due_at)
            const isOverdue   = days !== null && days < 0
            const isDueSoon   = days !== null && days >= 0 && days <= 14
            const statusColor = isOverdue ? 'var(--color-danger)'
              : isDueSoon ? 'var(--color-warning)'
              : 'var(--color-success)'
            const statusBg = isOverdue ? 'var(--color-danger-bg)'
              : isDueSoon ? 'var(--color-warning-bg)'
              : 'var(--color-success-bg)'
            const statusLabel = isOverdue
              ? `Overdue by ${Math.abs(days!)} day${Math.abs(days!) !== 1 ? 's' : ''}`
              : isDueSoon ? `Due in ${days} day${days !== 1 ? 's' : ''}`
              : days !== null ? `Due in ${days} days` : 'No date set'

            return (
              <div key={sched.id}
                className="rounded-xl border p-5"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: isOverdue ? 'var(--color-danger)' : isDueSoon ? 'var(--color-warning)' : 'var(--border)',
                  opacity: sched.is_active ? 1 : 0.6,
                }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Left — info */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{sched.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: statusBg, color: statusColor }}>
                        {statusLabel}
                      </span>
                      {!sched.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--border)', color: 'var(--text-subtle)' }}>Paused</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>📍 {sched.sites?.name}{sched.sites?.clients ? ` · ${sched.sites.clients.name}` : ''}</span>
                      {sched.elv_systems && (
                        <span>🔧 {SYS_LABELS[sched.elv_systems.type] ?? sched.elv_systems.type}</span>
                      )}
                      <span>🔄 Every {sched.interval_days} days</span>
                      <span>📋 {TYPE_LABELS[sched.ticket_type] ?? sched.ticket_type}</span>
                      {sched.engineers?.users && (
                        <span>👤 {sched.engineers.users.full_name}</span>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="flex gap-4 text-xs pt-1" style={{ color: 'var(--text-subtle)' }}>
                      <span>Last run: {fmtDate(sched.last_run_at)}</span>
                      <span>Next due: <strong style={{ color: statusColor }}>{fmtDate(sched.next_due_at)}</strong></span>
                    </div>
                  </div>

                  {/* Right — actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Generate ticket */}
                    {sched.is_active && (
                      <button
                        onClick={() => generateTicket(sched.id)}
                        disabled={generating === sched.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
                        style={{ background: statusBg, color: statusColor }}
                        title="Generate PM ticket now">
                        {generating === sched.id
                          ? <span className="flex items-center gap-1"><Clock size={12} /> Generating...</span>
                          : <span className="flex items-center gap-1"><Play size={12} /> Generate Ticket</span>}
                      </button>
                    )}

                    {/* Toggle active */}
                    <button onClick={() => toggleActive(sched)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: sched.is_active ? 'var(--color-success)' : 'var(--text-subtle)' }}
                      title={sched.is_active ? 'Pause schedule' : 'Resume schedule'}>
                      {sched.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>

                    {/* Delete */}
                    <button onClick={() => deleteSchedule(sched.id)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                      title="Delete schedule">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Schedule Modal */}
      {showModal && (
        <Modal title="Add PM Schedule" onClose={() => { setShowModal(false); setError('') }} width="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Schedule Name" required>
              <Input placeholder="e.g. Quarterly CCTV PM — Menara XYZ"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Site" required>
                <Select value={form.site_id}
                  onChange={e => { set('site_id', e.target.value); set('system_id', '') }}>
                  <option value="">— Select site —</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.clients ? ` (${s.clients.name})` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="ELV System" hint="Optional — leave blank for site-wide">
                <Select value={form.system_id} onChange={e => set('system_id', e.target.value)}>
                  <option value="">— All systems —</option>
                  {systems.map(s => (
                    <option key={s.id} value={s.id}>{SYS_LABELS[s.type] ?? s.type}{s.name ? ` — ${s.name}` : ''}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Visit Type">
                <Select value={form.ticket_type} onChange={e => set('ticket_type', e.target.value)}>
                  <option value="preventive_maintenance">PM Visit</option>
                  <option value="inspection">Inspection</option>
                  <option value="upgrade">Upgrade</option>
                </Select>
              </Field>
              <Field label="Interval">
                <Select value={form.interval_days} onChange={e => set('interval_days', e.target.value)}>
                  {INTERVAL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Assign Engineer">
                <Select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {engineers.map(eng => (
                    <option key={eng.id} value={eng.id}>{eng.users?.full_name ?? 'Unknown'}</option>
                  ))}
                </Select>
              </Field>
              <Field label="First Visit Date" hint="Next due calculated from this">
                <Input type="date" value={form.start_date}
                  onChange={e => set('start_date', e.target.value)} />
              </Field>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Schedule</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
