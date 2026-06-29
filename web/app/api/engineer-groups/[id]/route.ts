import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GROUP_TYPES = ['project_team', 'maintenance_team']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Update group name/description/type
  const groupUpdate: Record<string, unknown> = {}
  if (body.name !== undefined) groupUpdate.name = body.name
  if (body.description !== undefined) groupUpdate.description = body.description ?? null
  if (body.group_type !== undefined) {
    if (!GROUP_TYPES.includes(body.group_type)) return NextResponse.json({ error: 'Invalid group type.' }, { status: 400 })
    groupUpdate.group_type = body.group_type
  }
  if (Object.keys(groupUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('engineer_groups').update(groupUpdate).eq('id', id)
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

    // The group's type sets the privilege of every engineer assigned into it —
    // Project Team groups get the project-only role, Maintenance Team groups get the
    // full engineer (ticket/breakdown) role.
    const { data: group } = await supabaseAdmin.from('engineer_groups').select('group_type').eq('id', id).single()
    if (group && body.engineer_ids.length > 0) {
      const roleForGroup = group.group_type === 'project_team' ? 'project' : 'engineer'
      const { data: engs } = await supabaseAdmin
        .from('engineers')
        .select('user_id')
        .in('id', body.engineer_ids)
      const userIds = (engs ?? []).map(e => e.user_id).filter(Boolean)
      if (userIds.length > 0) {
        await supabaseAdmin.from('users').update({ role: roleForGroup }).in('id', userIds)
      }
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
