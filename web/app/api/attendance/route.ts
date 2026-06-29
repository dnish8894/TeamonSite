import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') // 'YYYY-MM'
  const from = req.nextUrl.searchParams.get('from') // ISO date, inclusive
  const to = req.nextUrl.searchParams.get('to') // ISO date, exclusive
  const engineerId = req.nextUrl.searchParams.get('engineer_id')

  let query = supabaseAdmin
    .from('attendance_checkins')
    .select(`
      id, check_in_at, check_in_lat, check_in_lng, check_in_landmark, check_in_photo,
      check_out_at, check_out_lat, check_out_lng, check_out_landmark, check_out_photo,
      site_id, site_name,
      engineers ( id, users ( full_name, email ) ),
      sites ( name )
    `)
    .order('check_in_at', { ascending: false })

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    query = query.gte('check_in_at', start).lt('check_in_at', nextMonth)
  } else if (from && to) {
    query = query.gte('check_in_at', from).lt('check_in_at', to)
  }

  if (engineerId) {
    query = query.eq('engineer_id', engineerId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
