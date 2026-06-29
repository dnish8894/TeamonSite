import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { setUserTeams } from '@/lib/teams'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, phone, role, is_active, last_login_at, created_at, user_teams ( team )')
    .order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Flatten teams to a string[] per user
  const rows = (data ?? []).map(u => ({
    ...u,
    teams: ((u as { user_teams?: { team: string }[] }).user_teams ?? []).map(t => t.team),
  }))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.full_name?.trim()) return NextResponse.json({ error: 'Name is required.' },     { status: 400 })
  if (!body.email?.trim())     return NextResponse.json({ error: 'Email is required.' },     { status: 400 })
  if (!body.password?.trim())  return NextResponse.json({ error: 'Password is required.' },  { status: 400 })
  if ((body.password as string).length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  // 1 — Create Supabase Auth account
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email:         body.email.trim(),
    password:      body.password,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // 2 — Create users table entry with the SAME id as the auth account.
  // RLS policies resolve organisation via `users.id = auth.uid()`, so these must match
  // or the user will see empty data everywhere once they're outside the service-role context (e.g. mobile app).
  const { error: dbErr } = await supabaseAdmin.from('users').insert({
    id: authUser.user!.id,
    organisation_id: org.id,
    full_name: body.full_name.trim(),
    email:     body.email.trim(),
    phone:     body.phone || null,
    role:      body.role  || 'engineer',
  })

  if (dbErr) {
    // Rollback auth user
    if (authUser?.user?.id) await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  if (Array.isArray(body.teams)) await setUserTeams(authUser.user!.id, body.teams)

  return NextResponse.json({ ok: true })
}
