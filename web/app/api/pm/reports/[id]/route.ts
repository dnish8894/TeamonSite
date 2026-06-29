import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'
import { notifyTeams } from '@/lib/notify'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('pm_reports')
    .select(`
      id, schedule_id, visit_date, summary, status, devices, service_engineers,
      started_at, completed_at, engineer_id,
      engineer_name, engineer_date, engineer_signature,
      client_name, client_date, client_signature,
      sites ( name, address, clients ( name ) ),
      elv_systems ( name, type ),
      engineers ( id, users ( full_name ) ),
      pm_schedules ( name, next_due_at, interval_days )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.visit_date)            update.visit_date  = body.visit_date
  if (body.summary !== undefined) update.summary     = clampStr(body.summary, 4000)
  if (body.engineer_id !== undefined) update.engineer_id = body.engineer_id || null
  if (body.started_at !== undefined)  update.started_at  = body.started_at || null
  if (body.engineer_name !== undefined)      update.engineer_name      = clampStr(body.engineer_name, 120)
  if (body.engineer_date !== undefined)      update.engineer_date      = body.engineer_date || null
  if (body.engineer_signature !== undefined) update.engineer_signature = body.engineer_signature || null
  if (body.client_name !== undefined)        update.client_name        = clampStr(body.client_name, 120)
  if (body.client_date !== undefined)        update.client_date        = body.client_date || null
  if (body.client_signature !== undefined)   update.client_signature   = body.client_signature || null

  // Sanitise device lines
  if (Array.isArray(body.devices)) {
    update.devices = body.devices.map((d: Record<string, unknown>) => {
      const rawChecks = (d.checks && typeof d.checks === 'object') ? d.checks as Record<string, unknown> : {}
      const checks: Record<string, boolean> = {}
      for (const k of Object.keys(rawChecks)) checks[k] = !!rawChecks[k]
      return {
        device_id: d.device_id,
        name:      d.name ?? null,
        tag_id:    d.tag_id ?? null,
        checks,
        notes:     clampStr((d.notes as string) ?? '', 1000),
      }
    })
  }

  // Servicing engineers [{ id, name }]
  if (Array.isArray(body.service_engineers)) {
    update.service_engineers = body.service_engineers
      .filter((e: Record<string, unknown>) => e && e.id)
      .map((e: Record<string, unknown>) => ({ id: e.id, name: clampStr((e.name as string) ?? '', 120) }))
  }

  // Detect a fresh draft → completed transition so we only notify once.
  let newlyCompleted = false
  if (body.status === 'completed' || body.status === 'draft') {
    update.status = body.status
    update.completed_at = body.status === 'completed' ? new Date().toISOString() : null
    if (body.status === 'completed') {
      const { data: prev } = await supabaseAdmin.from('pm_reports').select('status').eq('id', id).single()
      newlyCompleted = prev?.status !== 'completed'
    }
  }

  const { error } = await supabaseAdmin.from('pm_reports').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify Management that a PM visit is recorded as complete.
  if (newlyCompleted) {
    const { data: r } = await supabaseAdmin
      .from('pm_reports')
      .select('visit_date, pm_schedules ( name ), sites ( name )')
      .eq('id', id).single()
    const schedName = (r?.pm_schedules as unknown as { name: string } | null)?.name ?? 'PM schedule'
    const siteName  = (r?.sites as unknown as { name: string } | null)?.name ?? ''
    await notifyTeams(['management'], {
      title: 'PM Report Completed',
      body: `${schedName}${siteName ? ` · ${siteName}` : ''}`,
      url: '/pm',
      tag: `pm-completed-${id}`,
    }, {
      subject: `PM Report Completed — ${schedName}`,
      html: `<p>A preventive-maintenance report has been marked <strong>completed</strong>.</p>
             <p><strong>Schedule:</strong> ${schedName}</p>
             ${siteName ? `<p><strong>Site:</strong> ${siteName}</p>` : ''}`,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('pm_reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
