'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, FolderOpen, Calendar, DollarSign } from 'lucide-react'

interface Project {
  id: string; project_no: string; name: string; status: string
  value: number | null; start_date: string | null; end_date: string | null
  created_at: string
  clients: { name: string } | null
  sites: { name: string } | null
}
interface Client { id: string; name: string }
interface Site   { id: string; name: string; client_id: string }

const STATUS_STEPS = ['planning','survey','installation','testing','handover','completed','on_hold']
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  planning:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Planning'     },
  survey:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Site Survey'  },
  installation: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  label: 'Installation' },
  testing:      { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  label: 'Testing / UAT'},
  handover:     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Handover'     },
  completed:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Completed' },
  on_hold:      { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  label: 'On Hold'   },
}

const emptyForm = {
  name: '', client_id: '', site_id: '', description: '',
  status: 'planning', value: '', start_date: '', end_date: '',
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [sites, setSites]       = useState<Site[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState(emptyForm)
  const [filterStatus, setFilterStatus] = useState('all')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    const [pRes, cRes, sRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/clients'),
      fetch('/api/sites'),
    ])
    setProjects(await pRes.json())
    setClients(await cRes.json())
    setSites(await sRes.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filteredSites = sites.filter(s => !form.client_id || s.client_id === form.client_id)
  const filtered = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Project name is required.')
    if (!form.client_id)   return setError('Client is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        client_id: form.client_id,
        site_id: form.site_id || null,
        description: form.description || null,
        status: form.status,
        value: form.value ? parseFloat(form.value) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowModal(false); setForm(emptyForm); load()
    router.push(`/projects/${json.id}`)
  }

  const byStatus = (s: string) => projects.filter(p => p.status === s).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Projects</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { setShowModal(true); setError('') }}>
          <span className="flex items-center gap-2"><Plus size={16} /> New Project</span>
        </Button>
      </div>

      {/* Pipeline summary */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {STATUS_STEPS.filter(s => s !== 'on_hold').map(s => {
            const st = STATUS_STYLE[s]
            const count = byStatus(s)
            return (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className="rounded-xl border p-3 text-center transition-all"
                style={{
                  background: filterStatus === s ? st.bg : 'var(--bg-card)',
                  borderColor: filterStatus === s ? st.color : 'var(--border)',
                }}>
                <div className="text-xl font-bold" style={{ color: st.color }}>{count}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{st.label}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Filter tabs */}
      {projects.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setFilterStatus('all')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border"
            style={filterStatus === 'all'
              ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
              : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            All ({projects.length})
          </button>
          {STATUS_STEPS.map(s => {
            const count = byStatus(s)
            if (count === 0) return null
            return (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border"
                style={filterStatus === s
                  ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].color, borderColor: STATUS_STYLE[s].color }
                  : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                {STATUS_STYLE[s].label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <FolderOpen size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No projects yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Create your first project to track site surveys, TNC and UAT.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.planning
            // Progress step indicator
            const stepIdx = STATUS_STEPS.indexOf(p.status)
            const normalSteps = STATUS_STEPS.filter(s => s !== 'on_hold')
            const progress = Math.round(((normalSteps.indexOf(p.status) + 1) / normalSteps.length) * 100)

            return (
              <div key={p.id}
                className="rounded-xl border p-5 cursor-pointer transition-all"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                onClick={() => router.push(`/projects/${p.id}`)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = st.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{p.project_no}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <h3 className="font-semibold mt-1" style={{ color: 'var(--text-base)' }}>{p.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {p.clients?.name}{p.sites?.name ? ` · ${p.sites.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    {p.value && (
                      <p className="flex items-center gap-1 justify-end font-semibold" style={{ color: 'var(--color-success)' }}>
                        <DollarSign size={12} /> RM {Number(p.value).toLocaleString()}
                      </p>
                    )}
                    {(p.start_date || p.end_date) && (
                      <p className="flex items-center gap-1 justify-end" style={{ color: 'var(--text-subtle)' }}>
                        <Calendar size={11} />
                        {p.start_date ? new Date(p.start_date).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' }) : '?'}
                        {' → '}
                        {p.end_date ? new Date(p.end_date).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' }) : 'TBD'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {p.status !== 'on_hold' && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>
                      {normalSteps.map((s, i) => (
                        <span key={s} style={{ color: i <= normalSteps.indexOf(p.status) ? st.color : 'var(--text-subtle)' }}>
                          {STATUS_STYLE[s].label.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: st.color }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <Modal title="New Project" onClose={() => { setShowModal(false); setError('') }} width="max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Project Name" required>
              <Input placeholder="e.g. CCTV & Access Control — Menara XYZ" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client" required>
                <Select value={form.client_id} onChange={e => { set('client_id', e.target.value); set('site_id', '') }}>
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Site">
                <Select value={form.site_id} onChange={e => set('site_id', e.target.value)}>
                  <option value="">— Select site —</option>
                  {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <Select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
                </Select>
              </Field>
              <Field label="Contract Value (RM)">
                <Input type="number" placeholder="50000" value={form.value}
                  onChange={e => set('value', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date">
                <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </Field>
              <Field label="End Date">
                <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} placeholder="Brief project description..." value={form.description}
                onChange={e => set('description', e.target.value)} />
            </Field>
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Create Project</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
