import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Adjust stock quantity — add or remove
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { qty, type, note } = await req.json()
  // type: 'add' | 'remove' | 'set'

  const { data: part, error: fetchErr } = await supabaseAdmin
    .from('parts')
    .select('stock_qty, name')
    .eq('id', id)
    .single()

  if (fetchErr || !part) return NextResponse.json({ error: 'Part not found.' }, { status: 404 })

  let newQty: number
  if (type === 'set')    newQty = parseFloat(qty)
  else if (type === 'add')    newQty = Number(part.stock_qty) + parseFloat(qty)
  else                        newQty = Math.max(0, Number(part.stock_qty) - parseFloat(qty))

  const { error } = await supabaseAdmin
    .from('parts')
    .update({ stock_qty: newQty })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, newQty, previous: part.stock_qty })
}
