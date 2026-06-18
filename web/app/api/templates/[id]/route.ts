import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (body.is_default) {
    const { data: tpl } = await supabaseAdmin.from('app_templates').select('organisation_id, template_type').eq('id', id).single()
    if (tpl) {
      await supabaseAdmin.from('app_templates').update({ is_default: false })
        .eq('organisation_id', tpl.organisation_id).eq('template_type', tpl.template_type)
    }
  }

  const { error } = await supabaseAdmin.from('app_templates').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('app_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
