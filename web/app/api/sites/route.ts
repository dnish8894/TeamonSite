import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('id,name,city,state,is_active,client_id,contract_type,contract_end,clients(id,name)')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Site name is required.' }, { status: 400 })
  if (!body.client_id) return NextResponse.json({ error: 'Client is required.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('sites').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
