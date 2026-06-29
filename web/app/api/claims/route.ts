import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { clampStr } from '@/lib/validate'
import { notifyTeams } from '@/lib/notify'

const CLAIM_TYPES = ['travel', 'meal', 'parts', 'accommodation', 'ot', 'other']

export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json([], { status: 200 })
  const scope = req.nextUrl.searchParams.get('scope')
  const status = req.nextUrl.searchParams.get('status')
  const isReviewer = ['admin', 'manager', 'hr'].includes(me.role)

  let q = supabaseAdmin
    .from('claims')
    .select('id, claim_type, amount, claim_date, description, receipt_url, reference_note, ot_from, ot_to, status, reviewed_at, review_note, created_at, user_id, users:user_id ( full_name ), reviewer:reviewed_by ( full_name ), tickets ( ticket_no ), projects ( project_no, name )')
    .order('created_at', { ascending: false })

  if (!isReviewer || scope === 'mine') q = q.eq('user_id', me.id)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const body = await req.json()

  const claim_type = CLAIM_TYPES.includes(body.claim_type) ? body.claim_type : 'other'
  const claim_date = clampStr(body.claim_date, 10)
  const amountRaw = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount)
  const amount = isNaN(amountRaw) ? 0 : amountRaw
  if (!claim_date) return NextResponse.json({ error: 'Date is required.' }, { status: 400 })
  if (claim_type === 'ot') {
    if (!body.ot_from || !body.ot_to) return NextResponse.json({ error: 'OT from and to times are required.' }, { status: 400 })
  } else if (amount <= 0) {
    return NextResponse.json({ error: 'A valid amount is required.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('claims').insert({
    user_id: me.id,
    claim_type,
    amount,
    claim_date,
    description: clampStr(body.description, 1000),
    receipt_url: clampStr(body.receipt_url, 500),
    ticket_id: typeof body.ticket_id === 'string' && body.ticket_id ? body.ticket_id : null,
    project_id: typeof body.project_id === 'string' && body.project_id ? body.project_id : null,
    reference_note: clampStr(body.reference_note, 200),
    ot_from: claim_type === 'ot' ? clampStr(body.ot_from, 5) : null,
    ot_to:   claim_type === 'ot' ? clampStr(body.ot_to, 5) : null,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Route to HR + HOD teams (respects notification_prefs)
  await notifyTeams(['hr', 'hod'], {
    title: 'Expense Claim', body: `${me.full_name} submitted a ${claim_type} claim (RM ${amount.toFixed(2)})`, url: '/claims', tag: `claim-${data.id}`,
  }, {
    subject: `Expense Claim — ${me.full_name}`,
    html: `<p><strong>${me.full_name}</strong> submitted a <strong>${claim_type}</strong> claim.</p>
           <p><strong>Amount:</strong> RM ${amount.toFixed(2)} · <strong>Date:</strong> ${claim_date}</p>
           ${body.description ? `<p><strong>Details:</strong> ${clampStr(body.description, 1000)}</p>` : ''}
           <p>Please review in the Claims section.</p>`,
  })

  return NextResponse.json({ ok: true, id: data.id })
}
