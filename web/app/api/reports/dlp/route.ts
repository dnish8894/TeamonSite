import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Sites with a DLP or Maintenance contract period, for tracking which are
// close to expiry (Defect Liability Period ending).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('id, name, city, state, contract_type, contract_start, contract_end, clients ( name )')
    .not('contract_type', 'is', null)
    .not('contract_end', 'is', null)
    .order('contract_end', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
