'use client'

import { useEffect, useState } from 'react'
import { Receipt, Plus, Check, X, Paperclip, CheckCircle2, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Claim {
  id: string
  claim_type: string
  amount: number
  claim_date: string
  description: string | null
  receipt_url: string | null
  reference_note: string | null
  ot_from: string | null
  ot_to: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  reviewed_at: string | null
  user_id: string
  users: { full_name: string } | null
  reviewer: { full_name: string } | null
  tickets: { ticket_no: string } | null
  projects: { project_no: string; name: string } | null
}
interface Ref { id: string; ticket_no?: string; project_no?: string; name?: string; title?: string }

const TYPE_LABEL: Record<string, string> = { travel: 'Travel', meal: 'Meal', parts: 'Parts', accommodation: 'Accommodation', ot: 'Overtime', other: 'Other' }
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  approved: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  rejected: { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
}
const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
const emptyForm = { claim_type: 'travel', amount: '', claim_date: '', description: '', receipt_url: '', ticket_id: '', project_id: '', reference_note: '', ot_from: '', ot_to: '' }

export default function ClaimsPage() {
  const [role, setRole] = useState('')
  const [claims, setClaims] = useState<Claim[]>([])
  const [tickets, setTickets] = useState<Ref[]>([])
  const [projects, setProjects] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all' | 'mine'>('pending')
  const [showApply, setShowApply] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [empFilter, setEmpFilter] = useState('')

  const isReviewer = ['admin', 'manager', 'hr'].includes(role)
  const shownClaims = empFilter ? claims.filter(c => c.user_id === empFilter) : claims

  async function load() {
    setLoading(true)
    const scope = (!isReviewer || filter === 'mine') ? '&scope=mine' : ''
    const status = ['pending', 'approved', 'rejected'].includes(filter) ? `&status=${filter}` : ''
    const res = await fetch(`/api/claims?x=1${scope}${status}`)
    const data = await res.json()
    setClaims(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setRole(d?.role ?? '')) }, [])
  useEffect(() => { load() }, [filter, role]) // eslint-disable-line
  useEffect(() => {
    fetch('/api/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []))
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d =>
      setEmployees(Array.isArray(d) ? d.map((u: { id: string; full_name: string }) => ({ id: u.id, full_name: u.full_name })) : []))
  }, [])

  async function apply() {
    if (!form.claim_date) return setError('Please choose the date.')
    if (form.claim_type === 'ot') {
      if (!form.ot_from || !form.ot_to) return setError('Please set OT from and to times.')
    } else if (!form.amount || Number(form.amount) <= 0) {
      return setError('Please enter a valid amount.')
    }
    setSaving(true); setError('')
    const res = await fetch('/api/claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: form.claim_type === 'ot' ? 0 : Number(form.amount) }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error); return }
    setShowApply(false); setForm(emptyForm); setFilter('mine'); load()
  }

  async function uploadReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/leave/upload', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) { const j = await res.json(); setForm(f => ({ ...f, receipt_url: j.url })) }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/claims/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }
  async function cancel(id: string) {
    if (!confirm('Cancel this claim?')) return
    await fetch(`/api/claims/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
    load()
  }

  function exportExcel() {
    const rows = [
      ['Staff', 'Type', 'Amount (RM)', 'Date', 'OT From', 'OT To', 'Linked', 'Description', 'Status', 'Reviewed By'],
      ...shownClaims.map(c => [
        c.users?.full_name ?? '—',
        TYPE_LABEL[c.claim_type] ?? c.claim_type,
        Number(c.amount).toFixed(2),
        c.claim_date,
        c.ot_from ?? '',
        c.ot_to ?? '',
        c.tickets?.ticket_no ?? (c.projects ? `${c.projects.project_no} ${c.projects.name}` : c.reference_note ?? ''),
        c.description ?? '',
        c.status,
        c.reviewer?.full_name ?? '',
      ]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Claims')
    XLSX.writeFile(wb, `Claims_${filter}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const pendingTotal = shownClaims.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const approvedTotal = shownClaims.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Claims</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {isReviewer ? 'Review expense claims' : 'Submit and track your expense claims'}
            {' · '}Pending RM {pendingTotal.toFixed(2)} · Approved RM {approvedTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReviewer && (
            <button onClick={exportExcel} disabled={shownClaims.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FileDown size={15} /> Export Excel
            </button>
          )}
          <Button onClick={() => { setShowApply(true); setForm(emptyForm); setError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> New Claim</span>
          </Button>
        </div>
      </div>

      {isReviewer && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all', 'mine'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize"
              style={filter === f ? { background: '#f97316', color: '#fff', borderColor: '#f97316' } : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {f === 'mine' ? 'My Claims' : f}
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
      ) : shownClaims.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Receipt size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No claims.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shownClaims.map(c => {
            const st = STATUS_STYLE[c.status]
            const link = c.tickets?.ticket_no ?? (c.projects ? `${c.projects.project_no} · ${c.projects.name}` : c.reference_note)
            return (
              <div key={c.id} className="rounded-xl border p-4 flex items-start justify-between gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isReviewer && <span className="font-medium text-sm" style={{ color: 'var(--text-base)' }}>{c.users?.full_name ?? '—'}</span>}
                    <span className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>
                      {c.claim_type === 'ot' ? `OT ${c.ot_from ?? ''}–${c.ot_to ?? ''}` : `RM ${Number(c.amount).toFixed(2)}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{TYPE_LABEL[c.claim_type] ?? c.claim_type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: st.bg, color: st.color }}>{c.status}</span>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    {fmt(c.claim_date)}{c.claim_type === 'ot' && c.ot_from ? `  ·  ${c.ot_from}–${c.ot_to ?? ''}` : ''}{link ? `  ·  ${link}` : ''}
                  </p>
                  {c.description && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {c.receipt_url && <a href={c.receipt_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: 'var(--color-info)' }}><Paperclip size={11} /> Receipt</a>}
                    {c.reviewed_at && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Reviewed by {c.reviewer?.full_name ?? '—'}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isReviewer && c.status === 'pending' ? (
                    <>
                      <button onClick={() => review(c.id, 'approved')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}><Check size={13} /> Approve</button>
                      <button onClick={() => review(c.id, 'rejected')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><X size={13} /> Reject</button>
                    </>
                  ) : c.status === 'pending' ? (
                    <button onClick={() => cancel(c.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}>Cancel</button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showApply && (
        <Modal title="New Expense Claim" onClose={() => setShowApply(false)} width="max-w-md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.claim_type} onChange={e => setForm(f => ({ ...f, claim_type: e.target.value }))}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              {form.claim_type !== 'ot' && (
                <Field label="Amount (RM)" required><Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></Field>
              )}
            </div>
            <Field label={form.claim_type === 'ot' ? 'OT Date' : 'Claim Date'} required><Input type="date" value={form.claim_date} onChange={e => setForm(f => ({ ...f, claim_date: e.target.value }))} /></Field>
            {form.claim_type === 'ot' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From"><Input type="time" value={form.ot_from} onChange={e => setForm(f => ({ ...f, ot_from: e.target.value }))} /></Field>
                <Field label="To"><Input type="time" value={form.ot_to} onChange={e => setForm(f => ({ ...f, ot_to: e.target.value }))} /></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Link to Ticket" hint="optional">
                <Select value={form.ticket_id} onChange={e => setForm(f => ({ ...f, ticket_id: e.target.value, project_id: '' }))}>
                  <option value="">— None —</option>
                  {tickets.map(t => <option key={t.id} value={t.id}>{t.ticket_no} — {t.title}</option>)}
                </Select>
              </Field>
              <Field label="Link to Project" hint="optional">
                <Select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value, ticket_id: '' }))}>
                  <option value="">— None —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_no} — {p.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Reference Note" hint="e.g. a PM visit (optional)"><Input value={form.reference_note} onChange={e => setForm(f => ({ ...f, reference_note: e.target.value }))} /></Field>
            <Field label="Description"><Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <Field label="Receipt" hint="photo or PDF">
              <div className="flex items-center gap-3">
                <label className="text-xs px-3 py-2 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
                  {uploading ? 'Uploading…' : 'Choose file'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadReceipt} />
                </label>
                {form.receipt_url && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-success)' }}><CheckCircle2 size={13} /> Attached</span>}
              </div>
            </Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowApply(false)}>Cancel</Button>
              <Button onClick={apply} loading={saving}>Submit Claim</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
