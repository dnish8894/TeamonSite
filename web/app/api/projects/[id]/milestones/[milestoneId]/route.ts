import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { milestoneId } = await params
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .update({
      title:           body.title,
      status:          body.status,
      completion_date: body.completion_date ?? null,
      category:        body.category,
      priority:        body.priority,
      notes:           body.notes ?? null,
      ref_doc:         body.ref_doc ?? null,
      percent_done:    body.percent_done ?? 0,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', milestoneId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { milestoneId } = await params
  const { error } = await supabaseAdmin
    .from('project_milestones')
    .delete()
    .eq('id', milestoneId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
