import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { pushToUser } from '@/lib/push'
import { sendEmailSafe } from '@/lib/email'
import { clampStr } from '@/lib/validate'

const STATUSES = ['pending', 'reviewed', 'ready', 'closed']

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('part_requests')
    .select(`
      id, equipment_description, items, request_type, status, created_at,
      ready_note, ready_at, acknowledged_at,
      tickets ( id, ticket_no, title, sites ( name, clients ( name ) ) ),
      projects ( id, project_no, name, clients ( name ) ),
      engineers ( id, users ( full_name ) ),
      requested_by_user:requested_by ( full_name ),
      acknowledged_by_user:acknowledged_by ( full_name )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (body.action === 'acknowledge') {
    const user = await getCurrentUser()
    const { error } = await supabaseAdmin.from('part_requests').update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user?.id ?? null,
      status: 'closed',
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })

  const update: Record<string, unknown> = { status: body.status }
  if (body.status === 'ready') {
    update.ready_note = clampStr(body.ready_note, 1000)
    update.ready_at = new Date().toISOString()
  }

  const { data: row, error } = await supabaseAdmin.from('part_requests').update(update).eq('id', id)
    .select('id, equipment_description, ready_note, requested_by, engineer_id, tickets(ticket_no), projects(project_no)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === 'ready') {
    const ticket = Array.isArray(row.tickets) ? row.tickets[0] : row.tickets
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
    const refNo = ticket?.ticket_no ?? project?.project_no ?? ''
    const noteText = update.ready_note ? ` — ${update.ready_note}` : ''
    const recipientUserIds = new Set<string>()
    if (row.requested_by) recipientUserIds.add(row.requested_by)
    if (row.engineer_id) {
      const { data: eng } = await supabaseAdmin.from('engineers').select('user_id').eq('id', row.engineer_id).single()
      if (eng?.user_id) recipientUserIds.add(eng.user_id)
    }
    if (recipientUserIds.size > 0) {
      const { data: recipients } = await supabaseAdmin.from('users').select('id, email').in('id', Array.from(recipientUserIds))
      await Promise.allSettled((recipients ?? []).map(u => pushToUser(u.id, {
        title: 'Part Ready for Collection',
        body: `${refNo}: ${row.equipment_description.slice(0, 80)}${noteText}`,
        url: '/part-requests',
        tag: `part-request-ready-${id}`,
      })))
      const emails = (recipients ?? []).map(u => u.email).filter(Boolean)
      if (emails.length > 0) {
        await sendEmailSafe({
          to: emails,
          subject: `Part Ready for Collection — ${refNo}`,
          html: `<p><strong>Equipment:</strong> ${escapeHtml(row.equipment_description)}</p>${update.ready_note ? `<p><strong>Note:</strong> ${escapeHtml(update.ready_note as string)}</p>` : ''}`,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
