'use client'

import { useEffect, useState } from 'react'
import { FileDown, Clock4, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Select } from '@/components/ui/Field'

interface EngineerOption { id: string; users: { full_name: string } | null }

interface Checkin {
  id: string
  check_in_at: string
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_landmark: string | null
  check_in_photo: string | null
  check_out_at: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_landmark: string | null
  check_out_photo: string | null
  site_id: string | null
  site_name: string | null
  engineers: { id: string; users: { full_name: string; email: string } | null } | null
  sites: { name: string } | null
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Net worked minutes after auto-deducting a fixed break on shifts over 5 hours.
function netMinutes(inAt: string, outAt: string, breakMin: number): number {
  let mins = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000
  if (mins > 300 && breakMin > 0) mins -= breakMin
  return Math.max(0, Math.round(mins))
}
function durationStr(inAt: string, outAt: string | null, breakMin = 0): string {
  if (!outAt) return '—'
  const mins = netMinutes(inAt, outAt, breakMin)
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function AttendancePage() {
  const [month, setMonth]       = useState(currentMonth())
  const [engineerId, setEngineerId] = useState('')
  const [engineers, setEngineers] = useState<EngineerOption[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading]   = useState(true)
  const [breakMin, setBreakMin] = useState(0)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (engineerId) params.set('engineer_id', engineerId)
    const res = await fetch(`/api/attendance?${params.toString()}`)
    const data = await res.json()
    setCheckins(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [month, engineerId])
  useEffect(() => {
    fetch('/api/engineers').then(r => r.json()).then(data => setEngineers(Array.isArray(data) ? data : []))
    fetch('/api/settings').then(r => r.json()).then(d => setBreakMin(d?.attendance_break_minutes ?? 0))
  }, [])

  function exportExcel() {
    const rows = [
      ['Engineer', 'Email', 'Site', 'Check-In Date', 'Check-In Time', 'Check-In Landmark', 'Check-In Coordinates', 'Check-Out Date', 'Check-Out Time', 'Check-Out Landmark', 'Check-Out Coordinates', 'Hours'],
      ...checkins.map(c => [
        c.engineers?.users?.full_name ?? '—',
        c.engineers?.users?.email ?? '—',
        c.sites?.name ?? c.site_name ?? '—',
        new Date(c.check_in_at).toLocaleDateString('en-MY'),
        new Date(c.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        c.check_in_landmark ?? '—',
        c.check_in_lat != null ? `${c.check_in_lat}, ${c.check_in_lng}` : '—',
        c.check_out_at ? new Date(c.check_out_at).toLocaleDateString('en-MY') : '—',
        c.check_out_at ? new Date(c.check_out_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '—',
        c.check_out_landmark ?? '—',
        c.check_out_lat != null ? `${c.check_out_lat}, ${c.check_out_lng}` : '—',
        durationStr(c.check_in_at, c.check_out_at, breakMin),
      ]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `Attendance_${month}.xlsx`)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Engineer Attendance</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            GPS check-in / check-out log{breakMin > 0 ? ` · Hours are net of a ${breakMin}-min break on shifts over 5h` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={engineerId} onChange={e => setEngineerId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">All Engineers</option>
            {engineers.map(e => (
              <option key={e.id} value={e.id}>{e.users?.full_name ?? 'Unknown'}</option>
            ))}
          </Select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border outline-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text-base)', borderColor: 'var(--border)' }} />
          <button onClick={exportExcel} disabled={checkins.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <FileDown size={15} /> Export to Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : checkins.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Clock4 size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>
            No check-ins for this month{engineerId ? ' for this engineer' : ''}.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Engineer', 'Site', 'Check-In', 'Location', 'Check-Out', 'Location', 'Photos', 'Hours'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checkins.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-base)' }}>{c.engineers?.users?.full_name ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{c.sites?.name ?? c.site_name ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {new Date(c.check_in_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}{' '}
                    {new Date(c.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {c.check_in_lat != null ? (
                      <a className="flex items-center gap-1 hover:underline max-w-[160px]" style={{ color: 'var(--color-info)' }}
                        href={`https://www.google.com/maps?q=${c.check_in_lat},${c.check_in_lng}`} target="_blank" rel="noreferrer">
                        <MapPin size={11} className="shrink-0" /> <span className="truncate">{c.check_in_landmark || 'View on map'}</span>
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {c.check_out_at ? (
                      <>
                        {new Date(c.check_out_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}{' '}
                        {new Date(c.check_out_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                      </>
                    ) : <span style={{ color: 'var(--color-warning)' }}>Still checked in</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {c.check_out_lat != null ? (
                      <a className="flex items-center gap-1 hover:underline max-w-[160px]" style={{ color: 'var(--color-info)' }}
                        href={`https://www.google.com/maps?q=${c.check_out_lat},${c.check_out_lng}`} target="_blank" rel="noreferrer">
                        <MapPin size={11} className="shrink-0" /> <span className="truncate">{c.check_out_landmark || 'View on map'}</span>
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.check_in_photo && <a href={c.check_in_photo} target="_blank" rel="noreferrer"><img src={c.check_in_photo} alt="in" className="w-8 h-8 rounded object-cover border" style={{ borderColor: 'var(--border)' }} /></a>}
                      {c.check_out_photo && <a href={c.check_out_photo} target="_blank" rel="noreferrer"><img src={c.check_out_photo} alt="out" className="w-8 h-8 rounded object-cover border" style={{ borderColor: 'var(--border)' }} /></a>}
                      {!c.check_in_photo && !c.check_out_photo && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-base)' }}>{durationStr(c.check_in_at, c.check_out_at, breakMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
