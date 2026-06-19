import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data: groups, error } = await supabaseAdmin
    .from('engineer_groups')
    .select('id, name, description, created_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: members } = await supabaseAdmin
    .from('engineer_group_members')
    .select('group_id, engineer_id, engineers ( id, users ( full_name, email ) )')

  const membersByGroup: Record<string, typeof members> = {}
  for (const m of members ?? []) {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
    membersByGroup[m.group_id]!.push(m)
  }

  const result = (groups ?? []).map(g => ({
    ...g,
    engineer_group_members: membersByGroup[g.id] ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Group name is required.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('engineer_groups')
    .insert({ name: body.name.trim(), description: body.description || null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
