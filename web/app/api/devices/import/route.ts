import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DEVICE_TYPES = ['camera','nvr','dvr','door_reader','door_controller','door_lock','network_switch','patch_panel','cable_port','access_point','server','other']
const SYS_CODE: Record<string, string> = { cctv: 'CCTV', access_control: 'ACS', structured_cabling: 'SC', av: 'AV', pa: 'PA', bms: 'BMS' }

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function bool(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === 'y' || s === '1'
}
function toDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const systemId: string = body.system_id
  const rows: Record<string, unknown>[] = Array.isArray(body.devices) ? body.devices : []
  if (!systemId) return NextResponse.json({ error: 'System is required.' }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ error: 'No rows found in the file.' }, { status: 400 })

  // Resolve system once (for tag auto-gen)
  const { data: sys } = await supabaseAdmin
    .from('elv_systems').select('type, type_label, sites ( name )').eq('id', systemId).single()
  if (!sys) return NextResponse.json({ error: 'System not found.' }, { status: 404 })
  const siteName = (sys.sites as unknown as { name: string } | null)?.name ?? ''
  const siteCode = siteName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'STE'
  const sysSource = sys.type === 'other' ? (sys.type_label || 'OTH') : (sys.type || 'SYS')
  const sysCode  = SYS_CODE[sys.type] ?? sysSource.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()

  const errors: string[] = []
  const inserts: Record<string, unknown>[] = []

  rows.forEach((r, i) => {
    const line = i + 2 // header is row 1
    const name = str(r['Name'] ?? r['name'])
    let type = str(r['Device Type'] ?? r['device_type'])?.toLowerCase().replace(/\s+/g, '_') ?? null
    if (!name) { errors.push(`Row ${line}: Name is required.`); return }
    if (!type) { errors.push(`Row ${line}: Device Type is required.`); return }
    if (!DEVICE_TYPES.includes(type)) { errors.push(`Row ${line}: invalid Device Type "${type}".`); type = 'other' }

    let tag = str(r['Tag ID'] ?? r['tag_id'])
    if (!tag) {
      const devCode = (type ?? 'OTH').toUpperCase().slice(0, 3)
      tag = `${siteCode}-${sysCode}-${devCode}-${Math.floor(Math.random() * 9000) + 1000}`
    }

    inserts.push({
      system_id: systemId,
      device_type: type,
      name,
      tag_id: tag,
      brand:        str(r['Brand'] ?? r['brand']),
      model:        str(r['Model'] ?? r['model']),
      serial_no:    str(r['Serial No'] ?? r['serial_no']),
      ip_address:   str(r['IP Address'] ?? r['ip_address']),
      mac_address:  str(r['MAC Address'] ?? r['mac_address']),
      location_desc: str(r['Location'] ?? r['location_desc']),
      floor:        str(r['Floor'] ?? r['floor']) ? parseInt(String(r['Floor'] ?? r['floor']), 10) || null : null,
      install_date: toDate(r['Install Date'] ?? r['install_date']),
      vendor_warranty_start: toDate(r['Vendor Warranty Start']),
      vendor_warranty_end:   toDate(r['Vendor Warranty End']),
      work_at_height:  bool(r['Work At Height']),
      under_contract:  bool(r['Under Contract']),
    })
  })

  if (inserts.length === 0) {
    return NextResponse.json({ error: 'No valid rows.', errors }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('devices').insert(inserts)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, imported: inserts.length, skipped: errors.length, errors })
}
