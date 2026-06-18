import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const now   = new Date()
  const day30 = new Date(now); day30.setDate(now.getDate() - 29)
  const day30iso = day30.toISOString().split('T')[0]

  const [
    openTickets,
    allTickets30,
    closedTickets30,
    allTicketStatus,
    allTicketType,
    engWorkload,
    pmOverdue,
    lowStock,
    sites,
    engineers,
    recentTickets,
  ] = await Promise.all([
    // Open tickets + SLA
    supabaseAdmin.from('v_open_tickets').select('id, is_sla_breached'),

    // All tickets in last 30 days (for trend)
    supabaseAdmin.from('tickets')
      .select('created_at, status')
      .gte('created_at', `${day30iso}T00:00:00Z`),

    // Closed tickets in last 30 days (for resolved trend)
    supabaseAdmin.from('tickets')
      .select('closed_at')
      .not('closed_at', 'is', null)
      .gte('closed_at', `${day30iso}T00:00:00Z`),

    // All tickets grouped by status (for pie)
    supabaseAdmin.from('tickets').select('status'),

    // All tickets grouped by type (for bar)
    supabaseAdmin.from('tickets').select('type'),

    // Engineer workload — open tickets per engineer
    supabaseAdmin.from('tickets')
      .select('engineers(users(full_name))')
      .in('status', ['open', 'in_progress', 'pending_parts', 'pending_client'])
      .not('engineer_id', 'is', null),

    // Overdue PM schedules
    supabaseAdmin.from('pm_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .lt('next_due_at', now.toISOString()),

    // Low stock parts
    supabaseAdmin.from('parts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .lte('stock_qty', supabaseAdmin.from('parts').select('min_stock_qty') as unknown as number),

    // Active sites
    supabaseAdmin.from('sites').select('id', { count: 'exact', head: true }).eq('is_active', true),

    // Available engineers
    supabaseAdmin.from('engineers').select('id', { count: 'exact', head: true }).eq('is_available', true),

    // Recent 6 tickets
    supabaseAdmin.from('tickets')
      .select('id, ticket_no, title, status, priority, created_at, sites(name), engineers(users(full_name))')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  // ── Ticket trend: last 30 days ──────────────────────────
  const trendMap: Record<string, { date: string; opened: number; closed: number }> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(day30); d.setDate(day30.getDate() + i)
    const key = d.toISOString().split('T')[0]
    trendMap[key] = { date: key, opened: 0, closed: 0 }
  }
  for (const t of (allTickets30.data ?? [])) {
    const key = t.created_at.split('T')[0]
    if (trendMap[key]) trendMap[key].opened++
  }
  for (const t of (closedTickets30.data ?? [])) {
    const key = t.closed_at!.split('T')[0]
    if (trendMap[key]) trendMap[key].closed++
  }
  const ticketTrend = Object.values(trendMap).map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }),
  }))

  // ── Status breakdown ────────────────────────────────────
  const statusCount: Record<string, number> = {}
  for (const t of (allTicketStatus.data ?? [])) {
    statusCount[t.status] = (statusCount[t.status] ?? 0) + 1
  }
  const statusBreakdown = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

  // ── Type breakdown ──────────────────────────────────────
  const typeCount: Record<string, number> = {}
  for (const t of (allTicketType.data ?? [])) {
    typeCount[t.type] = (typeCount[t.type] ?? 0) + 1
  }
  const typeBreakdown = Object.entries(typeCount).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
  }))

  // ── Engineer workload ───────────────────────────────────
  const engMap: Record<string, number> = {}
  for (const t of (engWorkload.data ?? [])) {
    const eng = (t.engineers as unknown as { users: { full_name: string } | null } | null)
    const name = eng?.users?.full_name ?? 'Unassigned'
    engMap[name] = (engMap[name] ?? 0) + 1
  }
  const engineerWorkload = Object.entries(engMap)
    .map(([name, tickets]) => ({ name, tickets }))
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, 8)

  // ── Low stock (manual count since lte on column needs raw) ─
  const { data: partsData } = await supabaseAdmin
    .from('parts')
    .select('stock_qty, min_stock_qty')
    .eq('is_active', true)
  const lowStockCount = (partsData ?? []).filter(p => Number(p.stock_qty) <= Number(p.min_stock_qty)).length

  const breached = (openTickets.data ?? []).filter((t: { is_sla_breached: boolean }) => t.is_sla_breached).length

  return NextResponse.json({
    // Stat cards
    openTickets:   openTickets.data?.length ?? 0,
    slaBreached:   breached,
    activeSites:   sites.count ?? 0,
    engineers:     engineers.count ?? 0,
    overduepm:     pmOverdue.count ?? 0,
    lowStock:      lowStockCount,
    // Charts
    ticketTrend,
    statusBreakdown,
    typeBreakdown,
    engineerWorkload,
    // Table
    recentTickets: recentTickets.data ?? [],
  })
}
