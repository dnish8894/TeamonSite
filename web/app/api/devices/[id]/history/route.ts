import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// 12c — Service history for a single device:
//   • Part requests/replacements (via tickets that reference this device)
//   • Tickets raised against this device
//   • PM reports that covered this device
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: parts }, { data: tickets }, { data: pmReports }] = await Promise.all([
    // Part requests whose linked ticket is for this device
    supabaseAdmin
      .from('part_requests')
      .select('id, created_at, request_type, status, equipment_description, items, tickets!inner ( ticket_no, title, device_id )')
      .eq('tickets.device_id', id)
      .order('created_at', { ascending: false }),
    // Tickets against this device
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, title, type, status, created_at, resolved_at')
      .eq('device_id', id)
      .order('created_at', { ascending: false }),
    // PM reports that include this device in their snapshot
    supabaseAdmin
      .from('pm_reports')
      .select('id, visit_date, status, devices, pm_schedules ( name )')
      .contains('devices', JSON.stringify([{ device_id: id }]))
      .order('visit_date', { ascending: false }),
  ])

  return NextResponse.json({
    parts:   parts   ?? [],
    tickets: tickets ?? [],
    pmReports: (pmReports ?? []).map((r: Record<string, unknown>) => ({
      id: r.id, visit_date: r.visit_date, status: r.status,
      schedule: (r.pm_schedules as { name: string } | null)?.name ?? null,
    })),
  })
}
