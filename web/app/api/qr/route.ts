import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import QRCode from 'qrcode'

// Base URL for the scan links: prefer the explicit env, else derive from the
// incoming request (works on Vercel/any host without needing NEXT_PUBLIC_APP_URL).
function appBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env && !env.includes('localhost')) return env.replace(/\/$/, '')
  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https')
  return host ? `${proto}://${host}` : (env ?? 'http://localhost:3000')
}

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier')   // site | system | device
  const id   = req.nextUrl.searchParams.get('id')
  const siteId = req.nextUrl.searchParams.get('site_id')

  if (tier && id) {
    // Single QR code as data URL
    const url = `${appBaseUrl(req)}/scan/${tier}/${id}`
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    return NextResponse.json({ url, dataUrl })
  }

  if (siteId) {
    // All QR codes for a site (site + systems + devices)
    const [{ data: site }, { data: systems }] = await Promise.all([
      supabaseAdmin.from('sites').select('id, name, clients(name)').eq('id', siteId).single(),
      supabaseAdmin.from('elv_systems').select('id, name, type').eq('site_id', siteId),
    ])

    const sysIds = (systems ?? []).map((s: { id: string }) => s.id)
    const { data: devices } = sysIds.length > 0
      ? await supabaseAdmin.from('devices').select('id, name, tag_id, device_type, system_id').in('system_id', sysIds).eq('is_active', true)
      : { data: [] }

    const baseUrl = appBaseUrl(req)

    async function makeQR(tier: string, id: string, label: string, sublabel: string) {
      const url = `${baseUrl}/scan/${tier}/${id}`
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 })
      return { tier, id, label, sublabel, url, dataUrl }
    }

    const results = await Promise.all([
      makeQR('site', site!.id, site!.name, (site as unknown as { clients: { name: string } | null })?.clients?.name ?? ''),
      ...(systems ?? []).map((s: { id: string; name: string; type: string }) =>
        makeQR('system', s.id, s.name || s.type, s.type)
      ),
      ...(devices ?? []).map((d: { id: string; name: string; tag_id: string | null; device_type: string }) =>
        makeQR('device', d.id, d.name, d.tag_id ?? d.device_type)
      ),
    ])

    return NextResponse.json(results)
  }

  return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
}
