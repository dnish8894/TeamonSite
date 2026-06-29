import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pushToUser, engineerUserId, pushToGroups } from '@/lib/push'
import { emailClientAssigned, emailClientCompleted } from '@/lib/clientEmail'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select(`
      id, ticket_no, title, description, type, priority, status,
      is_chargeable, quotation_no, source_qr_tier, source_qr_id,
      reporter_name, reporter_phone, reporter_email,
      sla_response_due, sla_resolve_due, sla_response_met, sla_resolve_met,
      assigned_at, acknowledged_at, started_at, resolved_at, closed_at, eta_at,
      work_status, work_seconds, work_last_resume_at, work_started_at, work_completed_at,
      created_at, updated_at,
      sites ( id, name, address, city, state, site_contact, site_phone, pm_classification, contract_type, clients ( name, type ) ),
      elv_systems ( id, name, type ),
      devices ( id, name, tag_id, device_type, model, location_desc, floor, under_contract ),
      engineers (
        id,
        users ( full_name, phone, email )
      ),
      ticket_groups ( group_id, engineer_groups ( id, name ) ),
      created_by_user:created_by ( full_name )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const groupIds: string[] | undefined = body.group_ids
  delete body.group_ids

  // Fetch current ticket state for comparison
  const { data: current } = await supabaseAdmin
    .from('tickets')
    .select('status, assigned_to, ticket_no, title, reporter_email, reporter_name, eta_at, device_id, sites(name)')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = { ...body }
  if (body.status === 'assigned' && body.assigned_to)  updates.assigned_at  = new Date().toISOString()
  if (body.status === 'in_progress')                   updates.started_at   = new Date().toISOString()
  if (body.status === 'resolved')                      updates.resolved_at  = new Date().toISOString()
  if (body.status === 'closed')                        updates.closed_at    = new Date().toISOString()

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from('tickets').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ticketNo    = current?.ticket_no ?? id
  const ticketTitle = current?.title ?? 'Ticket'
  const siteName    = (current?.sites as unknown as { name: string } | null)?.name ?? ''

  // Stamp device's Last Service Date when the ticket is resolved/closed.
  if ((body.status === 'resolved' || body.status === 'closed') && current?.status !== body.status) {
    if (current?.device_id) {
      await supabaseAdmin.from('devices')
        .update({ last_service_date: new Date().toISOString().slice(0, 10) })
        .eq('id', current.device_id)
    }
    // Notify the client the job is done / technician left site
    if (current?.reporter_email) {
      await emailClientCompleted(current.reporter_email, ticketNo, siteName).catch(() => {})
    }
  }

  // ── Group assignment ───────────────────────────────────────────────────────
  if (Array.isArray(groupIds)) {
    await supabaseAdmin.from('ticket_groups').delete().eq('ticket_id', id)
    if (groupIds.length > 0) {
      await supabaseAdmin.from('ticket_groups').insert(groupIds.map(gid => ({ ticket_id: id, group_id: gid })))
      await pushToGroups(groupIds, {
        title: `New Ticket Assigned — ${ticketNo}`,
        body:  `${ticketTitle}${siteName ? ` · ${siteName}` : ''}`,
        url:   `/tickets/${id}`,
        tag:   `ticket-group-assign-${id}`,
      })
    }
  }

  // ── Push: ticket assigned to engineer ─────────────────────────────────────
  if (body.assigned_to && body.assigned_to !== current?.assigned_to) {
    const uid = await engineerUserId(body.assigned_to)
    if (uid) {
      await pushToUser(uid, {
        title: `New Ticket Assigned — ${ticketNo}`,
        body:  `${ticketTitle}${siteName ? ` · ${siteName}` : ''}`,
        url:   `/tickets/${id}`,
        tag:   `ticket-assign-${id}`,
      })
    }
    // Notify the client a technician has been assigned
    if (current?.reporter_email) {
      const { data: eng } = await supabaseAdmin
        .from('engineers').select('users ( full_name )').eq('id', body.assigned_to).single()
      const engName = (eng?.users as unknown as { full_name: string } | null)?.full_name ?? ''
      await emailClientAssigned(current.reporter_email, ticketNo, engName, siteName).catch(() => {})
    }
  }

  // ── Push: ETA set by engineer → notify client ──────────────────────────────
  if (body.eta_at && body.eta_at !== current?.eta_at) {
    const etaTime = new Date(body.eta_at).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
    const etaDate = new Date(body.eta_at).toLocaleDateString('en-MY', {
      weekday: 'short', day: 'numeric', month: 'short',
    })

    // Push to any client user linked to this ticket's reporter email
    if (current?.reporter_email) {
      const { data: clientUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', current.reporter_email)
        .single()
      if (clientUser) {
        await pushToUser(clientUser.id, {
          title: `Engineer On The Way — ${ticketNo}`,
          body:  `Expected arrival: ${etaDate} at ${etaTime}${siteName ? ` · ${siteName}` : ''}`,
          url:   `/tickets/${id}`,
          tag:   `ticket-eta-${id}`,
        })
      }
    }

    // Also push to all assigned engineers on this ticket so they're aware ETA was set
    if (current?.assigned_to) {
      const uid = await engineerUserId(current.assigned_to)
      if (uid) {
        await pushToUser(uid, {
          title: `ETA Confirmed — ${ticketNo}`,
          body:  `Your ETA has been set to ${etaDate} at ${etaTime}`,
          url:   `/tickets/${id}`,
          tag:   `ticket-eta-confirm-${id}`,
        })
      }
    }
  }

  // ── Activity log ─────────────────────────────────────────────────────────
  if (body.status && body.status !== current?.status) {
    await supabaseAdmin.from('ticket_activities').insert({
      ticket_id: id,
      action:    'status_changed',
      old_value: current?.status,
      new_value: body.status,
    })
  }
  if (body.note) {
    await supabaseAdmin.from('ticket_activities').insert({
      ticket_id: id,
      action:    'note_added',
      note:      body.note,
    })
  }

  return NextResponse.json({ ok: true })
}
