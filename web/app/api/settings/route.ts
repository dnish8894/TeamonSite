import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { SETTINGS_ROLES } from '@/lib/permissions'
import { pickFields } from '@/lib/validate'

const ALLOWED_FIELDS = [
  'name', 'logo_url', 'address', 'phone', 'email', 'timezone', 'currency',
  'report_settings', 'procurement_email', 'sales_email', 'hr_email', 'hod_email', 'brand_color',
  'notification_prefs', 'default_sla', 'intake_questions', 'attendance_photo_required', 'attendance_break_minutes',
  'pm_check_items',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_from', // smtp_pass handled separately below
]

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('organisations')
    .select('*')
    .limit(1)
    .single()
  if (error || !data) return NextResponse.json({
    id: null, name: '', address: null, phone: null, email: null,
    timezone: 'Asia/Kuala_Lumpur', currency: 'MYR', logo_url: null
  })
  // Never expose the stored SMTP password to the client — just whether one is set.
  const { smtp_pass, ...safe } = data as Record<string, unknown>
  return NextResponse.json({ ...safe, smtp_pass_set: !!smtp_pass })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission to change settings.' }, { status: 403 })
  }

  const body = await req.json()
  const update = pickFields(body, ALLOWED_FIELDS)
  // SMTP password: only update when a non-empty value is sent (blank = keep existing).
  if (typeof body.smtp_pass === 'string' && body.smtp_pass.trim() !== '') {
    (update as Record<string, unknown>).smtp_pass = body.smtp_pass
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('*').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 404 })

  // Only log fields that actually changed.
  const orgRecord = org as Record<string, unknown>
  const updateRecord = update as Record<string, unknown>
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(update)) {
    if (JSON.stringify(orgRecord[key]) !== JSON.stringify(updateRecord[key])) {
      diff[key] = key === 'smtp_pass'
        ? { from: '••••••', to: '••••••' }   // never log the password
        : { from: orgRecord[key], to: updateRecord[key] }
    }
  }

  const { error } = await supabaseAdmin
    .from('organisations')
    .update(update)
    .eq('id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Object.keys(diff).length > 0) {
    await supabaseAdmin.from('settings_audit_log').insert({ user_id: user.id, changes: diff })
  }

  return NextResponse.json({ ok: true })
}
