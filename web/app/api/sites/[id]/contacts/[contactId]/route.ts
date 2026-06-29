import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickFields, clampStr } from '@/lib/validate'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params
  const body = await req.json()
  const update = pickFields(body, ['name', 'title', 'phone', 'email', 'is_primary'])
  if ('name' in update) update.name = clampStr(update.name, 120)
  if ('title' in update) update.title = clampStr(update.title, 120)
  if ('phone' in update) update.phone = clampStr(update.phone, 40)
  if ('email' in update) update.email = clampStr(update.email, 200)

  if (update.is_primary) await supabaseAdmin.from('site_contacts').update({ is_primary: false }).eq('site_id', id)

  const { error } = await supabaseAdmin.from('site_contacts').update(update).eq('id', contactId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params
  const { error } = await supabaseAdmin.from('site_contacts').delete().eq('id', contactId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
