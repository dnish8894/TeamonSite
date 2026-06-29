'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import {
  Plus, CalendarClock, AlertTriangle, CheckCircle,
  Clock, Trash2, ToggleLeft, ToggleRight,
  FileText, ChevronDown, ChevronRight
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Schedule {
  id: string; name: string; ticket_type: string
  interval_days: number; last_run_at: string | null; next_due_at: string | null
  is_active: boolean
  sites:       { id: string; name: string; clients: { name: string } | null } | null
  elv_systems: { id: string; name: string; type: string } | null
  engineers:   { id: string; users: { full_name: string } | null } | null
  pm_schedule_devices: { device_id: string; devices: { id: string; name: string | null; tag_id: string | null } | null }[] | null
  pm_reports: PMReportSummary[] | null
}
interface PMReportSummary {
  id: string; visit_date: string; status: string; created_at: string
  engineers: { users: { full_name: string } | null } | null
}
interface DeviceLine {
  device_id: string; name: string | null; tag_id: string | null
  serviced: boolean; status: 'pass' | 'fault' | 'not_done'; notes: string
}
interface PMReport {
  id: string; schedule_id: string; visit_date: string; summary: string | null
  status: string; devices: DeviceLine[]; engineer_id: string | null
  pm_schedules: { name: string } | null
  sites: { name: string; clients: { name: string } | null } | null
  elv_systems: { name: string; type: string } | null
}
interface Site     { id: string; name: string; clients: { name: string } | null }
interface System   { id: string; name: string; type: string; site_id: string }
interface Engineer { id: string; users: { full_name: string } | null }
interface Device   { id: string; name: string | null; tag_id: string | null; system_id: string }

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
  const [devices, setDevices]       = useState<Device[]>([])
  const [deviceIds, setDeviceIds]   = useState<string[]>([])
  const [engineers, setEngineers]   = useState<Engineer[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
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

  // Load systems + devices when site changes in form
  useEffect(() => {
    if (!form.site_id) { setSystems([]); setDevices([]); return }
    fetch(`/api/systems?site_id=${form.site_id}`)
      .then(r => r.json()).then(d => setSystems(Array.isArray(d) ? d : []))
    fetch(`/api/devices?site_id=${form.site_id}`)
      .then(r => r.json()).then(d => setDevices(Array.isArray(d) ? d : []))
  }, [form.site_id])

  // Devices selectable in the modal — scoped to the chosen system, else whole site
  const pickableDevices = form.system_id
    ? devices.filter(d => d.system_id === form.system_id)
    : devices
  const toggleDevice = (id: string) =>
    setDeviceIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.site_id)    return setError('Site is required.')
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/pm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, interval_days: parseInt(form.interval_days), device_ids: deviceIds }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowModal(false); setForm(emptyForm); setDeviceIds([]); load()
  }

  async function generateReport(schedId: string) {
    setGenerating(schedId)
    const res  = await fetch(`/api/pm/${schedId}/generate`, { method: 'POST' })
    const json = await res.json()
    setGenerating(null)
    if (res.ok) router.push(`/pm/reports/${json.reportId}`)
  }

  function openReport(reportId: string) {
    router.push(`/pm/reports/${reportId}`)
  }

  async function deleteReport(reportId: string) {
    if (!confirm('Delete this report?')) return
    await fetch(`/api/pm/reports/${reportId}`, { method: 'DELETE' })
    load()
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Servicing &amp; Schedules</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Recurring preventive maintenance — generate a PM report per visit
          </p>
        </div>
        <Button onClick={() => { setShowModal(true); setError(''); setForm(emptyForm); setDeviceIds([]) }}>
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
                      {(sched.pm_schedule_devices?.length ?? 0) > 0 && (
                        <span title={sched.pm_schedule_devices!.map(r => r.devices?.name ?? r.devices?.tag_id).filter(Boolean).join(', ')}>
                          🖥 {sched.pm_schedule_devices!.length} device{sched.pm_schedule_devices!.length !== 1 ? 's' : ''}
                        </span>
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
                        onClick={() => generateReport(sched.id)}
                        disabled={generating === sched.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
                        style={{ background: statusBg, color: statusColor }}
                        title="Generate PM report now">
                        {generating === sched.id
                          ? <span className="flex items-center gap-1"><Clock size={12} /> Generating...</span>
                          : <span className="flex items-center gap-1"><FileText size={12} /> Generate Report</span>}
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

                {/* Reports list */}
                {(() => {
                  const reports = [...(sched.pm_reports ?? [])].sort(
                    (a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                  const isOpen = expanded === sched.id
                  return (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : sched.id)}
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Reports ({reports.length})
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-1.5">
                          {reports.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                              No reports yet — click “Generate Report”.
                            </p>
                          ) : reports.map(r => (
                            <div key={r.id}
                              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                              <button onClick={() => openReport(r.id)}
                                className="flex items-center gap-2 text-left text-xs flex-1">
                                <FileText size={13} style={{ color: 'var(--text-subtle)' }} />
                                <span style={{ color: 'var(--text-base)' }}>{fmtDate(r.visit_date)}</span>
                                <span className="px-1.5 py-0.5 rounded-full"
                                  style={r.status === 'completed'
                                    ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                                    : { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                                  {r.status === 'completed' ? 'Completed' : 'Draft'}
                                </span>
                                {r.engineers?.users && (
                                  <span style={{ color: 'var(--text-subtle)' }}>· {r.engineers.users.full_name}</span>
                                )}
                              </button>
                              <button onClick={() => deleteReport(r.id)}
                                title="Delete report" style={{ color: 'var(--text-subtle)' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
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
                  onChange={e => { set('site_id', e.target.value); set('system_id', ''); setDeviceIds([]) }}>
                  <option value="">— Select site —</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.clients ? ` (${s.clients.name})` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="ELV System" hint="Optional — leave blank for site-wide">
                <Select value={form.system_id} onChange={e => { set('system_id', e.target.value); setDeviceIds([]) }}>
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

            {/* Covered devices — optional; blank = whole system */}
            {form.site_id && (
              <Field label="Covered Devices" hint="Optional — leave all unchecked to cover the whole system">
                {pickableDevices.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    No devices found for this {form.system_id ? 'system' : 'site'}.
                  </p>
                ) : (
                  <div className="rounded-lg border max-h-44 overflow-y-auto divide-y"
                    style={{ borderColor: 'var(--border)' }}>
                    {pickableDevices.map(d => (
                      <label key={d.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm"
                        style={{ color: 'var(--text-base)' }}>
                        <input type="checkbox" checked={deviceIds.includes(d.id)}
                          onChange={() => toggleDevice(d.id)} />
                        <span>{d.name ?? 'Device'}{d.tag_id ? ` · ${d.tag_id}` : ''}</span>
                      </label>
                    ))}
                  </div>
                )}
                {deviceIds.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {deviceIds.length} device{deviceIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </Field>
            )}

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
