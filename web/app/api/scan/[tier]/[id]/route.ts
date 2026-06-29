import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tier: string; id: string }> }
) {
  const { tier, id } = await params

  const { data: org } = await supabaseAdmin.from('organisations').select('intake_questions').limit(1).single()
  const intakeQuestions = org?.intake_questions ?? {}

  if (tier === 'site') {
    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('id, name, address, city, state, site_contact, site_phone, clients(name), elv_systems(id, name, type)')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json(null, { status: 404 })

    return NextResponse.json({
      tier: 'site',
      label: data.name,
      sublabel: (data as unknown as { clients: { name: string } | null }).clients?.name ?? '',
      intake_questions: intakeQuestions,
      systems: (data as unknown as { elv_systems: { id: string; name: string; type: string }[] }).elv_systems ?? [],
      details: {
        site_id: data.id,
        address: [data.address, data.city, data.state].filter(Boolean).join(', ') || '—',
        contact: data.site_contact ?? '—',
        phone: data.site_phone ?? '—',
      },
    })
  }

  if (tier === 'system') {
    const { data, error } = await supabaseAdmin
      .from('elv_systems')
      .select('id, name, type, brand, model, location_desc, install_date, site_id, sites(name, client_id, clients(name))')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json(null, { status: 404 })

    const s = data as unknown as {
      id: string; name: string; type: string; brand: string | null; model: string | null;
      location_desc: string | null; install_date: string | null; site_id: string;
      sites: { name: string; clients: { name: string } | null } | null
    }

    return NextResponse.json({
      tier: 'system',
      label: s.name || s.type,
      sublabel: s.sites?.name ?? '',
      system_type: s.type,
      intake_questions: intakeQuestions,
      details: {
        site_id: s.site_id,
        client: s.sites?.clients?.name ?? '—',
        type: s.type.replace(/_/g, ' '),
        brand: s.brand ?? '—',
        model: s.model ?? '—',
        location: s.location_desc ?? '—',
        installed: s.install_date ?? '—',
      },
    })
  }

  if (tier === 'device') {
    const { data, error } = await supabaseAdmin
      .from('devices')
      .select('id, name, tag_id, device_type, brand, model, serial_no, ip_address, location_desc, floor, install_date, warranty_expiry, system_id, elv_systems(site_id, type, sites(id, name))')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json(null, { status: 404 })

    const d = data as unknown as {
      id: string; name: string; tag_id: string | null; device_type: string;
      brand: string | null; model: string | null; serial_no: string | null;
      ip_address: string | null; location_desc: string | null; floor: number | null;
      install_date: string | null; warranty_expiry: string | null;
      elv_systems: { site_id: string; type: string; sites: { id: string; name: string } | null } | null
    }

    return NextResponse.json({
      tier: 'device',
      label: d.name,
      sublabel: d.tag_id ?? d.device_type,
      system_type: d.elv_systems?.type ?? null,
      intake_questions: intakeQuestions,
      details: {
        site_id: d.elv_systems?.sites?.id ?? '',
        site: d.elv_systems?.sites?.name ?? '—',
        system: d.elv_systems?.type.replace(/_/g, ' ') ?? '—',
        type: d.device_type.replace(/_/g, ' '),
        brand: d.brand ?? '—',
        model: d.model ?? '—',
        serial: d.serial_no ?? '—',
        ip: d.ip_address ?? '—',
        floor: d.floor != null ? `Level ${d.floor}` : '—',
        location: d.location_desc ?? '—',
        installed: d.install_date ?? '—',
        warranty: d.warranty_expiry ?? '—',
      },
    })
  }

  return NextResponse.json(null, { status: 400 })
}
