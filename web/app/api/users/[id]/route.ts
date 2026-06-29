import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickFields, clampStr } from '@/lib/validate'
import { setUserTeams } from '@/lib/teams'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const update = pickFields(body, ['full_name', 'email', 'phone', 'role', 'is_active'])
  if ('full_name' in update) update.full_name = clampStr(update.full_name, 120)
  if ('email' in update) update.email = clampStr(update.email, 200)
  if ('phone' in update) update.phone = clampStr(update.phone, 30)

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('users').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Email change must also be applied to the Auth account, or the user can't log in with it.
  if (typeof update.email === 'string' && update.email) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, { email: update.email })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  // Optional password change — goes through the Auth admin API, not the users table.
  if (typeof body.password === 'string' && body.password.trim()) {
    if (body.password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password: body.password })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  if (Array.isArray(body.teams)) await setUserTeams(id, body.teams)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('users').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
