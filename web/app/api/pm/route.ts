import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('pm_schedules')
    .select(`
      id, name, ticket_type, interval_days, last_run_at, next_due_at, is_active,
      sites ( id, name, clients ( name ) ),
      elv_systems ( id, name, type ),
      engineers ( id, users ( full_name ) )
    `)
    .order('next_due_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.site_id)   return NextResponse.json({ error: 'Site is required.' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Schedule name is required.' }, { status: 400 })

  // Calculate first next_due_at from start_date or today
  const startDate = body.start_date ? new Date(body.start_date) : new Date()
  const nextDue   = new Date(startDate)
  nextDue.setDate(nextDue.getDate() + (body.interval_days ?? 90))

  const { error } = await supabaseAdmin.from('pm_schedules').insert({
    site_id:      body.site_id,
    system_id:    body.system_id    || null,
    contract_id:  body.contract_id  || null,
    assigned_to:  body.assigned_to  || null,
    name:         body.name.trim(),
    ticket_type:  body.ticket_type  || 'preventive_maintenance',
    interval_days: body.interval_days || 90,
    next_due_at:  nextDue.toISOString(),
    is_active:    true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
