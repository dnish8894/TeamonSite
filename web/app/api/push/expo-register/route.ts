import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { user_id, token } = await req.json()
  if (!user_id || !token) return NextResponse.json({ error: 'user_id and token are required.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('expo_push_tokens').upsert({
    user_id, token,
  }, { onConflict: 'token' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { token } = await req.json()
  if (token) await supabaseAdmin.from('expo_push_tokens').delete().eq('token', token)
  return NextResponse.json({ ok: true })
}
