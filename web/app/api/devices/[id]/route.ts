import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickFields } from '@/lib/validate'

const FIELDS = [
  'device_type', 'name', 'brand', 'model', 'serial_no', 'ip_address', 'mac_address',
  'location_desc', 'floor', 'install_date', 'warranty_start', 'warranty_expiry',
  'vendor_warranty_start', 'vendor_warranty_end', 'tag_id',
  'work_at_height', 'work_at_height_notes', 'under_contract',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update = pickFields(body, FIELDS)

  // Normalise empty strings to null for nullable columns
  for (const k of Object.keys(update)) {
    if (update[k] === '') update[k] = null
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('devices').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('devices').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
