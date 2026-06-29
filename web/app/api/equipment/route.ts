import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'

const CATEGORIES = ['tool', 'instrument', 'laptop', 'ladder', 'vehicle', 'other']
const CONDITIONS = ['new', 'good', 'fair', 'poor']

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  const category = req.nextUrl.searchParams.get('category')
  let q = supabaseAdmin
    .from('company_equipment')
    .select('id, name, category, asset_tag, serial_no, brand, model, purchase_date, value, condition, status, location, notes, assigned_to, holder:assigned_to ( full_name )')
    .eq('is_active', true)
    .order('name')
  if (status) q = q.eq('status', status)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = clampStr(body.name, 200)
  if (!name) return NextResponse.json({ error: 'Equipment name is required.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('company_equipment').insert({
    organisation_id: org.id,
    name,
    category: CATEGORIES.includes(body.category) ? body.category : 'tool',
    asset_tag: clampStr(body.asset_tag, 60),
    serial_no: clampStr(body.serial_no, 120),
    brand: clampStr(body.brand, 120),
    model: clampStr(body.model, 120),
    purchase_date: clampStr(body.purchase_date, 10),
    value: typeof body.value === 'number' ? body.value : (parseFloat(body.value) || null),
    condition: CONDITIONS.includes(body.condition) ? body.condition : 'good',
    location: clampStr(body.location, 200),
    notes: clampStr(body.notes, 1000),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
