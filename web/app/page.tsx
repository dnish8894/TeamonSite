'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Ticket, Building2, Users, AlertTriangle,
  CalendarClock, Package, ArrowRight, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

/* ── Types ──────────────────────────────────────────── */
interface Stats {
  openTickets: number; slaBreached: number; activeSites: number
  engineers: number; overduepm: number; lowStock: number
  ticketTrend:      { date: string; opened: number; closed: number }[]
  statusBreakdown:  { name: string; value: number }[]
  typeBreakdown:    { name: string; value: number }[]
  engineerWorkload: { name: string; tickets: number }[]
  recentTickets:    RecentTicket[]
}
interface RecentTicket {
  id: string; ticket_no: string; title: string
  status: string; priority: string; created_at: string
  sites: { name: string } | null
  engineers: { users: { full_name: string } | null } | null
}

/* ── Colour helpers ─────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  open:           '#3b82f6',
  in_progress:    '#f59e0b',
  pending_parts:  '#8b5cf6',
  pending_client: '#06b6d4',
  resolved:       '#10b981',
  closed:         '#6b7280',
}
const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,.12)'  },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,.12)' },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,.12)'  },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
}
const PIE_COLORS = ['#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#6b7280','#f43f5e','#14b8a6']

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Custom tooltip ─────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg shadow-lg border px-3 py-2 text-sm"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-base)' }}>
      {label && <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>}
      {payload.map(p => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

/* ── Main component ─────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => { setStats(d); setLoading(false) })
  }, [])

  const cards = stats ? [
    { label: 'Open Tickets',     value: stats.openTickets, icon: Ticket,        color: 'var(--color-info)',    bg: 'var(--color-info-bg)',    href: '/tickets'  },
    { label: 'SLA Breached',     value: stats.slaBreached, icon: AlertTriangle, color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  href: '/tickets'  },
    { label: 'Active Sites',     value: stats.activeSites, icon: Building2,     color: 'var(--color-success)', bg: 'var(--color-success-bg)', href: '/sites'    },
    { label: 'Engineers Avail.', value: stats.engineers,   icon: Users,         color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', href: '/engineers'},
    { label: 'Overdue PMs',      value: stats.overduepm,   icon: CalendarClock, color: '#f97316',              bg: 'rgba(249,115,22,.12)',     href: '/pm'       },
    { label: 'Low Stock Parts',  value: stats.lowStock,    icon: Package,       color: '#8b5cf6',              bg: 'rgba(139,92,246,.12)',     href: '/parts'    },
  ] : []

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Live overview of your field operations</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading dashboard...</div>
        </div>
      ) : stats && (
        <>
          {/* ── Stat Cards ───────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {cards.map(({ label, value, icon: Icon, color, bg, href }) => (
              <Link key={label} href={href}
                className="rounded-xl p-4 border flex flex-col gap-3 hover:shadow-md transition-shadow"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="p-2 rounded-lg w-fit" style={{ background: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Row 2: Ticket Trend + Status Pie ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Ticket trend — area chart */}
            <div className="lg:col-span-2 rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={16} style={{ color: 'var(--color-info)' }} />
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Ticket Trend — Last 30 Days</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.ticketTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
                    tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span>} />
                  <Area type="monotone" dataKey="opened" name="Opened" stroke="#3b82f6" strokeWidth={2} fill="url(#gOpened)" dot={false} />
                  <Area type="monotone" dataKey="closed" name="Closed" stroke="#10b981" strokeWidth={2} fill="url(#gClosed)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status Pie */}
            <div className="rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--text-base)' }}>Tickets by Status</h2>
              {stats.statusBreakdown.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={stats.statusBreakdown} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={72}
                        paddingAngle={3} dataKey="value">
                        {stats.statusBreakdown.map((entry, i) => (
                          <Cell key={entry.name}
                            fill={STATUS_COLOR[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {stats.statusBreakdown.map((e, i) => (
                      <div key={e.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block"
                            style={{ background: STATUS_COLOR[e.name] ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span style={{ color: 'var(--text-muted)' }}>{statusLabel(e.name)}</span>
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{e.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Row 3: Type Bar + Engineer Workload ──────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Ticket type bar chart */}
            <div className="rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--text-base)' }}>Tickets by Type</h2>
              {stats.typeBreakdown.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.typeBreakdown} layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
                      tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]}>
                      {stats.typeBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Engineer workload */}
            <div className="rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm mb-5" style={{ color: 'var(--text-base)' }}>Engineer Workload (Open Tickets)</h2>
              {stats.engineerWorkload.length === 0 ? (
                <EmptyChart msg="No open tickets assigned" />
              ) : (
                <div className="space-y-3 mt-1">
                  {stats.engineerWorkload.map((e, i) => {
                    const max = stats.engineerWorkload[0].tickets
                    const pct = max ? Math.round((e.tickets / max) * 100) : 0
                    const color = pct >= 80 ? 'var(--color-danger)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-success)'
                    return (
                      <div key={e.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: 'var(--text-muted)' }}>{e.name}</span>
                          <span className="font-semibold" style={{ color: 'var(--text-base)' }}>
                            {e.tickets} ticket{e.tickets !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 4: Recent Tickets ─────────────────────── */}
          <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>Recent Tickets</h2>
              <Link href="/tickets"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--color-info)' }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Ticket No.', 'Title', 'Site', 'Assigned', 'Priority', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTickets.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm"
                      style={{ color: 'var(--text-subtle)' }}>No tickets yet.</td></tr>
                  ) : stats.recentTickets.map(t => {
                    const pc = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.low
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}
                        className="hover:opacity-80 transition-opacity">
                        <td className="px-4 py-3">
                          <Link href={`/tickets/${t.id}`}
                            className="font-mono text-xs font-semibold"
                            style={{ color: 'var(--color-info)' }}>
                            {t.ticket_no}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate"
                          style={{ color: 'var(--text-base)' }}>{t.title}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {(t.sites as { name: string } | null)?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {(t.engineers as { users: { full_name: string } | null } | null)?.users?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                            style={{ background: pc.bg, color: pc.color }}>{t.priority}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}>
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {new Date(t.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
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

function EmptyChart({ msg = 'No data yet' }: { msg?: string }) {
  return (
    <div className="flex items-center justify-center h-40 rounded-lg"
      style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)' }}>
      <p className="text-sm">{msg}</p>
    </div>
  )
}
