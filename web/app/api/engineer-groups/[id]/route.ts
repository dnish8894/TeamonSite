import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Update group name/description
  if (body.name !== undefined || body.description !== undefined) {
    const { error } = await supabaseAdmin
      .from('engineer_groups')
      .update({ name: body.name, description: body.description ?? null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace members if provided
  if (Array.isArray(body.engineer_ids)) {
    await supabaseAdmin.from('engineer_group_members').delete().eq('group_id', id)
    if (body.engineer_ids.length > 0) {
      const rows = body.engineer_ids.map((eid: string) => ({ group_id: id, engineer_id: eid }))
      const { error } = await supabaseAdmin.from('engineer_group_members').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('engineer_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
