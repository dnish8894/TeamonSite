import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('meeting_minutes')
    .select('*')
    .eq('project_id', id)
    .order('meeting_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  if (!body.title?.trim())        return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!body.meeting_date)         return NextResponse.json({ error: 'Meeting date is required.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('meeting_minutes').insert({
    project_id:       id,
    title:            body.title.trim(),
    meeting_date:     body.meeting_date,
    location:         body.location         || null,
    attendees:        body.attendees         || null,
    agenda:           body.agenda           || null,
    minutes:          body.minutes          || null,
    action_items:     body.action_items     || null,
    next_meeting_date: body.next_meeting_date || null,
    recurrence:       body.recurrence       || 'none',
    prepared_by:      body.prepared_by      || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
