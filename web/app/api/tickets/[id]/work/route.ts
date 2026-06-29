import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { emailClientCompleted } from '@/lib/clientEmail'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action } = await req.json()

  const { data: ticket, error: fetchErr } = await supabaseAdmin
    .from('tickets')
    .select('work_status, work_seconds, work_last_resume_at, work_started_at, device_id, ticket_no, reporter_email, sites(name)')
    .eq('id', id)
    .single()

  if (fetchErr || !ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 })

  const now = new Date()
  const updates: Record<string, unknown> = {}

  if (action === 'start') {
    if (ticket.work_status !== 'not_started') return NextResponse.json({ error: 'Work already started.' }, { status: 400 })
    updates.work_status = 'in_progress'
    updates.work_started_at = now.toISOString()
    updates.work_last_resume_at = now.toISOString()
  } else if (action === 'pause') {
    if (ticket.work_status !== 'in_progress') return NextResponse.json({ error: 'Work is not in progress.' }, { status: 400 })
    const elapsed = ticket.work_last_resume_at
      ? Math.floor((now.getTime() - new Date(ticket.work_last_resume_at).getTime()) / 1000)
      : 0
    updates.work_status = 'paused'
    updates.work_seconds = (ticket.work_seconds ?? 0) + elapsed
    updates.work_last_resume_at = null
  } else if (action === 'resume') {
    if (ticket.work_status !== 'paused') return NextResponse.json({ error: 'Work is not paused.' }, { status: 400 })
    updates.work_status = 'in_progress'
    updates.work_last_resume_at = now.toISOString()
  } else if (action === 'complete') {
    if (!['in_progress', 'paused'].includes(ticket.work_status)) return NextResponse.json({ error: 'Work must be started first.' }, { status: 400 })
    let elapsed = 0
    if (ticket.work_status === 'in_progress' && ticket.work_last_resume_at) {
      elapsed = Math.floor((now.getTime() - new Date(ticket.work_last_resume_at).getTime()) / 1000)
    }
    updates.work_status = 'completed'
    updates.work_seconds = (ticket.work_seconds ?? 0) + elapsed
    updates.work_last_resume_at = null
    updates.work_completed_at = now.toISOString()
    updates.status = 'resolved'
    updates.resolved_at = now.toISOString()
  } else {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('tickets').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On completion, stamp the serviced device's "Last Service Date" + notify the client.
  if (action === 'complete') {
    if (ticket.device_id) {
      await supabaseAdmin.from('devices')
        .update({ last_service_date: now.toISOString().slice(0, 10) })
        .eq('id', ticket.device_id)
    }
    if (ticket.reporter_email) {
      const siteName = (ticket.sites as unknown as { name: string } | null)?.name ?? ''
      await emailClientCompleted(ticket.reporter_email, ticket.ticket_no, siteName).catch(() => {})
    }
  }

  await supabaseAdmin.from('ticket_activities').insert({
    ticket_id: id,
    action: 'work_' + action,
  })

  return NextResponse.json({ ok: true })
}
