import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('site_id')

  if (siteId) {
    // Get systems under this site first, then get their devices
    const { data: systems } = await supabaseAdmin
      .from('elv_systems')
      .select('id')
      .eq('site_id', siteId)

    const sysIds = (systems ?? []).map((s: { id: string }) => s.id)

    if (sysIds.length === 0) return NextResponse.json([])

    const { data, error } = await supabaseAdmin
      .from('devices')
      .select('id, name, tag_id, system_id, device_type, model, serial_no, location_desc, floor, install_date, warranty_start, warranty_expiry')
      .in('system_id', sysIds)
      .eq('is_active', true)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const { data, error } = await supabaseAdmin
    .from('devices')
    .select('id, name, tag_id, device_type, model, serial_no, location_desc')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.system_id) return NextResponse.json({ error: 'System is required.' }, { status: 400 })
  if (!body.device_type) return NextResponse.json({ error: 'Device type is required.' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Device name is required.' }, { status: 400 })

  // Auto-generate tag_id if not provided
  if (!body.tag_id) {
    const prefix = body.device_type.toUpperCase().slice(0, 3)
    const rand = Math.floor(Math.random() * 9000) + 1000
    body.tag_id = `DEV-${prefix}-${rand}`
  }

  const { error } = await supabaseAdmin.from('devices').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
