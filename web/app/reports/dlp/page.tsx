'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, FileDown, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Select } from '@/components/ui/Field'

interface SiteContract {
  id: string
  name: string
  city: string | null
  state: string | null
  contract_type: 'dlp' | 'maintenance'
  contract_start: string | null
  contract_end: string
  clients: { name: string } | null
}

const TYPE_LABEL: Record<string, string> = { dlp: 'DLP', maintenance: 'Maintenance' }

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr + 'T00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}
function fmt(d: string | null) {
  return d ? new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function DlpReportPage() {
  const router = useRouter()
  const [rows, setRows] = useState<SiteContract[]>([])
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<'30' | '60' | '90' | 'all'>('90')
  const [typeFilter, setTypeFilter] = useState<'dlp' | 'maintenance' | 'all'>('dlp')

  useEffect(() => {
    fetch('/api/reports/dlp').then(r => r.json()).then(d => {
      setRows(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'all' && r.contract_type !== typeFilter) return false
    if (windowDays === 'all') return true
    const d = daysUntil(r.contract_end)
    return d <= Number(windowDays) // includes already-expired (negative)
  }), [rows, windowDays, typeFilter])

  const expired  = filtered.filter(r => daysUntil(r.contract_end) < 0).length
  const expiring = filtered.filter(r => { const d = daysUntil(r.contract_end); return d >= 0 && d <= 30 }).length

  function status(d: number) {
    if (d < 0)  return { label: 'Expired',      color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  }
    if (d <= 30) return { label: `${d}d left`,  color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' }
    return { label: `${d}d left`, color: 'var(--color-success)', bg: 'var(--color-success-bg)' }
  }

  function exportExcel() {
    const data = [
      ['Site', 'Client', 'City', 'Type', 'Start', 'End', 'Days Remaining', 'Status'],
      ...filtered.map(r => {
        const d = daysUntil(r.contract_end)
        return [r.name, r.clients?.name ?? '—', r.city ?? '', TYPE_LABEL[r.contract_type], fmt(r.contract_start), fmt(r.contract_end), d, d < 0 ? 'Expired' : `${d} days`]
      }),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 32 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'DLP Tracker')
    XLSX.writeFile(wb, `DLP_Close_to_Completion_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>DLPs Close to Completion</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Contract / defect-liability periods nearing expiry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} style={{ minWidth: 130 }}>
            <option value="dlp">DLP only</option>
            <option value="maintenance">Maintenance</option>
            <option value="all">All types</option>
          </Select>
          <Select value={windowDays} onChange={e => setWindowDays(e.target.value as typeof windowDays)} style={{ minWidth: 150 }}>
            <option value="30">Ending ≤ 30 days</option>
            <option value="60">Ending ≤ 60 days</option>
            <option value="90">Ending ≤ 90 days</option>
            <option value="all">All</option>
          </Select>
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <FileDown size={15} /> Export to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'In View', value: filtered.length, color: 'var(--color-info)', icon: <Clock size={18} /> },
          { label: 'Expiring ≤ 30 days', value: expiring, color: 'var(--color-warning)', icon: <AlertTriangle size={18} /> },
          { label: 'Already Expired', value: expired, color: 'var(--color-danger)', icon: <AlertTriangle size={18} /> },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4 flex items-center gap-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <ShieldCheck size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>{rows.length === 0 ? 'No site contracts recorded.' : 'No contracts match this filter.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Site', 'Client', 'Type', 'Start', 'End', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const d = daysUntil(r.contract_end)
                const st = status(d)
                return (
                  <tr key={r.id} className="cursor-pointer hover:opacity-80" style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => router.push(`/sites/${r.id}`)}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-base)' }}>
                      {r.name}
                      {r.city && <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{r.city}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.clients?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: r.contract_type === 'dlp' ? 'rgba(249,115,22,0.12)' : 'rgba(96,165,250,0.12)', color: r.contract_type === 'dlp' ? '#f97316' : '#60a5fa' }}>
                        {TYPE_LABEL[r.contract_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{fmt(r.contract_start)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-base)' }}>{fmt(r.contract_end)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
