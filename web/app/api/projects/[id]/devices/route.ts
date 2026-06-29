import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET → { linked: [...], available: [...] }
// linked   = devices currently tagged to this project
// available = devices at the project's site not yet tied to ANY project
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: project } = await supabaseAdmin.from('projects').select('site_id').eq('id', id).single()

  const { data: linked } = await supabaseAdmin
    .from('devices')
    .select('id, name, tag_id, device_type, elv_systems ( name, type )')
    .eq('project_id', id)
    .order('name')

  let available: unknown[] = []
  if (project?.site_id) {
    // Devices under this site's systems that aren't linked to any project yet
    const { data: systems } = await supabaseAdmin.from('elv_systems').select('id').eq('site_id', project.site_id)
    const sysIds = (systems ?? []).map((s: { id: string }) => s.id)
    if (sysIds.length > 0) {
      const { data: avail } = await supabaseAdmin
        .from('devices')
        .select('id, name, tag_id, device_type, elv_systems ( name, type )')
        .in('system_id', sysIds)
        .is('project_id', null)
        .eq('is_active', true)
        .order('name')
      available = avail ?? []
    }
  }

  return NextResponse.json({ linked: linked ?? [], available })
}

// PUT { device_ids } → set the project's device list (links new ones, unlinks removed ones)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const ids: string[] = Array.isArray(body.device_ids) ? body.device_ids.filter((x: unknown) => typeof x === 'string') : []

  // Unlink devices previously on this project but no longer selected
  const { data: current } = await supabaseAdmin.from('devices').select('id').eq('project_id', id)
  const currentIds = (current ?? []).map((d: { id: string }) => d.id)
  const toUnlink = currentIds.filter(cid => !ids.includes(cid))
  if (toUnlink.length > 0) {
    await supabaseAdmin.from('devices').update({ project_id: null }).in('id', toUnlink)
  }
  if (ids.length > 0) {
    await supabaseAdmin.from('devices').update({ project_id: id }).in('id', ids)
  }
  return NextResponse.json({ ok: true })
}
