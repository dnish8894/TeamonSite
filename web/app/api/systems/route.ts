import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id')

  let query = supabaseAdmin
    .from('elv_systems')
    .select('id, name, type, type_label, brand, model, install_date, warranty_expiry, location_desc, is_active, site_id')
    .eq('is_active', true)
    .order('type')

  if (siteId) query = query.eq('site_id', siteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.site_id) return NextResponse.json({ error: 'Site is required.' }, { status: 400 })
  if (!body.type) return NextResponse.json({ error: 'System type is required.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('elv_systems').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
