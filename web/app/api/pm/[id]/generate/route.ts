import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pushToUser, engineerUserId } from '@/lib/push'

// Generate a PM REPORT from a schedule. Snapshots the covered devices
// (pinned devices, else all active devices in the system/site) into the report,
// then advances the schedule's next_due_at.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: sched, error: schedErr } = await supabaseAdmin
    .from('pm_schedules')
    .select(`
      id, interval_days, assigned_to, site_id, system_id,
      engineers ( id, users ( full_name ) ),
      pm_schedule_devices ( devices ( id, name, tag_id ) )
    `)
    .eq('id', id)
    .single()

  if (schedErr || !sched) return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 })

  // Resolve covered devices: pinned ones, else whole system, else whole site.
  let covered = ((sched.pm_schedule_devices as unknown as
    { devices: { id: string; name: string | null; tag_id: string | null } | null }[] | null) ?? [])
    .map(r => r.devices).filter((d): d is { id: string; name: string | null; tag_id: string | null } => !!d)

  if (covered.length === 0) {
    let q = supabaseAdmin.from('devices').select('id, name, tag_id').eq('is_active', true)
    if (sched.system_id) {
      q = q.eq('system_id', sched.system_id)
    } else {
      const { data: systems } = await supabaseAdmin
        .from('elv_systems').select('id').eq('site_id', sched.site_id)
      q = q.in('system_id', (systems ?? []).map((s: { id: string }) => s.id))
    }
    const { data: devs } = await q.order('name')
    covered = devs ?? []
  }

  const deviceLines = covered.map(d => ({
    device_id: d.id, name: d.name, tag_id: d.tag_id,
    checks: {} as Record<string, boolean>, notes: '',
  }))

  // Prefill servicing engineers with the schedule's assigned engineer (if any)
  const leadName = (sched.engineers as unknown as { users: { full_name: string } | null } | null)?.users?.full_name
  const serviceEngineers = sched.assigned_to
    ? [{ id: sched.assigned_to, name: leadName ?? '' }]
    : []

  const { data: report, error: repErr } = await supabaseAdmin
    .from('pm_reports')
    .insert({
      schedule_id: sched.id,
      site_id:     sched.site_id,
      system_id:   sched.system_id   || null,
      engineer_id: sched.assigned_to || null,
      service_engineers: serviceEngineers,
      devices:     deviceLines,
      status:      'draft',
    })
    .select('id')
    .single()

  if (repErr) return NextResponse.json({ error: repErr.message }, { status: 500 })

  // Advance the schedule
  const nextDue = new Date()
  nextDue.setDate(nextDue.getDate() + sched.interval_days)
  await supabaseAdmin.from('pm_schedules').update({
    last_run_at: new Date().toISOString(),
    next_due_at: nextDue.toISOString(),
  }).eq('id', id)

  // Notify the schedule's assigned engineer that a PM visit/report is ready.
  if (sched.assigned_to) {
    const uid = await engineerUserId(sched.assigned_to)
    if (uid) await pushToUser(uid, {
      title: 'PM Visit Due',
      body: 'A preventive-maintenance report has been generated for you to complete.',
      url: '/pm',
      tag: `pm-report-${report.id}`,
    })
  }

  return NextResponse.json({ reportId: report.id })
}
