import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickFields, clampStr } from '@/lib/validate'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const { data: engineer } = await supabaseAdmin.from('engineers').select('user_id').eq('id', id).single()
  if (!engineer) return NextResponse.json({ error: 'Engineer not found.' }, { status: 404 })

  // Engineer-table fields
  const engUpdate = pickFields(body, ['is_available', 'daily_capacity_hr', 'skills', 'employee_id', 'certifications', 'engineer_type'])
  if (Object.keys(engUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('engineers').update(engUpdate).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Linked user-table fields (name/email/phone) + optional password reset
  const userUpdate = pickFields(body, ['full_name', 'phone', 'email'])
  if ('full_name' in userUpdate) userUpdate.full_name = clampStr(userUpdate.full_name, 120)
  if ('phone' in userUpdate) userUpdate.phone = clampStr(userUpdate.phone, 30)
  if ('email' in userUpdate) userUpdate.email = clampStr(userUpdate.email, 200)

  if (Object.keys(userUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('users').update(userUpdate).eq('id', engineer.user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Email change must also be applied to the Auth account, or they can't log in with it.
  if (typeof userUpdate.email === 'string' && userUpdate.email) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(engineer.user_id, { email: userUpdate.email })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  if (typeof body.password === 'string' && body.password.trim()) {
    if (body.password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(engineer.user_id, { password: body.password })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Get user_id first to cascade delete
  const { data: eng } = await supabaseAdmin
    .from('engineers')
    .select('user_id')
    .eq('id', id)
    .single()

  if (eng?.user_id) {
    await supabaseAdmin.from('users').delete().eq('id', eng.user_id)
  }

  return NextResponse.json({ ok: true })
}
