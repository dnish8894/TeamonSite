import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { clampStr } from '@/lib/validate'

export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  const scope = req.nextUrl.searchParams.get('scope')
  const equipmentId = req.nextUrl.searchParams.get('equipment_id')

  let q = supabaseAdmin
    .from('equipment_bookings')
    .select('id, from_date, to_date, purpose, status, user_id, equipment_id, users:user_id ( full_name ), company_equipment:equipment_id ( name, asset_tag )')
    .eq('status', 'booked')
    .order('from_date', { ascending: true })

  if (scope === 'mine' && me) q = q.eq('user_id', me.id)
  if (equipmentId) q = q.eq('equipment_id', equipmentId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  const body = await req.json()
  const equipment_id = typeof body.equipment_id === 'string' ? body.equipment_id : ''
  const from_date = clampStr(body.from_date, 10)
  const to_date = clampStr(body.to_date, 10)
  if (!equipment_id) return NextResponse.json({ error: 'Select equipment.' }, { status: 400 })
  if (!from_date || !to_date) return NextResponse.json({ error: 'From and to dates are required.' }, { status: 400 })
  if (to_date < from_date) return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 })

  // Conflict check: any existing booking for this equipment whose range overlaps.
  const { data: clash } = await supabaseAdmin
    .from('equipment_bookings')
    .select('id, from_date, to_date, users:user_id ( full_name )')
    .eq('equipment_id', equipment_id)
    .eq('status', 'booked')
    .lte('from_date', to_date)
    .gte('to_date', from_date)
    .limit(1)
  if (clash && clash.length > 0) {
    const c = clash[0] as unknown as { from_date: string; to_date: string; users: { full_name: string } | null }
    return NextResponse.json({ error: `Already booked by ${c.users?.full_name ?? 'someone'} (${c.from_date} → ${c.to_date}).` }, { status: 409 })
  }

  const { error } = await supabaseAdmin.from('equipment_bookings').insert({
    equipment_id,
    user_id: typeof body.user_id === 'string' && body.user_id ? body.user_id : me?.id ?? null,
    from_date, to_date,
    purpose: clampStr(body.purpose, 500),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
