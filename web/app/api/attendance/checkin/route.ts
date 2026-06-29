import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyTeams } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (typeof body.engineer_id !== 'string' || !body.engineer_id)
    return NextResponse.json({ error: 'engineer_id is required.' }, { status: 400 })
  if (!body.site_id && !body.site_name)
    return NextResponse.json({ error: 'site_id or site_name is required.' }, { status: 400 })

  const { data: row, error } = await supabaseAdmin.from('attendance_checkins').insert({
    engineer_id: body.engineer_id,
    check_in_at: new Date().toISOString(),
    check_in_lat: body.lat ?? null,
    check_in_lng: body.lng ?? null,
    check_in_landmark: typeof body.landmark === 'string' ? body.landmark.slice(0, 200) : null,
    check_in_photo: typeof body.photo === 'string' ? body.photo.slice(0, 500) : null,
    site_id: body.site_id ?? null,
    site_name: typeof body.site_name === 'string' ? body.site_name.slice(0, 120) : null,
  }).select('id, check_in_at, check_in_lat, check_in_lng, check_in_landmark, check_in_photo, site_id, site_name').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: engineer } = await supabaseAdmin
    .from('engineers')
    .select('users ( full_name )')
    .eq('id', body.engineer_id)
    .single()
  const engineerName = (engineer?.users as unknown as { full_name: string } | null)?.full_name ?? 'An engineer'

  const checkInTime = new Date(row.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })

  // Route to the HR team (respects notification_prefs)
  await notifyTeams(['hr'], {
    title: 'Engineer Checked In',
    body: `${engineerName} checked in at ${checkInTime}`,
    url: '/attendance',
    tag: `checkin-${row.id}`,
  }, {
    subject: `Engineer Checked In — ${engineerName}`,
    html: `<p>${engineerName} checked in at ${checkInTime}.</p>`,
  })

  return NextResponse.json(row)
}
