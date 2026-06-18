import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getCurrentUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('users').select('id, role').eq('email', user.email!).single()
  return profile
}

export async function GET() {
  const me = await getCurrentUser()

  let query = supabaseAdmin
    .from('projects')
    .select('id, project_no, name, status, value, start_date, end_date, created_at, clients(name), sites(name)')
    .order('created_at', { ascending: false })

  // Admins and managers see all projects; others only see assigned ones
  if (me && !['admin', 'manager'].includes(me.role)) {
    const { data: assigned } = await supabaseAdmin
      .from('project_assignments')
      .select('project_id')
      .eq('user_id', me.id)
    const ids = (assigned ?? []).map((a: { project_id: string }) => a.project_id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
  if (!body.client_id)    return NextResponse.json({ error: 'Client is required.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('projects').insert({
    ...body,
    organisation_id: org.id,
    project_no: '',
  }).select('id, project_no').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
