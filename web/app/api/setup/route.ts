import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, address, phone, email, admin_email, admin_password, admin_name } = body

  if (!name?.trim())           return NextResponse.json({ error: 'Company name is required.' },  { status: 400 })
  if (!admin_email?.trim())    return NextResponse.json({ error: 'Admin email is required.' },    { status: 400 })
  if (!admin_password?.trim()) return NextResponse.json({ error: 'Admin password is required.' }, { status: 400 })
  if ((admin_password as string).length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  // Check if org already exists
  const { data: existing } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .limit(1)
    .single()

  if (existing) return NextResponse.json({ error: 'Organisation already exists.' }, { status: 409 })

  // 1 — Create organisation
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organisations')
    .insert({ name: name.trim(), address: address || null, phone: phone || null, email: email || null })
    .select('id')
    .single()

  if (orgErr || !org) return NextResponse.json({ error: orgErr?.message ?? 'Failed to create org.' }, { status: 500 })

  // 2 — Create Supabase Auth user (or use existing one with same email)
  let authUserId: string
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: admin_email.trim(),
    password: admin_password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.code === 'email_exists' || authErr.message?.includes('already been registered')) {
      // Auth user exists — look up their ID
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingList?.users?.find(u => u.email === admin_email.trim())
      if (!existing) {
        await supabaseAdmin.from('organisations').delete().eq('id', org.id)
        return NextResponse.json({ error: 'Auth user exists but could not be found.' }, { status: 500 })
      }
      // Update password in case it changed
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: admin_password })
      authUserId = existing.id
    } else {
      await supabaseAdmin.from('organisations').delete().eq('id', org.id)
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }
  } else if (!authUser.user) {
    await supabaseAdmin.from('organisations').delete().eq('id', org.id)
    return NextResponse.json({ error: 'Failed to create auth user.' }, { status: 500 })
  } else {
    authUserId = authUser.user.id
  }
  // 3 — Create users table entry with the SAME id as the auth account.
  // RLS policies resolve organisation via `users.id = auth.uid()`, so these must match
  // or the user will see empty data everywhere once they're outside the service-role context (e.g. mobile app).
  const { error: userErr } = await supabaseAdmin.from('users').insert({
    id:              authUserId,
    organisation_id: org.id,
    email:           admin_email.trim(),
    full_name:       admin_name?.trim() || admin_email.trim(),
    role:            'admin',
  })

  if (userErr) {
    // Clean up — delete auth user + org
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    await supabaseAdmin.from('organisations').delete().eq('id', org.id)
    return NextResponse.json({ error: userErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
