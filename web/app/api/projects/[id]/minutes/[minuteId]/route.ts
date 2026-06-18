import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; minuteId: string }> }
) {
  const { minuteId } = await params
  const body = await req.json()

  const { error } = await supabaseAdmin
    .from('meeting_minutes')
    .update({
      title:            body.title,
      meeting_date:     body.meeting_date,
      location:         body.location         || null,
      attendees:        body.attendees         || null,
      agenda:           body.agenda           || null,
      minutes:          body.minutes          || null,
      action_items:     body.action_items     || null,
      next_meeting_date: body.next_meeting_date || null,
      recurrence:       body.recurrence       || 'none',
      prepared_by:      body.prepared_by      || null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', minuteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; minuteId: string }> }
) {
  const { minuteId } = await params
  const { error } = await supabaseAdmin
    .from('meeting_minutes')
    .delete()
    .eq('id', minuteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
