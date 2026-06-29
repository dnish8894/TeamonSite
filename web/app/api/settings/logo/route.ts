import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { SETTINGS_ROLES } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission to change settings.' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
  if (file.size > 2_000_000) return NextResponse.json({ error: 'Logo must be under 2MB.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${org.id}/logo-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('org-assets')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage.from('org-assets').getPublicUrl(path)

  const { error: updateErr } = await supabaseAdmin
    .from('organisations')
    .update({ logo_url: urlData.publicUrl })
    .eq('id', org.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await supabaseAdmin.from('settings_audit_log').insert({
    user_id: user.id,
    changes: { logo_url: { from: null, to: urlData.publicUrl } },
  })

  return NextResponse.json({ logo_url: urlData.publicUrl })
}
