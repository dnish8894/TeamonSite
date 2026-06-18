import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await supabaseAdmin.from('project_tnc').select('*').eq('project_id', id).single()
  return NextResponse.json(data ?? null)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { data: existing } = await supabaseAdmin.from('project_tnc').select('id').eq('project_id', id).single()
  if (existing) {
    const { error } = await supabaseAdmin.from('project_tnc').update(body).eq('project_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin.from('project_tnc').insert({ ...body, project_id: id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
