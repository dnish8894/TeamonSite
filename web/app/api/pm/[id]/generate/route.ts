import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Load the schedule with site info
  const { data: sched, error: schedErr } = await supabaseAdmin
    .from('pm_schedules')
    .select(`
      id, name, ticket_type, interval_days, assigned_to, site_id, system_id, contract_id,
      sites ( clients ( organisation_id ) )
    `)
    .eq('id', id)
    .single()

  if (schedErr || !sched) return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 })

  const orgId = (sched.sites as { clients: { organisation_id: string } | null } | null)
    ?.clients?.organisation_id

  if (!orgId) return NextResponse.json({ error: 'Organisation not found.' }, { status: 400 })

  // Create ticket
  const { data: ticket, error: ticketErr } = await supabaseAdmin
    .from('tickets')
    .insert({
      organisation_id: orgId,
      site_id:     sched.site_id,
      system_id:   sched.system_id   || null,
      contract_id: sched.contract_id || null,
      assigned_to: sched.assigned_to || null,
      type:        sched.ticket_type,
      priority:    'P3',
      status:      sched.assigned_to ? 'assigned' : 'open',
      title:       sched.name,
      ticket_no:   '',
    })
    .select('id, ticket_no')
    .single()

  if (ticketErr) return NextResponse.json({ error: ticketErr.message }, { status: 500 })

  // Update schedule: set last_run_at = now, next_due_at = now + interval
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + sched.interval_days)

  await supabaseAdmin.from('pm_schedules').update({
    last_run_at: new Date().toISOString(),
    next_due_at: nextDue.toISOString(),
  }).eq('id', id)

  return NextResponse.json({ ticketId: ticket.id, ticketNo: ticket.ticket_no })
}
