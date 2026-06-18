import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/standby?year=2026&month=6
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabaseAdmin
    .from('standby_schedule')
    .select('id, schedule_date, shift, notes, user_id, users(id, full_name, role, phone, avatar_url)')
    .gte('schedule_date', from)
    .lte('schedule_date', to)
    .order('schedule_date')
    .order('shift')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/standby  { schedule_date, user_id, shift, notes, created_by }
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.schedule_date) return NextResponse.json({ error: 'Date is required.' }, { status: 400 })
  if (!body.user_id)       return NextResponse.json({ error: 'Engineer is required.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('standby_schedule')
    .upsert({
      schedule_date: body.schedule_date,
      user_id:       body.user_id,
      shift:         body.shift ?? 'all_day',
      notes:         body.notes ?? null,
      created_by:    body.created_by ?? null,
    }, { onConflict: 'user_id,schedule_date,shift' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
