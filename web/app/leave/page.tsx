'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Check, X, Paperclip, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Leave {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  supporting_doc_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  user_id: string
  users: { full_name: string } | null
  reviewer: { full_name: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  annual: 'Annual', medical: 'Medical / Sick', emergency: 'Emergency', unpaid: 'Unpaid', other: 'Other',
}
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  approved: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  rejected: { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

const emptyForm = { leave_type: 'annual', start_date: '', end_date: '', reason: '', supporting_doc_url: '' }

export default function LeavePage() {
  const [role, setRole] = useState<string>('')
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all' | 'mine'>('pending')
  const [showApply, setShowApply] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [empFilter, setEmpFilter] = useState('')

  const isReviewer = ['admin', 'manager', 'hr'].includes(role)
  const shownLeaves = empFilter ? leaves.filter(l => l.user_id === empFilter) : leaves

  async function load() {
    setLoading(true)
    const scope = (!isReviewer || filter === 'mine') ? '&scope=mine' : ''
    const status = ['pending', 'approved', 'rejected'].includes(filter) ? `&status=${filter}` : ''
    const res = await fetch(`/api/leave?x=1${scope}${status}`)
    const data = await res.json()
    setLeaves(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setRole(d?.role ?? ''))
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d =>
      setEmployees(Array.isArray(d) ? d.map((u: { id: string; full_name: string }) => ({ id: u.id, full_name: u.full_name })) : []))
  }, [])
  useEffect(() => { load() }, [filter, role]) // eslint-disable-line

  async function apply() {
    if (!form.start_date || !form.end_date) return setError('Please choose start and end dates.')
    setSaving(true); setError('')
    const res = await fetch('/api/leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error); return }
    setShowApply(false); setForm(emptyForm); setFilter(isReviewer ? 'mine' : 'mine'); load()
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/leave/upload', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) { const j = await res.json(); setForm(f => ({ ...f, supporting_doc_url: j.url })) }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/leave/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }
  async function cancel(id: string) {
    if (!confirm('Cancel this leave request?')) return
    await fetch(`/api/leave/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
    load()
  }

  // Calendar: approved leaves overlapping the viewed month
  const approvedInMonth = useMemo(() => {
    const first = new Date(month.y, month.m, 1), last = new Date(month.y, month.m + 1, 0)
    return leaves.filter(l => l.status === 'approved' &&
      new Date(l.start_date + 'T00:00') <= last && new Date(l.end_date + 'T00:00') >= first)
  }, [leaves, month])

  function namesOnDay(day: number): string[] {
    const d = new Date(month.y, month.m, day)
    return approvedInMonth
      .filter(l => new Date(l.start_date + 'T00:00') <= d && new Date(l.end_date + 'T00:00') >= d)
      .map(l => l.users?.full_name?.split(' ')[0] ?? '?')
  }

  const totalDays = new Date(month.y, month.m + 1, 0).getDate()
  const firstDow = new Date(month.y, month.m, 1).getDay()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Leave</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {isReviewer ? 'Review applications and view the leave calendar' : 'Apply for leave and track your applications'}
          </p>
        </div>
        <Button onClick={() => { setShowApply(true); setForm(emptyForm); setError('') }}>
          <span className="flex items-center gap-2"><Plus size={16} /> Apply for Leave</span>
        </Button>
      </div>

      {/* Month calendar of approved leave */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} style={{ color: '#f97316' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Leave Calendar</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMonth(mm => mm.m === 0 ? { y: mm.y - 1, m: 11 } : { ...mm, m: mm.m - 1 })} style={{ color: '#f97316' }}>‹</button>
            <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{MONTHS[month.m]} {month.y}</span>
            <button onClick={() => setMonth(mm => mm.m === 11 ? { y: mm.y + 1, m: 0 } : { ...mm, m: mm.m + 1 })} style={{ color: '#f97316' }}>›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-subtle)' }}>{d}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
            const names = namesOnDay(day)
            return (
              <div key={day} className="rounded-lg p-1.5 min-h-[48px] border text-xs"
                style={{ borderColor: 'var(--border)', background: names.length ? 'var(--color-success-bg)' : 'transparent' }}>
                <div style={{ color: 'var(--text-subtle)' }}>{day}</div>
                {names.slice(0, 2).map((n, i) => <div key={i} className="truncate font-medium" style={{ color: 'var(--color-success)' }}>{n}</div>)}
                {names.length > 2 && <div style={{ color: 'var(--color-success)' }}>+{names.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter (reviewers) */}
      {isReviewer && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all', 'mine'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize"
              style={filter === f ? { background: '#f97316', color: '#fff', borderColor: '#f97316' } : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {f === 'mine' ? 'My Requests' : f}
            </button>
          ))}
          <div className="ml-auto" style={{ minWidth: 200 }}>
            <Select value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
              <option value="">All employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : shownLeaves.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <CalendarDays size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No leave requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shownLeaves.map(l => {
            const st = STATUS_STYLE[l.status]
            return (
              <div key={l.id} className="rounded-xl border p-4 flex items-start justify-between gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isReviewer && <span className="font-medium text-sm" style={{ color: 'var(--text-base)' }}>{l.users?.full_name ?? '—'}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{TYPE_LABEL[l.leave_type] ?? l.leave_type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: st.bg, color: st.color }}>{l.status}</span>
                  </div>
                  <p className="text-sm mt-1.5" style={{ color: 'var(--text-base)' }}>{fmt(l.start_date)} → {fmt(l.end_date)} <span style={{ color: 'var(--text-subtle)' }}>({l.days} day{l.days !== 1 ? 's' : ''})</span></p>
                  {l.reason && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{l.reason}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {l.supporting_doc_url && <a href={l.supporting_doc_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: 'var(--color-info)' }}><Paperclip size={11} /> Supporting doc</a>}
                    {l.reviewed_at && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Reviewed by {l.reviewer?.full_name ?? '—'}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isReviewer && l.status === 'pending' ? (
                    <>
                      <button onClick={() => review(l.id, 'approved')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}><Check size={13} /> Approve</button>
                      <button onClick={() => review(l.id, 'rejected')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><X size={13} /> Reject</button>
                    </>
                  ) : l.status === 'pending' ? (
                    <button onClick={() => cancel(l.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}>Cancel</button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showApply && (
        <Modal title="Apply for Leave" onClose={() => setShowApply(false)} width="max-w-md">
          <div className="space-y-4">
            <Field label="Leave Type">
              <Select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" required><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
              <Field label="To" required><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></Field>
            </div>
            <Field label="Reason"><Textarea rows={2} placeholder="Reason for leave..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></Field>
            <Field label="Supporting Document" hint="e.g. medical certificate (optional)">
              <div className="flex items-center gap-3">
                <label className="text-xs px-3 py-2 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
                  {uploading ? 'Uploading…' : 'Choose file'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadDoc} />
                </label>
                {form.supporting_doc_url && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-success)' }}><CheckCircle2 size={13} /> Attached</span>}
              </div>
            </Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowApply(false)}>Cancel</Button>
              <Button onClick={apply} loading={saving}>Submit Application</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
