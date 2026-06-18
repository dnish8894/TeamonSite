import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('engineers')
    .select('id, is_available, skills, daily_capacity_hr, users ( id, full_name, phone, email, is_active )')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.full_name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  // Create user first
  const { data: user, error: userErr } = await supabaseAdmin.from('users').insert({
    organisation_id: org.id,
    email: body.email,
    full_name: body.full_name,
    phone: body.phone ?? null,
    role: 'engineer',
  }).select('id').single()

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  // Create engineer profile
  const { error: engErr } = await supabaseAdmin.from('engineers').insert({
    user_id: user.id,
    employee_id: body.employee_id ?? null,
    skills: body.skills ?? [],
    daily_capacity_hr: body.daily_capacity_hr ?? 8,
  })

  if (engErr) return NextResponse.json({ error: engErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
