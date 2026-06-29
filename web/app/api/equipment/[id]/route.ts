import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickFields, clampStr } from '@/lib/validate'

const FIELDS = ['name', 'category', 'asset_tag', 'serial_no', 'brand', 'model', 'purchase_date', 'value', 'condition', 'status', 'location', 'notes']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: eq }, { data: log }] = await Promise.all([
    supabaseAdmin.from('company_equipment').select('*, holder:assigned_to ( full_name )').eq('id', id).single(),
    supabaseAdmin.from('equipment_log').select('id, action, note, at, user:user_id ( full_name ), recorder:recorded_by ( full_name )').eq('equipment_id', id).order('at', { ascending: false }).limit(30),
  ])
  if (!eq) return NextResponse.json(null, { status: 404 })
  return NextResponse.json({ ...eq, log: log ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update = pickFields(body, FIELDS)
  for (const k of Object.keys(update)) if (update[k] === '') update[k] = null
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('company_equipment').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('company_equipment').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Assign / return / mark repair
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const note = clampStr(body.note, 500)

  if (body.action === 'checkout') {
    if (!body.user_id) return NextResponse.json({ error: 'Select who is taking it.' }, { status: 400 })
    await supabaseAdmin.from('company_equipment').update({ assigned_to: body.user_id, status: 'in_use', updated_at: new Date().toISOString() }).eq('id', id)
    await supabaseAdmin.from('equipment_log').insert({ equipment_id: id, action: 'checkout', user_id: body.user_id, recorded_by: body.recorded_by ?? null, note })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'return') {
    const { data: eq } = await supabaseAdmin.from('company_equipment').select('assigned_to').eq('id', id).single()
    await supabaseAdmin.from('company_equipment').update({ assigned_to: null, status: 'available', updated_at: new Date().toISOString() }).eq('id', id)
    await supabaseAdmin.from('equipment_log').insert({ equipment_id: id, action: 'return', user_id: eq?.assigned_to ?? null, recorded_by: body.recorded_by ?? null, note })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
