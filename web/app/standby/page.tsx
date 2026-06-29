'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Phone, FileDown, Sheet, CalendarRange,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface StandbyUser { id: string; full_name: string; role: string; phone: string | null }
interface WeekEntry {
  id: string; week_start: string; notes: string | null; user_id: string
  users: StandbyUser
}
interface AppUser { id: string; full_name: string; role: string; phone: string | null }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const ROLE_COLOR: Record<string, string> = { admin: '#f97316', manager: '#60a5fa', engineer: '#34d399', project: '#a78bfa' }

function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function addDays(iso: string, n: number): Date {
  const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return d
}
function fmtShort(d: Date) { return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) }
function weekLabel(weekStart: string) {
  const start = new Date(weekStart + 'T00:00'); const end = addDays(weekStart, 6)
  return `${fmtShort(start)} – ${fmtShort(end)}`
}

// Mondays whose week overlaps the given month.
function weeksOfMonth(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1)
  const last  = new Date(year, month, 0)
  const weeks: string[] = []
  let cursor = mondayOf(first)
  while (new Date(cursor + 'T00:00') <= last) {
    weeks.push(cursor)
    cursor = mondayOf(addDays(cursor, 7))
  }
  return weeks
}

export default function StandbyPage() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [entries, setEntries] = useState<WeekEntry[]>([])
  const [engineers, setEngineers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  const [assignWeek, setAssignWeek] = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Pull from the Engineers registry so the list matches the Engineers tab,
    // regardless of the linked user's role.
    fetch('/api/engineers').then(r => r.json()).then((engs: { engineer_type?: string; users: { id: string; full_name: string; role: string; phone: string | null; is_active: boolean } | null }[]) => {
      const list = (Array.isArray(engs) ? engs : [])
        .map(e => e.users)
        .filter((u): u is { id: string; full_name: string; role: string; phone: string | null; is_active: boolean } => !!u && u.is_active)
        .map(u => ({ id: u.id, full_name: u.full_name, role: u.role, phone: u.phone }))
      // De-dupe by user id
      const seen = new Set<string>()
      setEngineers(list.filter(u => !seen.has(u.id) && seen.add(u.id)))
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/standby-weeks?year=${year}&month=${month}`)
    const json = await res.json()
    setEntries(Array.isArray(json) ? json : [])
    setLoading(false)
  }, [year, month])
  useEffect(() => { load() }, [load])

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const weeks = weeksOfMonth(year, month)
  const byWeek = (ws: string) => entries.filter(e => e.week_start === ws)

  function openAssign(week: string) {
    setAssignWeek(week); setAssignUserId(engineers[0]?.id ?? ''); setAssignNotes(''); setError('')
  }
  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignUserId) return setError('Please select an engineer.')
    setSaving(true); setError('')
    const res = await fetch('/api/standby-weeks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: assignWeek, user_id: assignUserId, notes: assignNotes }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) return setError(json.error)
    setAssignWeek(null); load()
  }
  async function remove(id: string) {
    if (!confirm('Remove this standby assignment?')) return
    await fetch(`/api/standby-weeks/${id}`, { method: 'DELETE' })
    load()
  }

  function exportRows(): string[][] {
    const rows: string[][] = []
    for (const w of weeks) {
      const list = byWeek(w)
      if (list.length === 0) { rows.push([weekLabel(w), '—', '']); continue }
      list.forEach((e, i) => rows.push([i === 0 ? weekLabel(w) : '', e.users.full_name, e.users.phone ?? '']))
    }
    return rows
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text(`Standby Roster — ${MONTH_NAMES[month - 1]} ${year}`, 14, 16)
    autoTable(doc, {
      startY: 22,
      head: [['Week', 'Engineer', 'Phone']],
      body: exportRows(),
      theme: 'grid',
      headStyles: { fillColor: [30, 33, 48] },
      styles: { fontSize: 9 },
    })
    doc.save(`Standby_${MONTH_NAMES[month - 1]}_${year}.pdf`)
  }
  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet([['Week', 'Engineer', 'Phone'], ...exportRows()])
    ws['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Standby')
    XLSX.writeFile(wb, `Standby_${MONTH_NAMES[month - 1]}_${year}.xlsx`)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Standby Roster</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Assign engineers to standby duty, week by week</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPdf} disabled={entries.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <FileDown size={15} /> PDF
          </button>
          <button onClick={exportExcel} disabled={entries.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Sheet size={15} /> Excel
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}><ChevronLeft size={18} /></button>
        <span className="text-lg font-semibold w-48 text-center" style={{ color: 'var(--text-base)' }}>{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading…</p>
      ) : (
        <div className="space-y-3">
          {weeks.map(w => {
            const list = byWeek(w)
            const isThisWeek = mondayOf(today) === w
            return (
              <div key={w} className="rounded-xl border p-4"
                style={{ background: 'var(--bg-card)', borderColor: isThisWeek ? 'var(--color-info)' : 'var(--border)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CalendarRange size={16} style={{ color: 'var(--color-info)' }} />
                    <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{weekLabel(w)}</span>
                    {isThisWeek && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>This week</span>}
                  </div>
                  <button onClick={() => openAssign(w)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                    <Plus size={13} /> Add Engineer
                  </button>
                </div>
                {list.length === 0 ? (
                  <p className="text-sm mt-2" style={{ color: 'var(--text-subtle)' }}>No one on standby.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {list.map(e => (
                      <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLOR[e.users.role] ?? 'var(--text-subtle)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{e.users.full_name}</span>
                        {e.users.phone && (
                          <a href={`tel:${e.users.phone}`} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                            <Phone size={11} /> {e.users.phone}
                          </a>
                        )}
                        <button onClick={() => remove(e.id)} style={{ color: 'var(--text-subtle)' }} title="Remove">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {assignWeek && (
        <Modal title={`Assign Standby — ${weekLabel(assignWeek)}`} onClose={() => setAssignWeek(null)} width="max-w-md">
          <form onSubmit={handleAssign} className="space-y-4">
            <Field label="Engineer" required>
              <Select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
                <option value="">— Select —</option>
                {engineers.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.phone ? ` · ${u.phone}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Notes" hint="optional">
              <Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="e.g. primary / backup" />
            </Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setAssignWeek(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
