import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select(`
      id, name, type, registration_no, address, contact_name, contact_email, contact_phone, notes, is_active, created_at,
      sites ( id, name, city, state, is_active, site_contact, site_phone,
        elv_systems ( id, type, name ),
        tickets ( id, status )
      ),
      contracts ( id, contract_no, type, start_date, end_date, sla_response_hr, sla_resolve_hr, is_active )
    `)
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { error } = await supabaseAdmin.from('clients').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
