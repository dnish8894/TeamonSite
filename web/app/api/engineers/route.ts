import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('engineers')
    .select('id, is_available, skills, daily_capacity_hr, employee_id, engineer_type, users ( id, full_name, phone, email, is_active, role )')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.full_name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!body.email?.trim())     return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  if (!body.password?.trim())  return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  if ((body.password as string).length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  // 1 — Create Supabase Auth account so this engineer can actually log in
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // 2 — Create user record with the SAME id as the auth account.
  // RLS policies resolve organisation via `users.id = auth.uid()`, so these must match
  // or the user will see empty data everywhere once they're outside the service-role context (e.g. mobile app).
  const { data: user, error: userErr } = await supabaseAdmin.from('users').insert({
    id: authUser.user.id,
    organisation_id: org.id,
    email: body.email.trim(),
    full_name: body.full_name,
    phone: body.phone ?? null,
    role: 'engineer',
  }).select('id').single()

  if (userErr) {
    if (authUser?.user?.id) await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: userErr.message }, { status: 500 })
  }

  // 3 — Create engineer profile
  const { error: engErr } = await supabaseAdmin.from('engineers').insert({
    user_id: user.id,
    employee_id: body.employee_id ?? null,
    skills: body.skills ?? [],
    daily_capacity_hr: body.daily_capacity_hr ?? 8,
    engineer_type: ['maintenance', 'project', 'both'].includes(body.engineer_type) ? body.engineer_type : 'maintenance',
  })

  if (engErr) {
    await supabaseAdmin.from('users').delete().eq('id', user.id)
    if (authUser?.user?.id) await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: engErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
