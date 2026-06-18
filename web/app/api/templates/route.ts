import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  let query = supabaseAdmin.from('app_templates').select('*').order('created_at')
  if (type) query = query.eq('template_type', type)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  // If setting as default, clear other defaults for same type
  if (body.is_default) {
    await supabaseAdmin
      .from('app_templates')
      .update({ is_default: false })
      .eq('organisation_id', org.id)
      .eq('template_type', body.template_type)
  }

  const { data, error } = await supabaseAdmin.from('app_templates').insert({
    organisation_id: org.id,
    template_type: body.template_type,
    name: body.name,
    config: body.config ?? {},
    is_default: body.is_default ?? false,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
