import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { clampStr } from '@/lib/validate'
import { notifyTeams } from '@/lib/notify'

const LEAVE_TYPES = ['annual', 'medical', 'emergency', 'unpaid', 'other']

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00'), e = new Date(end + 'T00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

// GET — HR/admin/manager see all; everyone else sees their own.
// ?scope=mine forces own-only; ?status= filters.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json([], { status: 200 })
  const scope = req.nextUrl.searchParams.get('scope')
  const status = req.nextUrl.searchParams.get('status')
  const isReviewer = ['admin', 'manager', 'hr'].includes(me.role)

  let q = supabaseAdmin
    .from('leave_requests')
    .select('id, leave_type, start_date, end_date, days, reason, supporting_doc_url, status, reviewed_at, review_note, created_at, user_id, users:user_id ( full_name ), reviewer:reviewed_by ( full_name )')
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

  const leave_type = LEAVE_TYPES.includes(body.leave_type) ? body.leave_type : 'annual'
  const start_date = clampStr(body.start_date, 10)
  const end_date = clampStr(body.end_date, 10)
  if (!start_date || !end_date) return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  if (end_date < start_date) return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('leave_requests').insert({
    user_id: me.id,
    leave_type,
    start_date,
    end_date,
    days: typeof body.days === 'number' && body.days > 0 ? body.days : daysBetween(start_date, end_date),
    reason: clampStr(body.reason, 1000),
    supporting_doc_url: clampStr(body.supporting_doc_url, 500),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Route to the HR + HOD teams (respects notification_prefs).
  await notifyTeams(['hr', 'hod'], {
    title: 'Leave Application', body: `${me.full_name} applied for ${leave_type} leave`, url: '/leave', tag: `leave-${data.id}`,
  }, {
    subject: `Leave Application — ${me.full_name}`,
    html: `<p><strong>${me.full_name}</strong> applied for <strong>${leave_type}</strong> leave.</p>
           <p><strong>Dates:</strong> ${start_date} → ${end_date} (${typeof body.days === 'number' ? body.days : ''} days)</p>
           ${body.reason ? `<p><strong>Reason:</strong> ${clampStr(body.reason, 1000)}</p>` : ''}
           <p>Please review in the Leave section.</p>`,
  })

  return NextResponse.json({ ok: true, id: data.id })
}
