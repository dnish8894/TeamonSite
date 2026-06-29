import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Monday (ISO) of the week containing `d`, as YYYY-MM-DD.
export function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = x.getUTCDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  x.setUTCDate(x.getUTCDate() + diff)
  return x.toISOString().slice(0, 10)
}

// GET /api/standby-weeks?year=2026&month=6        → weeks overlapping that month
// GET /api/standby-weeks?user_id=…&from=YYYY-MM-DD → that user's weeks from a date (mobile)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const from   = searchParams.get('from')

  let q = supabaseAdmin
    .from('standby_weeks')
    .select('id, week_start, notes, user_id, users:user_id ( id, full_name, role, phone, avatar_url )')
    .order('week_start')

  if (userId) {
    q = q.eq('user_id', userId)
    if (from) q = q.gte('week_start', from)
  } else {
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    // Any week whose Monday falls from the Monday-of-the-1st through the last day.
    const first = new Date(year, month - 1, 1)
    const last  = new Date(year, month, 0)
    q = q.gte('week_start', mondayOf(first)).lte('week_start', last.toISOString().slice(0, 10))
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/standby-weeks  { week_start, user_id, notes, created_by }
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.week_start) return NextResponse.json({ error: 'Week is required.' }, { status: 400 })
  if (!body.user_id)    return NextResponse.json({ error: 'Engineer is required.' }, { status: 400 })

  // Normalise to the Monday of whatever date was sent.
  const week_start = mondayOf(new Date(body.week_start))

  const { data, error } = await supabaseAdmin
    .from('standby_weeks')
    .upsert({
      week_start,
      user_id:    body.user_id,
      notes:      body.notes ?? null,
      created_by: body.created_by ?? null,
    }, { onConflict: 'week_start,user_id' })
    .select('id, week_start, notes, user_id, users:user_id ( id, full_name, role, phone, avatar_url )')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
