import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { clampStr } from '@/lib/validate'
import { pushToUser } from '@/lib/push'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const body = await req.json()

  const { data: claim } = await supabaseAdmin.from('claims').select('user_id, status').eq('id', id).single()
  if (!claim) return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })

  const isReviewer = ['admin', 'manager', 'hr'].includes(me.role)

  if (body.action === 'cancel') {
    if (claim.user_id !== me.id) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    await supabaseAdmin.from('claims').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (!isReviewer) return NextResponse.json({ error: 'You cannot review claims.' }, { status: 403 })
  if (!['approved', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('claims').update({
    status: body.status,
    reviewed_by: me.id,
    reviewed_at: new Date().toISOString(),
    review_note: clampStr(body.review_note, 1000),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await pushToUser(claim.user_id, {
    title: `Claim ${body.status === 'approved' ? 'Approved' : 'Rejected'}`,
    body: `Your expense claim has been ${body.status}.`,
    url: '/claims', tag: `claim-review-${id}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
