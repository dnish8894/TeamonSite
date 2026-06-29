import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (typeof body.checkin_id !== 'string' || !body.checkin_id)
    return NextResponse.json({ error: 'checkin_id is required.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('attendance_checkins').update({
    check_out_at: new Date().toISOString(),
    check_out_lat: body.lat ?? null,
    check_out_lng: body.lng ?? null,
    check_out_landmark: typeof body.landmark === 'string' ? body.landmark.slice(0, 200) : null,
    check_out_photo: typeof body.photo === 'string' ? body.photo.slice(0, 500) : null,
  }).eq('id', body.checkin_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
