import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clampStr } from '@/lib/validate'
import { notifyTeams } from '@/lib/notify'

const JOB_STATUSES = ['in_progress', 'pending_parts', 'pending_client', 'resolved']
const MAX_SIGNATURE_LEN = 2_000_000 // ~1.5MB decoded — generous for a signature PNG data URL
const MAX_PARTS = 50

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data } = await supabaseAdmin
    .from('job_reports')
    .select('*')
    .eq('ticket_id', id)
    .single()
  return NextResponse.json(data ?? null)
}

function clampSignature(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return null
  return value.length > MAX_SIGNATURE_LEN ? null : value
}

function clampParts(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_PARTS).map((p: Record<string, unknown>) => ({
    device:    clampStr(p?.device, 200) ?? '',
    qty:       clampStr(p?.qty, 10) ?? '1',
    model:     clampStr(p?.model, 200) ?? '',
    serial_no: clampStr(p?.serial_no, 100) ?? '',
    remarks:   clampStr(p?.remarks, 500) ?? '',
  }))
}

const MAX_CUSTOM_FIELDS = 50

function clampCustomValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, string> = {}
  let count = 0
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_CUSTOM_FIELDS) break
    if (typeof v !== 'string') continue
    out[k.slice(0, 100)] = v.startsWith('data:image/') ? (clampSignature(v) ?? '') : v.slice(0, 1000)
    count++
  }
  return out
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const payload = {
    findings:           clampStr(body.findings, 4000),
    root_cause:         clampStr(body.root_cause, 4000),
    work_done:          clampStr(body.work_done, 4000),
    recommendation:     clampStr(body.recommendation, 4000),
    labour_hrs:         typeof body.labour_hrs === 'number' ? body.labour_hrs : null,
    travel_hrs:         typeof body.travel_hrs === 'number' ? body.travel_hrs : null,
    onsite_time:        clampStr(body.onsite_time, 10),
    offsite_time:       clampStr(body.offsite_time, 10),
    job_status:         JOB_STATUSES.includes(body.job_status) ? body.job_status : 'in_progress',
    client_name:        clampStr(body.client_name, 120),
    client_date:        clampStr(body.client_date, 10),
    remarks:            clampStr(body.remarks, 2000),
    parts_used:         clampParts(body.parts_used),
    reported_by:        clampStr(body.reported_by, 120),
    reported_date:      clampStr(body.reported_date, 10),
    engineer_signature: clampSignature(body.engineer_signature),
    client_signature:   clampSignature(body.client_signature),
    custom_field_values: clampCustomValues(body.custom_field_values),
  }

  // Get engineer + contract context from ticket
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('assigned_to, ticket_no, sites ( name, contract_type, pm_classification ), devices ( under_contract )')
    .eq('id', id)
    .single()

  const { data: existing } = await supabaseAdmin
    .from('job_reports')
    .select('id, job_status')
    .eq('ticket_id', id)
    .single()

  if (existing) {
    const { error } = await supabaseAdmin
      .from('job_reports')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('ticket_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('job_reports')
      .insert({ ...payload, ticket_id: id, engineer_id: ticket?.assigned_to ?? null })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Conditional Sales / Purchasing alert ─────────────────────────────────
  // When parts are used on a CHARGEABLE job (non-comprehensive contract, or device
  // not under contract) and the job is being resolved, notify procurement + sales so
  // a quotation/invoice can follow.
  const site = ticket?.sites as unknown as { name: string; contract_type: string | null; pm_classification: string | null } | null
  const dev = ticket?.devices as unknown as { under_contract: boolean } | null
  const chargeable = (site?.contract_type === 'maintenance' && site?.pm_classification === 'non_comprehensive') || dev?.under_contract === false
  const newlyResolved = payload.job_status === 'resolved' && existing?.job_status !== 'resolved'

  if (chargeable && payload.parts_used.length > 0 && newlyResolved) {
    const refNo = ticket?.ticket_no ?? id
    const partsList = payload.parts_used.map(p => `${p.device}${p.model ? ` (${p.model})` : ''} ×${p.qty}`).join(', ')
    const html = `
      <p><strong>Chargeable parts used on ${refNo}</strong></p>
      <p><strong>Site:</strong> ${site?.name ?? '—'} (Non-Comprehensive)</p>
      <p><strong>Parts:</strong> ${partsList}</p>
      <p>A quotation / invoice may be required.</p>`

    await notifyTeams(['procurement'], {
      title: 'Chargeable Parts Used', body: `${refNo}: ${partsList.slice(0, 80)}`, url: '/tickets/' + id, tag: `chargeable-${id}`,
    }, { subject: `Chargeable Parts — ${refNo}`, html })

    await notifyTeams(['sales'], {
      title: 'Quotation May Be Needed', body: `${refNo}: ${partsList.slice(0, 80)}`, url: '/tickets/' + id, tag: `chargeable-sales-${id}`,
    }, { subject: `Quotation Needed — ${refNo}`, html })
  }

  return NextResponse.json({ ok: true })
}
