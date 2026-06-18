import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const { error } = await supabaseAdmin
    .from('engineers')
    .update(body)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Get user_id first to cascade delete
  const { data: eng } = await supabaseAdmin
    .from('engineers')
    .select('user_id')
    .eq('id', id)
    .single()

  if (eng?.user_id) {
    await supabaseAdmin.from('users').delete().eq('id', eng.user_id)
  }

  return NextResponse.json({ ok: true })
}
