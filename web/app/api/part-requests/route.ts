import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'
import { getCurrentUser } from '@/lib/auth'
import { notifyTeams } from '@/lib/notify'

const REQUEST_TYPES = ['warranty', 'preventive_maintenance', 'quotation', 'project']
const REQUEST_TYPE_LABEL: Record<string, string> = {
  warranty: 'Under Warranty',
  preventive_maintenance: 'Preventive Maintenance',
  quotation: 'Need Quotation',
  project: 'Project',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface PartRequestItem { description: string; model: string | null; remark: string | null }

function parseItems(raw: unknown): PartRequestItem[] | null {
  if (!Array.isArray(raw)) return null
  const items: PartRequestItem[] = []
  for (const row of raw.slice(0, 30)) {
    const description = clampStr((row as Record<string, unknown>)?.description, 500)
    if (!description) continue
    items.push({
      description,
      model: clampStr((row as Record<string, unknown>)?.model, 200),
      remark: clampStr((row as Record<string, unknown>)?.remark, 1000),
    })
  }
  return items.length > 0 ? items : null
}

export async function GET() {
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
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ticketId = typeof body.ticket_id === 'string' && body.ticket_id ? body.ticket_id : null
  const projectId = typeof body.project_id === 'string' && body.project_id ? body.project_id : null
  if (!ticketId && !projectId) return NextResponse.json({ error: 'Either ticket_id or project_id is required.' }, { status: 400 })
  if (!REQUEST_TYPES.includes(body.request_type)) return NextResponse.json({ error: 'Invalid request type.' }, { status: 400 })

  // Project requests can list multiple pieces of equipment in one submission;
  // ticket (breakdown) requests keep the single equipment_description flow.
  const items = projectId ? parseItems(body.items) : null
  const equipment_description = items
    ? items.map(i => i.description).join('; ').slice(0, 1000)
    : clampStr(body.equipment_description, 1000)
  if (!equipment_description) return NextResponse.json({ error: 'Please describe at least one piece of equipment.' }, { status: 400 })

  let refNo = ''
  let refTitle = ''
  let engineerId: string | null = null

  if (ticketId) {
    const { data: ticket } = await supabaseAdmin.from('tickets').select('ticket_no, title, assigned_to').eq('id', ticketId).single()
    refNo = ticket?.ticket_no ?? ''
    refTitle = ticket?.title ?? ''
    engineerId = ticket?.assigned_to ?? null
  } else if (projectId) {
    const { data: project } = await supabaseAdmin.from('projects').select('project_no, name').eq('id', projectId).single()
    refNo = project?.project_no ?? ''
    refTitle = project?.name ?? ''
  }

  // Project requests pick the requester explicitly (a project can be handled by
  // multiple people); ticket requests fall back to whoever is logged in.
  let requestedById: string | null = null
  if (projectId && typeof body.requested_by === 'string' && body.requested_by) {
    const { data: explicitUser } = await supabaseAdmin.from('users').select('id').eq('id', body.requested_by).single()
    if (!explicitUser) return NextResponse.json({ error: 'Invalid requester.' }, { status: 400 })
    requestedById = explicitUser.id
  } else {
    const requester = await getCurrentUser()
    requestedById = requester?.id ?? null
  }

  const { data: request, error } = await supabaseAdmin.from('part_requests').insert({
    ticket_id: ticketId,
    project_id: projectId,
    engineer_id: engineerId,
    requested_by: requestedById,
    equipment_description,
    items,
    request_type: body.request_type,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const typeLabel = REQUEST_TYPE_LABEL[body.request_type] ?? body.request_type
  const itemsHtml = items
    ? `<table border="1" cellpadding="6" style="border-collapse:collapse;margin-top:6px">
         <tr><th>Equipment</th><th>Model</th><th>Remark</th></tr>
         ${items.map(i => `<tr><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.model ?? '—')}</td><td>${escapeHtml(i.remark ?? '—')}</td></tr>`).join('')}
       </table>`
    : `<p><strong>Equipment:</strong> ${escapeHtml(equipment_description)}</p>`
  const emailHtml = `
    <p><strong>${ticketId ? 'Ticket' : 'Project'}:</strong> ${escapeHtml(refNo)} — ${escapeHtml(refTitle)}</p>
    <p><strong>Request Type:</strong> ${typeLabel}</p>
    ${itemsHtml}
  `

  // ── Procurement team (respects notification_prefs) ──
  await notifyTeams(['procurement'], {
    title: 'Part Request — Procurement',
    body: `${refNo}: ${equipment_description.slice(0, 80)}`,
    url: '/part-requests',
    tag: `part-request-${request.id}`,
  }, { subject: `Part Request — ${refNo}`, html: emailHtml })

  // ── Sales team — only when the request is for a quotation ──
  if (body.request_type === 'quotation') {
    await notifyTeams(['sales'], {
      title: 'Quotation Needed — Sales',
      body: `${refNo}: ${equipment_description.slice(0, 80)}`,
      url: '/part-requests',
      tag: `part-request-sales-${request.id}`,
    }, { subject: `Quotation Needed — ${refNo}`, html: emailHtml })
  }

  return NextResponse.json({ ok: true, id: request.id })
}
