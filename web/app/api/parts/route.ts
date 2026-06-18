import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('parts')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Part name is required.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('parts').insert({
    organisation_id: org.id,
    name:          body.name.trim(),
    part_no:       body.part_no       || null,
    brand:         body.brand         || null,
    unit:          body.unit          || 'pcs',
    unit_cost:     body.unit_cost     ? parseFloat(body.unit_cost) : null,
    stock_qty:     body.stock_qty     ? parseFloat(body.stock_qty) : 0,
    min_stock_qty: body.min_stock_qty ? parseFloat(body.min_stock_qty) : 0,
    location:      body.location      || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
