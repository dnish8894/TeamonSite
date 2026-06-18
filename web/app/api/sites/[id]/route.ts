import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select(`
      id, name, address, postcode, city, state, lat, lng, floors,
      site_contact, site_phone, access_notes, is_active, created_at,
      contract_type, contract_start, contract_end,
      clients ( id, name, type ),
      elv_systems (
        id, type, name, brand, model, location_desc, install_date, is_active,
        devices ( id, name, tag_id, device_type, model, is_active )
      ),
      tickets ( id, ticket_no, title, status, priority, created_at )
    `)
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowed = [
    'name', 'address', 'postcode', 'city', 'state',
    'site_contact', 'site_phone', 'access_notes', 'is_active',
    'contract_type', 'contract_start', 'contract_end',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }

  const { error } = await supabaseAdmin.from('sites').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
