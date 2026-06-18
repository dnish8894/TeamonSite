import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/reports/issues?from=2026-06-01&to=2026-06-30
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select(`
      id, ticket_no, title, type, priority, status,
      created_at, resolved_at, closed_at,
      sites ( id, name, city, state ),
      elv_systems ( id, name, type )
    `)
    .gte('created_at', from + 'T00:00:00Z')
    .lte('created_at', to   + 'T23:59:59Z')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
