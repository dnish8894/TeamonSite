import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.name       !== undefined) update.name          = body.name
  if (body.part_no    !== undefined) update.part_no       = body.part_no || null
  if (body.brand      !== undefined) update.brand         = body.brand || null
  if (body.unit       !== undefined) update.unit          = body.unit
  if (body.unit_cost  !== undefined) update.unit_cost     = body.unit_cost ? parseFloat(body.unit_cost) : null
  if (body.min_stock_qty !== undefined) update.min_stock_qty = parseFloat(body.min_stock_qty)
  if (body.location   !== undefined) update.location      = body.location || null
  if (body.is_active  !== undefined) update.is_active     = body.is_active

  const { error } = await supabaseAdmin.from('parts').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Soft delete
  const { error } = await supabaseAdmin.from('parts').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
