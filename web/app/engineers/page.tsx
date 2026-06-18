'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, Phone, Mail, Wrench, CheckCircle, XCircle, BarChart2 } from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Engineer {
  id: string
  is_available: boolean
  daily_capacity_hr: number
  skills: string[]
  certifications: { brand: string; level: string; expiry: string }[]
  users: { full_name: string; phone: string | null; email: string; is_active: boolean } | null
  active_jobs?: number
  load_pct?: number
}

/* ── Constants ──────────────────────────────────────── */
const SKILL_OPTIONS = [
  'cctv', 'access_control', 'structured_cabling', 'av', 'pa', 'bms', 'networking', 'electrical',
]
const SKILL_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS', networking: 'Networking', electrical: 'Electrical',
}
const SKILL_COLORS: Record<string, { color: string; bg: string }> = {
  cctv:               { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  access_control:     { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  structured_cabling: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  av:                 { color: '#a78bfa',              bg: 'rgba(167,139,250,0.12)'  },
  pa:                 { color: '#f472b6',              bg: 'rgba(244,114,182,0.12)'  },
  bms:                { color: '#34d399',              bg: 'rgba(52,211,153,0.12)'   },
  networking:         { color: '#fb923c',              bg: 'rgba(251,146,60,0.12)'   },
  electrical:         { color: '#facc15',              bg: 'rgba(250,204,21,0.12)'   },
}

const emptyForm = {
  full_name: '', email: '', phone: '', employee_id: '',
  daily_capacity_hr: '8', skills: [] as string[],
}

/* ── Component ──────────────────────────────────────── */
export default function EngineersPage() {
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [workload, setWorkload]   = useState<Record<string, { active_jobs: number; load_pct: number }>>({})
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm]           = useState(emptyForm)

  const set    = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (skill: string) => setForm(f => ({
    ...f,
    skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill],
  }))

  async function load() {
    const [engRes, wlRes] = await Promise.all([
      fetch('/api/engineers'),
      fetch('/api/engineers/workload'),
    ])
    const engs = await engRes.json()
    const wl   = await wlRes.json()
    setEngineers(Array.isArray(engs) ? engs : [])
    // Build workload map by engineer id
    const wlMap: Record<string, { active_jobs: number; load_pct: number }> = {}
    if (Array.isArray(wl)) wl.forEach((w: { engineer_id: string; active_jobs: number; load_pct: number }) => {
      wlMap[w.engineer_id] = { active_jobs: w.active_jobs, load_pct: w.load_pct }
    })
    setWorkload(wlMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return setError('Name is required.')
    if (!form.email.trim())     return setError('Email is required.')
    setSaving(true); setError('')

    const res = await fetch('/api/engineers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:         form.full_name.trim(),
        email:             form.email.trim(),
        phone:             form.phone  || null,
        employee_id:       form.employee_id || null,
        daily_capacity_hr: parseInt(form.daily_capacity_hr) || 8,
        skills:            form.skills,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowModal(false); setForm(emptyForm); load()
  }

  async function toggleAvailability(id: string, current: boolean) {
    await fetch(`/api/engineers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !current }),
    })
    load()
  }

  const available   = engineers.filter(e => e.is_available)
  const unavailable = engineers.filter(e => !e.is_available)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Engineers</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {available.length} available · {unavailable.length} unavailable · {engineers.length} total
          </p>
        </div>
        <Button onClick={() => { setShowModal(true); setError('') }}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Engineer</span>
        </Button>
      </div>

      {/* Stats bar */}
      {engineers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Engineers', value: engineers.length,     color: 'var(--color-info)'    },
            { label: 'Available Today', value: available.length,     color: 'var(--color-success)' },
            { label: 'On Job / Busy',   value: unavailable.length,   color: 'var(--color-danger)'  },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Engineer grid */}
      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : engineers.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Wrench size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No engineers yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>Add your field engineers to assign tickets.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {engineers.map(eng => {
            const wl = workload[eng.id]
            const loadPct = wl?.load_pct ?? 0
            const activeJobs = wl?.active_jobs ?? 0
            const loadColor = loadPct >= 90 ? 'var(--color-danger)'
              : loadPct >= 60 ? 'var(--color-warning)'
              : 'var(--color-success)'

            return (
              <div key={eng.id} className="rounded-xl border p-5 space-y-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

                {/* Top row — name + availability toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-base)' }}>
                      {eng.users?.full_name ?? 'Unknown'}
                    </p>
                    {eng.users?.email && (
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                        <Mail size={10} /> {eng.users.email}
                      </p>
                    )}
                    {eng.users?.phone && (
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                        <Phone size={10} /> {eng.users.phone}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAvailability(eng.id, eng.is_available)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                    style={eng.is_available
                      ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                      : { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                    {eng.is_available
                      ? <><CheckCircle size={12} /> Available</>
                      : <><XCircle size={12} /> Unavailable</>}
                  </button>
                </div>

                {/* Workload bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>
                    <span className="flex items-center gap-1"><BarChart2 size={11} /> Workload today</span>
                    <span style={{ color: loadColor }}>{activeJobs} job{activeJobs !== 1 ? 's' : ''} · {Math.round(loadPct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(loadPct, 100)}%`, background: loadColor }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                    Capacity: {eng.daily_capacity_hr} hrs/day
                  </p>
                </div>

                {/* Skills */}
                {eng.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {eng.skills.map((s: string) => {
                      const c = SKILL_COLORS[s] ?? { color: 'var(--text-muted)', bg: 'var(--border)' }
                      return (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: c.bg, color: c.color }}>
                          {SKILL_LABELS[s] ?? s}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Engineer Modal */}
      {showModal && (
        <Modal title="Add Engineer" onClose={() => { setShowModal(false); setError('') }} width="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <Input placeholder="Ahmad bin Ali" value={form.full_name}
                  onChange={e => set('full_name', e.target.value)} />
              </Field>
              <Field label="Employee ID">
                <Input placeholder="EMP-001" value={form.employee_id}
                  onChange={e => set('employee_id', e.target.value)} />
              </Field>
            </div>

            <Field label="Email" required>
              <Input type="email" placeholder="ahmad@yourcompany.com" value={form.email}
                onChange={e => set('email', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <Input placeholder="+60 12-345 6789" value={form.phone}
                  onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Daily Capacity (hrs)">
                <Select value={form.daily_capacity_hr} onChange={e => set('daily_capacity_hr', e.target.value)}>
                  {[4,6,8,10,12].map(h => <option key={h} value={h}>{h} hours</option>)}
                </Select>
              </Field>
            </div>

            {/* Skills checkboxes */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map(skill => {
                  const selected = form.skills.includes(skill)
                  const c = SKILL_COLORS[skill] ?? { color: 'var(--text-muted)', bg: 'var(--border)' }
                  return (
                    <button key={skill} type="button" onClick={() => toggle(skill)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={selected
                        ? { background: c.bg, color: c.color, borderColor: c.color }
                        : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                      {SKILL_LABELS[skill]}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Engineer</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
