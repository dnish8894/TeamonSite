import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('v_open_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!body.site_id) return NextResponse.json({ error: 'Site is required.' }, { status: 400 })

  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('tickets').insert({
    ...body,
    organisation_id: org.id,
    ticket_no: '',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
