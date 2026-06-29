import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { SETTINGS_ROLES } from '@/lib/permissions'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission to view this.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('settings_audit_log')
    .select('id, changes, created_at, users ( full_name )')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
