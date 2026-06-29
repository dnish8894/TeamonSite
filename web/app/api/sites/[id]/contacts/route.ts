import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('site_contacts')
    .select('id, name, title, phone, email, is_primary')
    .eq('site_id', id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const name = clampStr(body.name, 120)
  if (!name) return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 })

  // Only one primary per site
  if (body.is_primary) await supabaseAdmin.from('site_contacts').update({ is_primary: false }).eq('site_id', id)

  const { data, error } = await supabaseAdmin.from('site_contacts').insert({
    site_id: id,
    name,
    title: clampStr(body.title, 120),
    phone: clampStr(body.phone, 40),
    email: clampStr(body.email, 200),
    is_primary: !!body.is_primary,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
