import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })

    const { data: org } = await supabaseAdmin.from('organisations').select('id').limit(1).single()
    if (!org) return NextResponse.json({ error: 'No organisation found.' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'Spreadsheet is empty.' }, { status: 400 })

    const inserted: string[] = []
    const skipped: string[] = []
    const errors: string[] = []

    for (const row of rows) {
      const name = String(row['Name'] ?? row['name'] ?? '').trim()
      if (!name) { skipped.push('(empty name row)'); continue }

      const record = {
        organisation_id: org.id,
        name,
        part_no:       String(row['Part No'] ?? row['part_no'] ?? '').trim() || null,
        brand:         String(row['Brand']   ?? row['brand']   ?? '').trim() || null,
        unit:          String(row['Unit']    ?? row['unit']    ?? 'pcs').trim() || 'pcs',
        unit_cost:     parseFloat(String(row['Unit Cost (RM)'] ?? row['unit_cost'] ?? '')) || null,
        stock_qty:     parseFloat(String(row['Stock Qty']      ?? row['stock_qty'] ?? '0')) || 0,
        min_stock_qty: parseFloat(String(row['Min Stock']      ?? row['min_stock_qty'] ?? '0')) || 0,
        location:      String(row['Location'] ?? row['location'] ?? '').trim() || null,
      }

      const { error } = await supabaseAdmin.from('parts').insert(record)
      if (error) {
        errors.push(`${name}: ${error.message}`)
      } else {
        inserted.push(name)
      }
    }

    return NextResponse.json({
      ok: true,
      inserted: inserted.length,
      skipped: skipped.length,
      errors,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
