import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Soft-delete a system and (soft-)delete its devices so none are left orphaned.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await supabaseAdmin.from('devices').update({ is_active: false }).eq('system_id', id)
  const { error } = await supabaseAdmin.from('elv_systems').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
