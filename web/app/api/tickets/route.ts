import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'
import { getCurrentUser } from '@/lib/auth'
import { emailClientSubmission } from '@/lib/clientEmail'

const TICKET_TYPES = ['breakdown', 'preventive_maintenance', 'installation', 'inspection', 'upgrade', 'relocation']
const PRIORITIES = ['P1', 'P2', 'P3', 'P4']

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('v_open_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const title = clampStr(body.title, 200)
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (typeof body.site_id !== 'string' || !body.site_id) return NextResponse.json({ error: 'Site is required.' }, { status: 400 })

  const type     = TICKET_TYPES.includes(body.type) ? body.type : 'breakdown'
  const priority = PRIORITIES.includes(body.priority) ? body.priority : 'P3'

  // Only these fields may be set by the caller — defends against mass-assignment
  // (e.g. a public QR submitter setting status, assigned_to, organisation_id, etc.)
  const insert = {
    title,
    description:    clampStr(body.description, 4000),
    site_id:        body.site_id,
    device_id:      typeof body.device_id === 'string' ? body.device_id : null,
    system_id:      typeof body.system_id === 'string' ? body.system_id : null,
    type,
    priority,
    reporter_name:  clampStr(body.reporter_name, 120),
    reporter_phone: clampStr(body.reporter_phone, 30),
    reporter_email: clampStr(body.reporter_email, 160),
    source_qr_tier: clampStr(body.source_qr_tier, 20),
    source_qr_id:   typeof body.source_qr_id === 'string' ? body.source_qr_id.slice(0, 100) : null,
    is_chargeable:  typeof body.is_chargeable === 'boolean' ? body.is_chargeable : false,
    intake_answers: body.intake_answers && typeof body.intake_answers === 'object' ? body.intake_answers : null,
  }

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  // Logged-in staff get attributed as the creator; public QR self-service submissions have no session.
  const creator = await getCurrentUser()

  const { data: created, error } = await supabaseAdmin.from('tickets').insert({
    ...insert,
    organisation_id: org.id,
    created_by: creator?.id ?? null,
    ticket_no: '',
  }).select('id, ticket_no').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Confirmation email to the client who reported it (if they gave an email).
  if (insert.reporter_email) {
    let siteName = ''
    if (insert.site_id) {
      const { data: s } = await supabaseAdmin.from('sites').select('name').eq('id', insert.site_id).single()
      siteName = s?.name ?? ''
    }
    await emailClientSubmission(insert.reporter_email, created.ticket_no, insert.title, siteName).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
