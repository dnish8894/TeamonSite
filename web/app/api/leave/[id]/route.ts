import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { clampStr } from '@/lib/validate'
import { pushToUser } from '@/lib/push'

// PATCH — approve / reject (reviewers only) or cancel own pending request.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const body = await req.json()

  const { data: leave } = await supabaseAdmin.from('leave_requests').select('user_id, status').eq('id', id).single()
  if (!leave) return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 })

  const isReviewer = ['admin', 'manager', 'hr'].includes(me.role)

  // Applicant cancelling their own pending request
  if (body.action === 'cancel') {
    if (leave.user_id !== me.id) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    await supabaseAdmin.from('leave_requests').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // Approve / reject
  if (!isReviewer) return NextResponse.json({ error: 'You cannot review leave requests.' }, { status: 403 })
  if (!['approved', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('leave_requests').update({
    status: body.status,
    reviewed_by: me.id,
    reviewed_at: new Date().toISOString(),
    review_note: clampStr(body.review_note, 1000),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the applicant
  await pushToUser(leave.user_id, {
    title: `Leave ${body.status === 'approved' ? 'Approved' : 'Rejected'}`,
    body: `Your leave application has been ${body.status}.`,
    url: '/leave', tag: `leave-review-${id}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
