'use client'
import { useEffect, useState, useRef } from 'react'
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react'

type MilestoneStatus   = 'pending' | 'in_progress' | 'completed' | 'not_required' | 'on_hold'
type MilestoneCategory = 'ADMIN' | 'PLANNING' | 'PROCUREMENT' | 'INSTALLATION' | 'HANDOVER' | 'POST-PROJECT'
type MilestonePriority = 'High' | 'Medium' | 'Low'

interface Milestone {
  id: string
  item_no: number
  title: string
  status: MilestoneStatus
  completion_date: string | null
  category: MilestoneCategory
  priority: MilestonePriority
  notes: string | null
  ref_doc: string | null
  percent_done: number
}

const STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'not_required', 'on_hold']
const CATEGORIES: MilestoneCategory[] = ['ADMIN', 'PLANNING', 'PROCUREMENT', 'INSTALLATION', 'HANDOVER', 'POST-PROJECT']
const PRIORITIES: MilestonePriority[] = ['High', 'Medium', 'Low']

const STATUS_STYLE: Record<MilestoneStatus, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  in_progress:  { label: 'In Progress',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  completed:    { label: 'Completed',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  not_required: { label: 'No Required',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  on_hold:      { label: 'On Hold',      color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
}

const PRIORITY_COLOR: Record<MilestonePriority, string> = {
  High:   '#ef4444',
  Medium: '#f97316',
  Low:    '#22c55e',
}

const CATEGORY_COLOR: Record<MilestoneCategory, string> = {
  'ADMIN':        '#6366f1',
  'PLANNING':     '#0ea5e9',
  'PROCUREMENT':  '#f59e0b',
  'INSTALLATION': '#ef4444',
  'HANDOVER':     '#22c55e',
  'POST-PROJECT': '#a78bfa',
}

const EMPTY: Omit<Milestone, 'id'> = {
  item_no: 0, title: '', status: 'pending', completion_date: null,
  category: 'ADMIN', priority: 'Medium', notes: null, ref_doc: null, percent_done: 0,
}

export default function ProgressTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading]       = useState(true)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editBuf, setEditBuf]       = useState<Partial<Milestone>>({})
  const [addMode, setAddMode]       = useState(false)
  const [addBuf, setAddBuf]         = useState<Omit<Milestone,'id'>>(EMPTY)
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())
  const [saving, setSaving]         = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/milestones`)
    const data = await res.json()
    setMilestones(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [projectId])

  async function savEdit(m: Milestone) {
    setSaving(true)
    const payload = { ...m, ...editBuf }
    await fetch(`/api/projects/${projectId}/milestones/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setEditId(null)
    load()
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this milestone?')) return
    await fetch(`/api/projects/${projectId}/milestones/${id}`, { method: 'DELETE' })
    load()
  }

  async function addRow() {
    if (!addBuf.title.trim()) return
    setSaving(true)
    await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addBuf),
    })
    setSaving(false)
    setAddMode(false)
    setAddBuf(EMPTY)
    load()
  }

  // Quick inline status update (single click)
  async function cycleStatus(m: Milestone) {
    const idx  = STATUSES.indexOf(m.status)
    const next = STATUSES[(idx + 1) % STATUSES.length]
    await fetch(`/api/projects/${projectId}/milestones/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...m, status: next, percent_done: next === 'completed' ? 100 : m.percent_done }),
    })
    load()
  }

  function toggleCollapse(cat: string) {
    setCollapsed(prev => {
      const s = new Set(prev)
      s.has(cat) ? s.delete(cat) : s.add(cat)
      return s
    })
  }

  // Export CSV
  function exportCsv() {
    const headers = ['#','Task/Milestone','Status','Completion Date','Category','Priority','Notes','Ref Doc','% Done']
    const rows = milestones.map(m => [
      m.item_no, m.title, STATUS_STYLE[m.status].label,
      m.completion_date ?? '', m.category, m.priority,
      m.notes ?? '', m.ref_doc ?? '', m.percent_done,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${projectName}-milestones.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Stats
  const total      = milestones.length
  const done       = milestones.filter(m => m.status === 'completed').length
  const inProg     = milestones.filter(m => m.status === 'in_progress').length
  const notReq     = milestones.filter(m => m.status === 'not_required').length
  const overallPct = total ? Math.round(milestones.reduce((s,m) => s + m.percent_done, 0) / total) : 0

  // Group by category
  const grouped = CATEGORIES.map(cat => ({
    cat,
    rows: milestones.filter(m => m.category === cat),
  })).filter(g => g.rows.length > 0)

  if (loading) return <div className="p-6" style={{ color: 'var(--text-subtle)' }}>Loading milestones…</div>

  return (
    <div style={{ color: 'var(--text-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Project Progress / Milestones</h2>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Download size={14}/> CSV
          </button>
          <button onClick={() => { setAddMode(true); setAddBuf(EMPTY) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors"
            style={{ background: '#f97316', color: '#fff' }}>
            <Plus size={14}/> Add Milestone
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',       value: total,      color: 'var(--text-base)' },
          { label: 'Completed',   value: done,        color: '#22c55e'          },
          { label: 'In Progress', value: inProg,      color: '#3b82f6'          },
          { label: 'Overall %',   value: `${overallPct}%`, color: '#f97316'    },
        ].map(c => (
          <div key={c.label} className="rounded-lg p-3 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="mb-5 rounded" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '10px 14px' }}>
        <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
          <span>Overall Completion</span>
          <span style={{ color: '#f97316', fontWeight: 600 }}>{overallPct}%</span>
        </div>
        <div className="w-full rounded-full h-2.5" style={{ background: 'var(--border)' }}>
          <div className="h-2.5 rounded-full transition-all" style={{ width: `${overallPct}%`, background: '#f97316' }}/>
        </div>
      </div>

      {/* Add row form */}
      {addMode && (
        <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid #f97316' }}>
          <div className="text-sm font-medium mb-3" style={{ color: '#f97316' }}>New Milestone</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Task / Milestone *</label>
              <input className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.title} onChange={e => setAddBuf(b => ({ ...b, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Category</label>
              <select className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.category} onChange={e => setAddBuf(b => ({ ...b, category: e.target.value as MilestoneCategory }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
              <select className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.status} onChange={e => setAddBuf(b => ({ ...b, status: e.target.value as MilestoneStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Priority</label>
              <select className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.priority} onChange={e => setAddBuf(b => ({ ...b, priority: e.target.value as MilestonePriority }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Completion Date</label>
              <input type="date" className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.completion_date ?? ''} onChange={e => setAddBuf(b => ({ ...b, completion_date: e.target.value || null }))} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>% Done</label>
              <input type="number" min={0} max={100} className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.percent_done} onChange={e => setAddBuf(b => ({ ...b, percent_done: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Ref Doc</label>
              <input className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.ref_doc ?? ''} onChange={e => setAddBuf(b => ({ ...b, ref_doc: e.target.value || null }))} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
              <input className="w-full rounded px-2 py-1.5 text-sm" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                value={addBuf.notes ?? ''} onChange={e => setAddBuf(b => ({ ...b, notes: e.target.value || null }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addRow} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium"
              style={{ background: '#f97316', color: '#fff', opacity: saving ? 0.6 : 1 }}>
              <Save size={14}/> Save
            </button>
            <button onClick={() => setAddMode(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <X size={14}/> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table grouped by category */}
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
              {['#','Task / Milestone','Status','Completion Date','Category','Priority','Notes','Ref Doc','% Done',''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ cat, rows }) => {
              const catDone = rows.filter(r => r.status === 'completed').length
              const catPct  = rows.length ? Math.round(rows.reduce((s,r) => s + r.percent_done, 0) / rows.length) : 0
              const isCollapsed = collapsed.has(cat)

              return [
                // Category header row
                <tr key={`cat-${cat}`}
                  onClick={() => toggleCollapse(cat)}
                  className="cursor-pointer select-none"
                  style={{ background: `${CATEGORY_COLOR[cat]}18`, borderBottom: '1px solid var(--border)' }}>
                  <td colSpan={8} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                      <span className="font-semibold text-xs px-2 py-0.5 rounded"
                        style={{ background: CATEGORY_COLOR[cat], color: '#fff' }}>{cat}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {catDone}/{rows.length} completed
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full h-1.5 min-w-[60px]" style={{ background: 'var(--border)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${catPct}%`, background: CATEGORY_COLOR[cat] }}/>
                      </div>
                      <span className="text-xs" style={{ color: CATEGORY_COLOR[cat], fontWeight: 600 }}>{catPct}%</span>
                    </div>
                  </td>
                </tr>,

                // Data rows
                ...(!isCollapsed ? rows.map(m => {
                  const isEdit = editId === m.id
                  const buf = isEdit ? { ...m, ...editBuf } : m

                  return (
                    <tr key={m.id}
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}
                      className="hover:brightness-105 transition-all">
                      {/* # */}
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{m.item_no}</td>

                      {/* Title */}
                      <td className="px-3 py-2 min-w-[200px]">
                        {isEdit
                          ? <input className="w-full rounded px-1.5 py-1 text-sm"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.title}
                              onChange={e => setEditBuf(b => ({ ...b, title: e.target.value }))}/>
                          : <span>{m.title}</span>}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        {isEdit
                          ? <select className="rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.status}
                              onChange={e => setEditBuf(b => ({ ...b, status: e.target.value as MilestoneStatus }))}>
                              {STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
                            </select>
                          : <button onClick={() => cycleStatus(m)}
                              className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                              style={{ background: STATUS_STYLE[m.status].bg, color: STATUS_STYLE[m.status].color }}>
                              {STATUS_STYLE[m.status].label}
                            </button>}
                      </td>

                      {/* Completion Date */}
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {isEdit
                          ? <input type="date" className="rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.completion_date ?? ''}
                              onChange={e => setEditBuf(b => ({ ...b, completion_date: e.target.value || null }))}/>
                          : <span style={{ color: 'var(--text-muted)' }}>{m.completion_date ?? '—'}</span>}
                      </td>

                      {/* Category */}
                      <td className="px-3 py-2">
                        {isEdit
                          ? <select className="rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.category}
                              onChange={e => setEditBuf(b => ({ ...b, category: e.target.value as MilestoneCategory }))}>
                              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          : <span className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: `${CATEGORY_COLOR[m.category]}20`, color: CATEGORY_COLOR[m.category] }}>
                              {m.category}
                            </span>}
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2">
                        {isEdit
                          ? <select className="rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.priority}
                              onChange={e => setEditBuf(b => ({ ...b, priority: e.target.value as MilestonePriority }))}>
                              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                            </select>
                          : <span className="font-medium text-xs" style={{ color: PRIORITY_COLOR[m.priority] }}>
                              {m.priority}
                            </span>}
                      </td>

                      {/* Notes */}
                      <td className="px-3 py-2 text-xs max-w-[140px]">
                        {isEdit
                          ? <input className="w-full rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.notes ?? ''}
                              onChange={e => setEditBuf(b => ({ ...b, notes: e.target.value || null }))}/>
                          : <span style={{ color: 'var(--text-muted)' }} title={m.notes ?? ''}>
                              {m.notes ? (m.notes.length > 30 ? m.notes.slice(0,30)+'…' : m.notes) : '—'}
                            </span>}
                      </td>

                      {/* Ref Doc */}
                      <td className="px-3 py-2 text-xs">
                        {isEdit
                          ? <input className="w-full rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.ref_doc ?? ''}
                              onChange={e => setEditBuf(b => ({ ...b, ref_doc: e.target.value || null }))}/>
                          : <span style={{ color: 'var(--text-muted)' }}>{m.ref_doc ?? '—'}</span>}
                      </td>

                      {/* % Done */}
                      <td className="px-3 py-2" style={{ minWidth: 90 }}>
                        {isEdit
                          ? <input type="number" min={0} max={100} className="w-16 rounded px-1.5 py-1 text-xs"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                              value={buf.percent_done}
                              onChange={e => setEditBuf(b => ({ ...b, percent_done: Number(e.target.value) }))}/>
                          : <div className="flex items-center gap-1.5">
                              <div className="flex-1 rounded-full h-1.5" style={{ background: 'var(--border)', minWidth: 40 }}>
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${m.percent_done}%`, background: m.percent_done === 100 ? '#22c55e' : '#f97316' }}/>
                              </div>
                              <span className="text-xs w-7 text-right" style={{ color: 'var(--text-muted)' }}>{m.percent_done}%</span>
                            </div>}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {isEdit
                            ? <>
                                <button onClick={() => savEdit(m)} disabled={saving}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: '#22c55e' }}>
                                  <Save size={14}/>
                                </button>
                                <button onClick={() => { setEditId(null); setEditBuf({}) }}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: 'var(--text-muted)' }}>
                                  <X size={14}/>
                                </button>
                              </>
                            : <>
                                <button onClick={() => { setEditId(m.id); setEditBuf({}) }}
                                  className="p-1 rounded transition-colors text-xs"
                                  style={{ color: 'var(--text-muted)' }}>
                                  Edit
                                </button>
                                <button onClick={() => deleteRow(m.id)}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: '#ef4444' }}>
                                  <Trash2 size={13}/>
                                </button>
                              </>}
                        </div>
                      </td>
                    </tr>
                  )
                }) : [])
              ]
            })}
          </tbody>
        </table>
      </div>

      {milestones.length === 0 && !loading && (
        <div className="text-center py-10" style={{ color: 'var(--text-subtle)' }}>
          No milestones found.
        </div>
      )}
    </div>
  )
}
