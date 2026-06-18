'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Phone, FileDown, Sheet, CalendarDays, Users,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ── Types ────────────────────────────────────────────────────────────────────
interface StandbyUser {
  id: string
  full_name: string
  role: string
  phone: string | null
  avatar_url: string | null
}

interface StandbyEntry {
  id: string
  schedule_date: string
  shift: string
  notes: string | null
  user_id: string
  users: StandbyUser
}

interface AppUser {
  id: string
  full_name: string
  role: string
  phone: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const SHIFT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  all_day:   { label: 'All Day',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  morning:   { label: 'Morning',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  afternoon: { label: 'Afternoon', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  night:     { label: 'Night',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
}

const ROLE_ELIGIBLE = ['engineer', 'manager', 'admin']

const ROLE_COLOR: Record<string, string> = {
  admin:    '#f97316',
  manager:  '#60a5fa',
  engineer: '#34d399',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function dayOfWeek(year: number, month: number, day: number) {
  // 0=Sun … 6=Sat
  return new Date(year, month - 1, day).getDay()
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StandbyPage() {
  const today    = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-based

  const [entries,  setEntries]  = useState<StandbyEntry[]>([])
  const [engineers, setEngineers] = useState<AppUser[]>([])
  const [loading,  setLoading]  = useState(true)

  // Assign panel state
  const [assignDate,   setAssignDate]   = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignShift,  setAssignShift]  = useState('all_day')
  const [assignNotes,  setAssignNotes]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [assignError,  setAssignError]  = useState('')
  const [view,         setView]         = useState<'calendar' | 'engineers'>('calendar')

  // Load engineers once
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then((all: AppUser[]) =>
      setEngineers(all.filter(u => ROLE_ELIGIBLE.includes(u.role)))
    )
  }, [])

  const loadMonth = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/standby?year=${year}&month=${month}`)
    const json = await res.json()
    setEntries(Array.isArray(json) ? json : [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadMonth() }, [loadMonth])

  // ── Navigation ──────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // ── Assign / delete ──────────────────────────────────────────────────────
  function openAssign(date: string) {
    setAssignDate(date)
    setAssignUserId(engineers[0]?.id ?? '')
    setAssignShift('all_day')
    setAssignNotes('')
    setAssignError('')
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignUserId) return setAssignError('Please select an engineer.')
    setSaving(true); setAssignError('')
    const res = await fetch('/api/standby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule_date: assignDate, user_id: assignUserId, shift: assignShift, notes: assignNotes }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) return setAssignError(json.error)
    setAssignDate(null)
    loadMonth()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this standby assignment?')) return
    await fetch(`/api/standby/${id}`, { method: 'DELETE' })
    loadMonth()
  }

  // ── Export PDF ──────────────────────────────────────────────────────────
  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    const title = `Standby Engineer Schedule — ${MONTH_NAMES[month - 1]} ${year}`

    // Header bar
    doc.setFillColor(249, 115, 22)
    doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255,255,255)
    doc.text(title, 14, 13)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(255,220,180)
    doc.text(`Generated ${new Date().toLocaleDateString('en-MY')}`, 14, 19)

    const total = daysInMonth(year, month)
    const rows: (string | number)[][] = []
    for (let d = 1; d <= total; d++) {
      const iso = isoDate(year, month, d)
      const dayEntries = entries.filter(e => e.schedule_date === iso)
      const weekday = new Date(iso).toLocaleDateString('en-MY', { weekday: 'short' })
      const isWeekend = [0, 6].includes(new Date(iso).getDay())
      if (dayEntries.length === 0) {
        rows.push([`${d} ${weekday}`, isWeekend ? '(Weekend)' : '—', '', ''])
      } else {
        dayEntries.forEach((entry, i) => {
          rows.push([
            i === 0 ? `${d} ${weekday}` : '',
            entry.users.full_name,
            SHIFT_STYLE[entry.shift]?.label ?? entry.shift,
            entry.notes ?? '',
          ])
        })
      }
    }

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Engineer', 'Shift', 'Notes']],
      body: rows,
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 70 },
        2: { cellWidth: 28 },
        3: { cellWidth: 140 },
      },
      didParseCell(data) {
        if (data.section === 'body') {
          const dateStr = String(data.row.raw[0])
          if (dateStr) {
            const dayNum = parseInt(dateStr)
            if (!isNaN(dayNum)) {
              const iso = isoDate(year, month, dayNum)
              if ([0, 6].includes(new Date(iso).getDay())) {
                data.cell.styles.fillColor = [40, 36, 32]
              }
            }
          }
        }
      },
    })

    doc.save(`Standby_${MONTH_NAMES[month - 1]}_${year}.pdf`)
  }

  // ── Export Excel ────────────────────────────────────────────────────────
  function exportExcel() {
    const total = daysInMonth(year, month)
    const rows: (string | number)[][] = [
      ['Date', 'Day', 'Engineer', 'Role', 'Phone', 'Shift', 'Notes'],
    ]
    for (let d = 1; d <= total; d++) {
      const iso = isoDate(year, month, d)
      const dayEntries = entries.filter(e => e.schedule_date === iso)
      const weekday = new Date(iso).toLocaleDateString('en-MY', { weekday: 'long' })
      if (dayEntries.length === 0) {
        rows.push([iso, weekday, '—', '', '', '', ''])
      } else {
        dayEntries.forEach(entry => {
          rows.push([
            iso, weekday,
            entry.users.full_name,
            entry.users.role,
            entry.users.phone ?? '',
            SHIFT_STYLE[entry.shift]?.label ?? entry.shift,
            entry.notes ?? '',
          ])
        })
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [14, 14, 28, 12, 16, 14, 40].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES[month - 1]} ${year}`)
    XLSX.writeFile(wb, `Standby_${MONTH_NAMES[month - 1]}_${year}.xlsx`)
  }

  // ── Calendar build ───────────────────────────────────────────────────────
  const totalDays = daysInMonth(year, month)
  const firstDow  = dayOfWeek(year, month, 1) // 0=Sun
  // Build weeks array: each week is 7 cells (null = blank padding)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const todayIso = today.toISOString().split('T')[0]

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
            Standby Schedule
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Monthly on-call roster for engineers, managers and admins
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setView('calendar')}
              className="flex items-center gap-1.5 text-xs px-3 py-2 transition-colors"
              style={view === 'calendar'
                ? { background: '#f97316', color: '#fff' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              <CalendarDays size={13} /> Calendar
            </button>
            <button onClick={() => setView('engineers')}
              className="flex items-center gap-1.5 text-xs px-3 py-2 transition-colors"
              style={view === 'engineers'
                ? { background: '#f97316', color: '#fff' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              <Users size={13} /> Engineers
            </button>
          </div>
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Export Excel
          </button>
          <button onClick={exportPdf}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth}
          className="p-2 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            {entries.length} assignment{entries.length !== 1 ? 's' : ''} this month
          </p>
        </div>
        <button onClick={nextMonth}
          className="p-2 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f97316')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }}
          className="ml-2 text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          Today
        </button>
      </div>

      {/* ── Engineers View ──────────────────────────────────────────────── */}
      {view === 'engineers' && (
        <div className="space-y-4">
          {engineers.length === 0 && (
            <div className="text-center py-10" style={{ color: 'var(--text-subtle)' }}>No engineers found.</div>
          )}
          {engineers.map(eng => {
            const engEntries = entries.filter(e => e.user_id === eng.id)
            const totalDays  = engEntries.length
            const rc         = ROLE_COLOR[eng.role] ?? 'var(--text-muted)'
            const totalDaysInMonth = daysInMonth(year, month)

            // shift counts
            const shiftCounts: Record<string, number> = {}
            engEntries.forEach(e => { shiftCounts[e.shift] = (shiftCounts[e.shift] ?? 0) + 1 })

            return (
              <div key={eng.id} className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                {/* Engineer header */}
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: rc + '25', color: rc }}>
                      {eng.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{eng.full_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ color: rc, background: rc + '20' }}>{eng.role}</span>
                        {eng.phone && (
                          <a href={`tel:${eng.phone}`} className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--text-subtle)' }}>
                            <Phone size={10} /> {eng.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Shift breakdown chips */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {Object.entries(shiftCounts).map(([shift, cnt]) => {
                        const ss = SHIFT_STYLE[shift] ?? SHIFT_STYLE.all_day
                        return (
                          <span key={shift} className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ color: ss.color, background: ss.bg }}>
                            {ss.label} ×{cnt}
                          </span>
                        )
                      })}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold" style={{ color: totalDays > 0 ? '#f97316' : 'var(--text-subtle)' }}>
                        {totalDays}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>day{totalDays !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>

                {/* Day dots row */}
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map(day => {
                      const iso = isoDate(year, month, day)
                      const entry = engEntries.find(e => e.schedule_date === iso)
                      const isToday = iso === todayIso
                      const isWeekend = [0, 6].includes(new Date(iso).getDay())
                      const ss = entry ? (SHIFT_STYLE[entry.shift] ?? SHIFT_STYLE.all_day) : null

                      return (
                        <div key={day} title={entry ? `${iso} — ${ss?.label}${entry.notes ? ` · ${entry.notes}` : ''}` : iso}
                          className="relative flex items-center justify-center rounded-md text-xs font-medium transition-all cursor-default"
                          style={{
                            width: 32, height: 32,
                            background: ss ? ss.bg : isWeekend ? 'rgba(0,0,0,0.08)' : 'var(--bg-base)',
                            color: ss ? ss.color : isWeekend ? 'var(--text-subtle)' : 'var(--text-muted)',
                            border: isToday ? '2px solid #f97316' : '1px solid var(--border)',
                            fontWeight: ss ? 700 : 400,
                          }}>
                          {day}
                          {ss && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                              style={{ background: ss.color }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Assignments list */}
                {engEntries.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-xs">
                      <tbody>
                        {engEntries
                          .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date))
                          .map(entry => {
                            const ss = SHIFT_STYLE[entry.shift] ?? SHIFT_STYLE.all_day
                            const dateObj = new Date(entry.schedule_date + 'T00:00')
                            return (
                              <tr key={entry.id} className="border-b last:border-b-0"
                                style={{ borderColor: 'var(--border)' }}>
                                <td className="px-4 py-2" style={{ color: 'var(--text-muted)', width: 140 }}>
                                  {dateObj.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </td>
                                <td className="px-2 py-2">
                                  <span className="px-2 py-0.5 rounded-full font-medium"
                                    style={{ color: ss.color, background: ss.bg }}>{ss.label}</span>
                                </td>
                                <td className="px-2 py-2" style={{ color: 'var(--text-subtle)' }}>
                                  {entry.notes ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button onClick={() => handleDelete(entry.id)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: 'var(--text-subtle)' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {engEntries.length === 0 && (
                  <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    Not assigned this month
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Calendar View ────────────────────────────────────────────────── */}
      {view === 'calendar' && <>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(SHIFT_STYLE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ color: v.color, background: v.bg }}>
            {v.label}
          </span>
        ))}
        <span className="ml-auto text-xs" style={{ color: 'var(--text-subtle)' }}>
          Click a date to assign standby engineer
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-center uppercase tracking-wide"
              style={{
                color: d === 'Sun' || d === 'Sat' ? '#f97316' : 'var(--text-subtle)',
                background: 'var(--bg-base)',
              }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-subtle)' }}>Loading…</div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}>
              {week.map((day, di) => {
                if (!day) return (
                  <div key={di} className="p-2 min-h-[100px] border-r last:border-r-0"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }} />
                )

                const iso = isoDate(year, month, day)
                const dayEntries = entries.filter(e => e.schedule_date === iso)
                const isToday   = iso === todayIso
                const isWeekend = di === 0 || di === 6

                return (
                  <div key={di}
                    className="p-2 min-h-[100px] border-r last:border-r-0 cursor-pointer group"
                    style={{
                      borderColor: 'var(--border)',
                      background: isToday ? 'rgba(249,115,22,0.06)' : isWeekend ? 'rgba(0,0,0,0.12)' : 'transparent',
                    }}
                    onClick={() => openAssign(iso)}>
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full"
                        style={{
                          color:      isToday ? '#fff' : isWeekend ? '#f97316' : 'var(--text-muted)',
                          background: isToday ? '#f97316' : 'transparent',
                        }}>
                        {day}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#f97316' }}>
                        <Plus size={12} />
                      </span>
                    </div>

                    {/* Assignments */}
                    <div className="space-y-0.5">
                      {dayEntries.map(entry => {
                        const ss = SHIFT_STYLE[entry.shift] ?? SHIFT_STYLE.all_day
                        return (
                          <div key={entry.id}
                            className="flex items-center justify-between gap-1 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: ss.bg, color: ss.color }}
                            onClick={e => e.stopPropagation()}>
                            <span className="truncate font-medium leading-none">
                              {entry.users.full_name.split(' ')[0]}
                            </span>
                            <button onClick={() => handleDelete(entry.id)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: ss.color }}
                              title="Remove">
                              <X size={10} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Summary list below calendar */}
      {entries.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-base)' }}>
            {MONTH_NAMES[month - 1]} {year} — Full Roster
          </h3>
          <div className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Engineer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Shift</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Notes</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const ss = SHIFT_STYLE[entry.shift] ?? SHIFT_STYLE.all_day
                  const rc = ROLE_COLOR[entry.users.role] ?? 'var(--text-muted)'
                  const dateObj = new Date(entry.schedule_date + 'T00:00')
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-xs" style={{ color: 'var(--text-base)' }}>
                          {dateObj.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: rc + '20', color: rc }}>
                            {entry.users.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: 'var(--text-base)' }}>{entry.users.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{ color: rc, background: rc + '20' }}>
                          {entry.users.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {entry.users.phone ? (
                          <a href={`tel:${entry.users.phone}`}
                            className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--color-info)' }}>
                            <Phone size={11} /> {entry.users.phone}
                          </a>
                        ) : <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ color: ss.color, background: ss.bg }}>
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {entry.notes ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleDelete(entry.id)}
                          className="p-1 rounded transition-colors"
                          style={{ color: 'var(--text-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </> /* end calendar view */}

      {/* Assign slide-over panel */}
      {assignDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAssignDate(null)} />
          <div className="relative rounded-t-2xl sm:rounded-2xl border w-full max-w-sm mx-auto p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-base)' }}>Assign Standby</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                  {new Date(assignDate + 'T00:00').toLocaleDateString('en-MY', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              <button onClick={() => setAssignDate(null)} style={{ color: 'var(--text-subtle)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Existing on this day */}
            {(() => {
              const existing = entries.filter(e => e.schedule_date === assignDate)
              if (!existing.length) return null
              return (
                <div className="mb-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-subtle)' }}>
                    Currently assigned
                  </p>
                  {existing.map(e => {
                    const ss = SHIFT_STYLE[e.shift] ?? SHIFT_STYLE.all_day
                    return (
                      <div key={e.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg"
                        style={{ background: ss.bg, color: ss.color }}>
                        <span className="font-medium">{e.users.full_name} · {ss.label}</span>
                        <button onClick={() => handleDelete(e.id)} style={{ color: ss.color }}>
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Form */}
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>
                  Engineer / Manager
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}>
                  <option value="">— Select person —</option>
                  {engineers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>
                  Shift
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SHIFT_STYLE).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => setAssignShift(k)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border transition-all"
                      style={assignShift === k
                        ? { background: v.bg, color: v.color, borderColor: v.color }
                        : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>
                  Notes (optional)
                </label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
                  placeholder="e.g. Primary contact, carry laptop"
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                />
              </div>

              {assignError && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                  {assignError}
                </p>
              )}

              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
                style={{ background: '#f97316', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Assign Standby'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
