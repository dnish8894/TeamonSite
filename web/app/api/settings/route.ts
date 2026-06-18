import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('organisations')
    .select('*')
    .limit(1)
    .single()
  if (error || !data) return NextResponse.json({
    id: null, name: '', address: null, phone: null, email: null,
    timezone: 'Asia/Kuala_Lumpur', currency: 'MYR', logo_url: null
  })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
  if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('organisations')
    .update(body)
    .eq('id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
