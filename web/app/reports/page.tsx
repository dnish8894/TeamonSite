'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  FileDown, Sheet, RefreshCw, Calendar, BarChart3,
  AlertTriangle, CheckCircle2, Clock, Building2, Layers,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ── Types ────────────────────────────────────────────────────────────────────
interface TicketRow {
  id: string
  ticket_no: string
  title: string
  type: string
  priority: string
  status: string
  created_at: string
  resolved_at: string | null
  closed_at: string | null
  sites: { id: string; name: string; city: string | null; state: string | null } | null
  elv_systems: { id: string; name: string; type: string } | null
}

// ── Label maps ────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  breakdown:              'Breakdown',
  preventive_maintenance: 'Preventive Maintenance',
  installation:           'Installation',
  inspection:             'Inspection',
  relocation:             'Relocation',
}
const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  P1: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  P2: { color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  P3: { color: '#facc15', bg: 'rgba(250,204,21,0.12)'  },
  P4: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
}
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  open:           { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Open'           },
  assigned:       { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'Assigned'       },
  in_progress:    { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  label: 'In Progress'    },
  pending_parts:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Pending Parts'  },
  pending_client: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Pending Client' },
  resolved:       { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Resolved'       },
  closed:         { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Closed'         },
  cancelled:      { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Cancelled'      },
}
const SYS_LABEL: Record<string,string> = {
  cctv:'CCTV', access_control:'Access Control',
  structured_cabling:'Structured Cabling', av:'Audio Visual', pa:'Public Address', bms:'BMS',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().slice(0,10) }
function isoWeekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0,10)
}
function isoMonthStart() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' })
}
function resolutionHours(row: TicketRow): number | null {
  const end = row.resolved_at ?? row.closed_at
  if (!end) return null
  return Math.round((new Date(end).getTime() - new Date(row.created_at).getTime()) / 3_600_000)
}

// ── Bar mini-chart ─────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '20', color }}>
        {icon}
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{label}</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IssueReportPage() {
  const [preset,  setPreset]  = useState<'week'|'month'|'custom'>('month')
  const [from,    setFrom]    = useState(isoMonthStart())
  const [to,      setTo]      = useState(isoToday())
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function applyPreset(p: 'week'|'month'|'custom') {
    setPreset(p)
    if (p === 'week')  { setFrom(isoWeekAgo());    setTo(isoToday()) }
    if (p === 'month') { setFrom(isoMonthStart());  setTo(isoToday()) }
  }

  async function load() {
    setLoading(true); setError('')
    const res  = await fetch(`/api/reports/issues?from=${from}&to=${to}`)
    const json = await res.json()
    if (!res.ok) { setError(json.error); setTickets([]) }
    else setTickets(Array.isArray(json) ? json : [])
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  // ── Aggregations ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = tickets.length
    const open       = tickets.filter(t => ['open','assigned','in_progress','pending_parts','pending_client'].includes(t.status)).length
    const resolved   = tickets.filter(t => ['resolved','closed'].includes(t.status)).length
    const breakdown  = tickets.filter(t => t.type === 'breakdown').length
    const p1p2       = tickets.filter(t => t.priority === 'P1' || t.priority === 'P2').length

    // Avg resolution time (hours) for resolved/closed
    const times = tickets.map(resolutionHours).filter(h => h !== null) as number[]
    const avgRes = times.length ? Math.round(times.reduce((a,b) => a+b, 0) / times.length) : null

    // By site
    const bySite: Record<string, { name: string; city: string|null; count: number; open: number; breakdown: number }> = {}
    tickets.forEach(t => {
      if (!t.sites) return
      const sid = t.sites.id
      if (!bySite[sid]) bySite[sid] = { name: t.sites.name, city: t.sites.city, count: 0, open: 0, breakdown: 0 }
      bySite[sid].count++
      if (['open','assigned','in_progress','pending_parts','pending_client'].includes(t.status)) bySite[sid].open++
      if (t.type === 'breakdown') bySite[sid].breakdown++
    })
    const siteList = Object.values(bySite).sort((a,b) => b.count - a.count)

    // By type
    const byType: Record<string, number> = {}
    tickets.forEach(t => { byType[t.type] = (byType[t.type] ?? 0) + 1 })
    const typeList = Object.entries(byType).sort((a,b) => b[1]-a[1])

    // By system
    const bySys: Record<string, { label: string; count: number }> = {}
    tickets.forEach(t => {
      const key = t.elv_systems?.type ?? 'unknown'
      const lbl = t.elv_systems ? (SYS_LABEL[key] ?? key) : 'No System'
      if (!bySys[key]) bySys[key] = { label: lbl, count: 0 }
      bySys[key].count++
    })
    const sysList = Object.values(bySys).sort((a,b) => b.count - a.count)

    // By priority
    const byPriority: Record<string, number> = {}
    tickets.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1 })

    // By status
    const byStatus: Record<string, number> = {}
    tickets.forEach(t => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1 })

    // Recurring issues: same site + same type, count > 1
    const recurrMap: Record<string, { site: string; type: string; count: number }> = {}
    tickets.forEach(t => {
      if (!t.sites || t.type !== 'breakdown') return
      const k = `${t.sites.id}::${t.type}`
      if (!recurrMap[k]) recurrMap[k] = { site: t.sites.name, type: t.type, count: 0 }
      recurrMap[k].count++
    })
    const recurring = Object.values(recurrMap).filter(r => r.count > 1).sort((a,b) => b.count - a.count)

    return { total, open, resolved, breakdown, p1p2, avgRes, siteList, typeList, sysList, byPriority, byStatus, recurring }
  }, [tickets])

  const periodLabel = `${formatDate(from)} – ${formatDate(to)}`
  const maxSite = stats.siteList[0]?.count ?? 1

  // ── Export PDF ──────────────────────────────────────────────────────────
  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    const title = 'Common Issues Report'

    doc.setFillColor(249,115,22)
    doc.rect(0,0,doc.internal.pageSize.width,22,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255)
    doc.text(title, 14, 13)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(255,220,180)
    doc.text(`Period: ${periodLabel}  |  Generated: ${new Date().toLocaleDateString('en-MY')}`, 14, 19)
    doc.setTextColor(28,25,23)

    // Summary row
    let y = 30
    const summaryData = [
      ['Total Tickets', stats.total, 'Open', stats.open, 'Resolved/Closed', stats.resolved],
      ['Breakdowns', stats.breakdown, 'P1/P2 (High)', stats.p1p2, 'Avg Resolution', stats.avgRes ? `${stats.avgRes}h` : '—'],
    ]
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Count', 'Metric', 'Count', 'Metric', 'Value']],
      body: summaryData.map(r => r.map(String)),
      headStyles: { fillColor: [249,115,22], textColor: [255,255,255] },
      styles: { fontSize: 8 },
      columnStyles: { 0:{fontStyle:'bold',cellWidth:40}, 2:{fontStyle:'bold',cellWidth:40}, 4:{fontStyle:'bold',cellWidth:40} },
    })
    y = (doc as jsPDF & { lastAutoTable:{finalY:number} }).lastAutoTable.finalY + 8

    // By site
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(249,115,22)
    doc.text('TICKETS BY SITE', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Site', 'City', 'Total', 'Open', 'Breakdowns']],
      body: stats.siteList.map(s => [s.name, s.city ?? '—', s.count, s.open, s.breakdown]),
      headStyles: { fillColor: [249,115,22], textColor: [255,255,255] },
      styles: { fontSize: 8 },
    })
    y = (doc as jsPDF & { lastAutoTable:{finalY:number} }).lastAutoTable.finalY + 8

    // By type
    if (y > 160) { doc.addPage(); y = 20 }
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(249,115,22)
    doc.text('TICKETS BY TYPE', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Issue Type', 'Count', '%']],
      body: stats.typeList.map(([type, count]) => [
        TYPE_LABEL[type] ?? type, count,
        stats.total ? `${Math.round((count/stats.total)*100)}%` : '0%',
      ]),
      headStyles: { fillColor: [249,115,22], textColor: [255,255,255] },
      styles: { fontSize: 8 },
      columnStyles: { 0:{cellWidth:80} },
    })
    y = (doc as jsPDF & { lastAutoTable:{finalY:number} }).lastAutoTable.finalY + 8

    // Recurring issues
    if (stats.recurring.length > 0) {
      if (y > 160) { doc.addPage(); y = 20 }
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(239,68,68)
      doc.text('RECURRING BREAKDOWN SITES', 14, y); y += 6
      autoTable(doc, {
        startY: y,
        head: [['Site', 'Breakdown Count']],
        body: stats.recurring.map(r => [r.site, r.count]),
        headStyles: { fillColor: [239,68,68], textColor: [255,255,255] },
        styles: { fontSize: 8 },
      })
      y = (doc as jsPDF & { lastAutoTable:{finalY:number} }).lastAutoTable.finalY + 8
    }

    // All tickets detail
    doc.addPage()
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(249,115,22)
    doc.text('ALL TICKETS IN PERIOD', 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [['Ticket No', 'Site', 'Title', 'Type', 'Priority', 'Status', 'Date']],
      body: tickets.map(t => [
        t.ticket_no,
        t.sites?.name ?? '—',
        t.title.length > 40 ? t.title.slice(0,40)+'…' : t.title,
        TYPE_LABEL[t.type] ?? t.type,
        t.priority,
        STATUS_STYLE[t.status]?.label ?? t.status,
        formatDate(t.created_at),
      ]),
      headStyles: { fillColor: [249,115,22], textColor: [255,255,255] },
      styles: { fontSize: 7 },
      columnStyles: {
        0:{cellWidth:25}, 1:{cellWidth:40}, 2:{cellWidth:70},
        3:{cellWidth:35}, 4:{cellWidth:16}, 5:{cellWidth:28}, 6:{cellWidth:22},
      },
    })

    doc.save(`IssueReport_${from}_to_${to}.pdf`)
  }

  // ── Export Excel ───────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    // Summary
    const summaryData = [
      ['Period', periodLabel],
      ['Generated', new Date().toLocaleDateString('en-MY')],
      [''],
      ['Metric', 'Value'],
      ['Total Tickets', stats.total],
      ['Open Tickets', stats.open],
      ['Resolved / Closed', stats.resolved],
      ['Breakdowns', stats.breakdown],
      ['P1/P2 (High Priority)', stats.p1p2],
      ['Avg Resolution Time', stats.avgRes ? `${stats.avgRes} hrs` : '—'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    ws1['!cols'] = [{ wch: 28 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    // By site
    const siteData = [
      ['Site', 'City / State', 'Total Tickets', 'Open', 'Breakdowns'],
      ...stats.siteList.map(s => [s.name, s.city ?? '', s.count, s.open, s.breakdown]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(siteData)
    ws2['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'By Site')

    // By type
    const typeData = [
      ['Issue Type', 'Count', 'Percentage'],
      ...stats.typeList.map(([type, count]) => [
        TYPE_LABEL[type] ?? type, count,
        stats.total ? `${Math.round((count/stats.total)*100)}%` : '0%',
      ]),
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(typeData)
    ws3['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'By Type')

    // All tickets
    const ticketData = [
      ['Ticket No', 'Site', 'City', 'System', 'Title', 'Type', 'Priority', 'Status', 'Created', 'Resolved'],
      ...tickets.map(t => [
        t.ticket_no,
        t.sites?.name ?? '—',
        t.sites?.city ?? '',
        t.elv_systems ? (SYS_LABEL[t.elv_systems.type] ?? t.elv_systems.type) : '—',
        t.title,
        TYPE_LABEL[t.type] ?? t.type,
        t.priority,
        STATUS_STYLE[t.status]?.label ?? t.status,
        formatDate(t.created_at),
        t.resolved_at ? formatDate(t.resolved_at) : '',
      ]),
    ]
    const ws4 = XLSX.utils.aoa_to_sheet(ticketData)
    ws4['!cols'] = [10,35,15,22,55,28,12,18,14,14].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws4, 'All Tickets')

    XLSX.writeFile(wb, `IssueReport_${from}_to_${to}.xlsx`)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Issue Reports</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Common issue analysis from ticket data — by site, type and system
          </p>
        </div>
        {tickets.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
              style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
              <Sheet size={13} /> Excel
            </button>
            <button onClick={exportPdf}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
              style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
              <FileDown size={13} /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {/* Preset buttons */}
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>Period</p>
          <div className="flex gap-1.5">
            {(['week','month','custom'] as const).map(p => (
              <button key={p} onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all"
                style={preset === p
                  ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                  : { color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'transparent' }}>
                {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {/* Date pickers */}
        <div className="flex items-end gap-3">
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>From</p>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom') }}
              className="rounded-lg border px-3 py-1.5 text-sm outline-none"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-base)' }} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>To</p>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom') }}
              className="rounded-lg border px-3 py-1.5 text-sm outline-none"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-base)' }} />
          </div>
        </div>

        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
          style={{ background: '#f97316', color: '#fff', opacity: loading ? 0.7 : 1 }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Generate Report'}
        </button>

        {tickets.length > 0 && (
          <p className="text-xs ml-auto self-end" style={{ color: 'var(--text-subtle)' }}>
            <Calendar size={12} className="inline mr-1" />
            {periodLabel} · {tickets.length} tickets
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border p-4 mb-6 text-sm"
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
          {error}
        </div>
      )}

      {tickets.length === 0 && !loading && !error && (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <BarChart3 size={36} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No tickets found for the selected period.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>Try a different date range.</p>
        </div>
      )}

      {tickets.length > 0 && (
        <>
          {/* ── KPI cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Total Tickets"   value={stats.total}     color="#f97316" icon={<BarChart3 size={18} />} />
            <StatCard label="Open / Active"   value={stats.open}      color="#ef4444" icon={<AlertTriangle size={18} />}
              sub={stats.total ? `${Math.round((stats.open/stats.total)*100)}%` : ''} />
            <StatCard label="Resolved / Closed" value={stats.resolved} color="#34d399" icon={<CheckCircle2 size={18} />} />
            <StatCard label="Breakdowns"      value={stats.breakdown} color="#f97316" icon={<AlertTriangle size={18} />} />
            <StatCard label="P1 / P2 Critical" value={stats.p1p2}    color="#ef4444" icon={<AlertTriangle size={18} />} />
            <StatCard label="Avg Resolution"  value={stats.avgRes ? `${stats.avgRes}h` : '—'}
              color="#60a5fa" icon={<Clock size={18} />}
              sub={stats.avgRes ? (stats.avgRes < 24 ? 'within 1 day' : `${Math.round(stats.avgRes/24)} days`) : 'no data'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* ── By Site ──────────────────────────────────────────────── */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} style={{ color: '#f97316' }} />
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Tickets by Site</h2>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>
                  Top {Math.min(stats.siteList.length, 10)}
                </span>
              </div>
              <div className="space-y-2.5">
                {stats.siteList.slice(0, 10).map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-36 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-base)' }}>{s.name}</p>
                      {s.city && <p className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{s.city}</p>}
                    </div>
                    <MiniBar value={s.count} max={maxSite} color="#f97316" />
                    {s.open > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)' }}>
                        {s.open} open
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── By Type + System ─────────────────────────────────────── */}
            <div className="space-y-6">
              {/* By type */}
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={16} style={{ color: '#60a5fa' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Tickets by Type</h2>
                </div>
                <div className="space-y-2">
                  {stats.typeList.map(([type, count]) => {
                    const maxType = stats.typeList[0]?.[1] ?? 1
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <p className="text-xs w-40 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {TYPE_LABEL[type] ?? type}
                        </p>
                        <MiniBar value={count} max={maxType} color="#60a5fa" />
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>
                          {stats.total ? Math.round((count/stats.total)*100) : 0}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By system */}
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={16} style={{ color: '#a78bfa' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Tickets by ELV System</h2>
                </div>
                <div className="space-y-2">
                  {stats.sysList.map(s => {
                    const maxSys = stats.sysList[0]?.count ?? 1
                    return (
                      <div key={s.label} className="flex items-center gap-3">
                        <p className="text-xs w-40 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                        <MiniBar value={s.count} max={maxSys} color="#a78bfa" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Priority + Status distribution ───────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Priority */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-base)' }}>Priority Breakdown</h2>
              <div className="grid grid-cols-4 gap-3">
                {['P1','P2','P3','P4'].map(p => {
                  const count = stats.byPriority[p] ?? 0
                  const ps = PRIORITY_STYLE[p]
                  return (
                    <div key={p} className="rounded-lg p-3 text-center"
                      style={{ background: ps.bg }}>
                      <p className="text-lg font-bold" style={{ color: ps.color }}>{count}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: ps.color }}>{p}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                        {p === 'P1' ? 'Critical' : p === 'P2' ? 'High' : p === 'P3' ? 'Medium' : 'Low'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-base)' }}>Status Distribution</h2>
              <div className="space-y-2">
                {Object.entries(stats.byStatus)
                  .sort((a,b) => b[1]-a[1])
                  .map(([status, count]) => {
                    const ss = STATUS_STYLE[status] ?? { color: 'var(--text-muted)', bg: 'var(--border)', label: status }
                    const maxSt = Math.max(...Object.values(stats.byStatus))
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium w-32 flex-shrink-0 text-center"
                          style={{ color: ss.color, background: ss.bg }}>
                          {ss.label}
                        </span>
                        <MiniBar value={count} max={maxSt} color={ss.color} />
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* ── Recurring breakdowns ────────────────────────────────────── */}
          {stats.recurring.length > 0 && (
            <div className="rounded-xl border p-5 mb-6"
              style={{ background: 'var(--bg-card)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#ef4444' }}>
                  Recurring Breakdown Sites
                </h2>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  — same site with multiple breakdown tickets in this period
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.recurring.map(r => (
                  <div key={r.site} className="rounded-lg p-3 border"
                    style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{r.site}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#ef4444' }}>{r.count}</p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>breakdown{r.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ticket list ─────────────────────────────────────────────── */}
          <div className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>
                All Tickets ({tickets.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                    {['Ticket No','Site','Title','Type','Priority','Status','Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold"
                        style={{ color: 'var(--text-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => {
                    const ps = PRIORITY_STYLE[t.priority] ?? { color: 'var(--text-muted)', bg: 'transparent' }
                    const ss = STATUS_STYLE[t.status]     ?? { color: 'var(--text-muted)', bg: 'transparent', label: t.status }
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono font-semibold" style={{ color: '#f97316' }}>
                            {t.ticket_no}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium" style={{ color: 'var(--text-base)' }}>
                            {t.sites?.name ?? '—'}
                          </p>
                          {t.sites?.city && (
                            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.sites.city}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs">
                          <p className="text-xs truncate" style={{ color: 'var(--text-base)' }}>{t.title}</p>
                          {t.elv_systems && (
                            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                              {SYS_LABEL[t.elv_systems.type] ?? t.elv_systems.type}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {TYPE_LABEL[t.type] ?? t.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ color: ps.color, background: ps.bg }}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ color: ss.color, background: ss.bg }}>
                            {ss.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {formatDate(t.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
