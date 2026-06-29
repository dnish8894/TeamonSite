'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Plus, Pencil, UserCheck, Undo2, History, CalendarDays } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Equipment {
  id: string; name: string; category: string; asset_tag: string | null; serial_no: string | null
  brand: string | null; model: string | null; purchase_date: string | null; value: number | null
  condition: string; status: string; location: string | null; notes: string | null
  assigned_to: string | null; holder: { full_name: string } | null
}
interface UserOpt { id: string; full_name: string }
interface LogEntry { id: string; action: string; note: string | null; at: string; user: { full_name: string } | null; recorder: { full_name: string } | null }

const CATEGORIES = [
  { key: 'tool', label: 'Tool' }, { key: 'instrument', label: 'Instrument' }, { key: 'laptop', label: 'Laptop' },
  { key: 'ladder', label: 'Ladder' }, { key: 'vehicle', label: 'Vehicle' }, { key: 'other', label: 'Other' },
]
const CONDITIONS = [{ key: 'new', label: 'New' }, { key: 'good', label: 'Good' }, { key: 'fair', label: 'Fair' }, { key: 'poor', label: 'Poor' }]
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  available:    { label: 'Available',    color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  in_use:       { label: 'In Use',       color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  under_repair: { label: 'Under Repair', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  retired:      { label: 'Retired',      color: 'var(--text-subtle)',   bg: 'var(--border)'          },
}
const emptyForm = { name: '', category: 'tool', asset_tag: '', serial_no: '', brand: '', model: '', purchase_date: '', value: '', condition: 'good', location: '', notes: '' }

export default function EquipmentPage() {
  const router = useRouter()
  const [items, setItems] = useState<Equipment[]>([])
  const [users, setUsers] = useState<UserOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('')
  const [catF, setCatF] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignFor, setAssignFor] = useState<Equipment | null>(null)
  const [assignUser, setAssignUser] = useState('')
  const [historyFor, setHistoryFor] = useState<Equipment | null>(null)
  const [history, setHistory] = useState<LogEntry[]>([])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusF) params.set('status', statusF)
    if (catF) params.set('category', catF)
    const res = await fetch(`/api/equipment?${params.toString()}`)
    setItems(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [statusF, catF])
  useEffect(() => { fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])) }, [])

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const url = editId ? `/api/equipment/${editId}` : '/api/equipment'
    const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error); return }
    setShowForm(false); setEditId(null); setForm(emptyForm); load()
  }

  function openEdit(e: Equipment) {
    setEditId(e.id)
    setForm({ name: e.name, category: e.category, asset_tag: e.asset_tag ?? '', serial_no: e.serial_no ?? '', brand: e.brand ?? '', model: e.model ?? '', purchase_date: e.purchase_date ?? '', value: e.value != null ? String(e.value) : '', condition: e.condition, location: e.location ?? '', notes: e.notes ?? '' })
    setError(''); setShowForm(true)
  }

  async function assign() {
    if (!assignFor || !assignUser) return
    await fetch(`/api/equipment/${assignFor.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'checkout', user_id: assignUser }) })
    setAssignFor(null); setAssignUser(''); load()
  }
  async function returnItem(e: Equipment) {
    await fetch(`/api/equipment/${e.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'return' }) })
    load()
  }
  async function setRepair(e: Equipment, repair: boolean) {
    await fetch(`/api/equipment/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: repair ? 'under_repair' : 'available' }) })
    load()
  }
  async function openHistory(e: Equipment) {
    setHistoryFor(e)
    const res = await fetch(`/api/equipment/${e.id}`)
    const data = await res.json()
    setHistory(data?.log ?? [])
  }

  const counts = {
    total: items.length,
    available: items.filter(i => i.status === 'available').length,
    in_use: items.filter(i => i.status === 'in_use').length,
    repair: items.filter(i => i.status === 'under_repair').length,
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Company Equipment</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Company-owned tools & equipment register</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/equipment/bookings')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
            <CalendarDays size={15} /> Bookings
          </button>
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Add Equipment</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: counts.total, color: 'var(--color-info)' },
          { label: 'Available', value: counts.available, color: 'var(--color-success)' },
          { label: 'In Use', value: counts.in_use, color: 'var(--color-info)' },
          { label: 'Under Repair', value: counts.repair, color: 'var(--color-warning)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={catF} onChange={e => setCatF(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
      </div>

      {loading ? <p style={{ color: 'var(--text-subtle)' }}>Loading...</p> : items.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Wrench size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No equipment yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Equipment', 'Category', 'Condition', 'Status', 'Held By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(e => {
                const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.available
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-base)' }}>{e.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {e.asset_tag ? `${e.asset_tag} · ` : ''}{e.serial_no ?? e.model ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{e.category}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{e.condition}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{e.holder?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {e.status === 'available' && (
                          <button onClick={() => { setAssignFor(e); setAssignUser('') }} title="Assign / check out" className="p-1.5 rounded-lg" style={{ color: 'var(--color-info)' }}><UserCheck size={15} /></button>
                        )}
                        {e.status === 'in_use' && (
                          <button onClick={() => returnItem(e)} title="Return" className="p-1.5 rounded-lg" style={{ color: 'var(--color-success)' }}><Undo2 size={15} /></button>
                        )}
                        {e.status !== 'retired' && (
                          <button onClick={() => setRepair(e, e.status !== 'under_repair')} title={e.status === 'under_repair' ? 'Mark available' : 'Mark under repair'}
                            className="p-1.5 rounded-lg" style={{ color: 'var(--color-warning)' }}><Wrench size={15} /></button>
                        )}
                        <button onClick={() => openHistory(e)} title="History" className="p-1.5 rounded-lg" style={{ color: 'var(--text-subtle)' }}><History size={15} /></button>
                        <button onClick={() => openEdit(e)} title="Edit" className="p-1.5 rounded-lg" style={{ color: 'var(--text-subtle)' }}><Pencil size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <Modal title={editId ? 'Edit Equipment' : 'Add Equipment'} onClose={() => { setShowForm(false); setEditId(null) }} width="max-w-lg">
          <div className="space-y-4">
            <Field label="Name" required><Input placeholder="e.g. Fluke Multimeter" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
              <Field label="Condition"><Select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>{CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Asset Tag"><Input value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} /></Field>
              <Field label="Serial No."><Input value={form.serial_no} onChange={e => setForm(f => ({ ...f, serial_no: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand"><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></Field>
              <Field label="Model"><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Purchase Date"><Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></Field>
              <Field label="Value (RM)"><Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></Field>
            </div>
            <Field label="Storage Location"><Input placeholder="e.g. Store room A" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Field>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
              <Button onClick={save} loading={saving}>{editId ? 'Save Changes' : 'Add Equipment'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign modal */}
      {assignFor && (
        <Modal title={`Check Out — ${assignFor.name}`} onClose={() => setAssignFor(null)} width="max-w-sm">
          <div className="space-y-4">
            <Field label="Assign to" required>
              <Select value={assignUser} onChange={e => setAssignUser(e.target.value)}>
                <option value="">Select person...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
              <Button onClick={assign}>Check Out</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* History modal */}
      {historyFor && (
        <Modal title={`History — ${historyFor.name}`} onClose={() => setHistoryFor(null)} width="max-w-md">
          {history.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No activity yet.</p> : (
            <div className="space-y-2">
              {history.map(l => (
                <div key={l.id} className="flex items-center justify-between text-sm py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-base)' }}>
                    {l.action === 'checkout' ? `Checked out to ${l.user?.full_name ?? '—'}` : `Returned by ${l.user?.full_name ?? '—'}`}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{new Date(l.at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
