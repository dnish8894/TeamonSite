'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Booking {
  id: string; from_date: string; to_date: string; purpose: string | null
  user_id: string; equipment_id: string
  users: { full_name: string } | null
  company_equipment: { name: string; asset_tag: string | null } | null
}
interface Equip { id: string; name: string; asset_tag: string | null; status: string }
interface UserOpt { id: string; full_name: string }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [equipment, setEquipment] = useState<Equip[]>([])
  const [users, setUsers] = useState<UserOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ equipment_id: '', user_id: '', from_date: '', to_date: '', purpose: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/equipment/bookings')
    setBookings(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    fetch('/api/equipment').then(r => r.json()).then(d => setEquipment(Array.isArray(d) ? d.filter((e: Equip) => e.status !== 'retired') : []))
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []))
  }, [])

  async function create() {
    if (!form.equipment_id) return setError('Select equipment.')
    if (!form.from_date || !form.to_date) return setError('Choose start and end dates.')
    setSaving(true); setError('')
    const res = await fetch('/api/equipment/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error); return }
    setShowNew(false); setForm({ equipment_id: '', user_id: '', from_date: '', to_date: '', purpose: '' }); load()
  }
  async function cancel(id: string) {
    if (!confirm('Cancel this booking?')) return
    await fetch(`/api/equipment/bookings/${id}`, { method: 'DELETE' })
    load()
  }

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return bookings.filter(b => b.to_date >= today)
  }, [bookings])

  // Calendar: bookings overlapping the viewed month
  const totalDays = new Date(month.y, month.m + 1, 0).getDate()
  const firstDow = new Date(month.y, month.m, 1).getDay()
  function onDay(day: number): Booking[] {
    const d = `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return bookings.filter(b => b.from_date <= d && b.to_date >= d)
  }

  return (
    <div className="p-8">
      <button onClick={() => router.push('/equipment')} className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Back to Equipment
      </button>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Equipment Bookings</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Reserve shared equipment ahead of time</p>
        </div>
        <Button onClick={() => { setShowNew(true); setError('') }}><span className="flex items-center gap-2"><Plus size={16} /> New Booking</span></Button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><CalendarDays size={16} style={{ color: '#f97316' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Booking Calendar</h2></div>
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
            const list = onDay(day)
            return (
              <div key={day} className="rounded-lg p-1.5 min-h-[52px] border text-xs" style={{ borderColor: 'var(--border)', background: list.length ? 'var(--color-info-bg)' : 'transparent' }}>
                <div style={{ color: 'var(--text-subtle)' }}>{day}</div>
                {list.slice(0, 2).map(b => <div key={b.id} className="truncate font-medium" style={{ color: 'var(--color-info)' }}>{b.company_equipment?.name}</div>)}
                {list.length > 2 && <div style={{ color: 'var(--color-info)' }}>+{list.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-base)' }}>Upcoming Bookings</h2>
      {loading ? <p style={{ color: 'var(--text-subtle)' }}>Loading...</p> : upcoming.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No upcoming bookings.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map(b => (
            <div key={b.id} className="rounded-xl border p-4 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                  {b.company_equipment?.name}{b.company_equipment?.asset_tag ? ` · ${b.company_equipment.asset_tag}` : ''}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmt(b.from_date)} → {fmt(b.to_date)} · {b.users?.full_name ?? '—'}{b.purpose ? ` · ${b.purpose}` : ''}</p>
              </div>
              <button onClick={() => cancel(b.id)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }} title="Cancel"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="New Booking" onClose={() => setShowNew(false)} width="max-w-md">
          <div className="space-y-4">
            <Field label="Equipment" required>
              <Select value={form.equipment_id} onChange={e => setForm(f => ({ ...f, equipment_id: e.target.value }))}>
                <option value="">Select equipment...</option>
                {equipment.map(e => <option key={e.id} value={e.id}>{e.name}{e.asset_tag ? ` (${e.asset_tag})` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Booked For">
              <Select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                <option value="">Me</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" required><Input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} /></Field>
              <Field label="To" required><Input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} /></Field>
            </div>
            <Field label="Purpose"><Textarea rows={2} placeholder="Job / reason (optional)" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={create} loading={saving}>Create Booking</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
