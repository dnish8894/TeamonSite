import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  // Get engineer from ticket
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('assigned_to')
    .eq('id', id)
    .single()

  const { data: existing } = await supabaseAdmin
    .from('job_reports')
    .select('id')
    .eq('ticket_id', id)
    .single()

  if (existing) {
    const { error } = await supabaseAdmin
      .from('job_reports')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('ticket_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('job_reports')
      .insert({ ...body, ticket_id: id, engineer_id: ticket?.assigned_to ?? null })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
