import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (file.size > 5_000_000) return NextResponse.json({ error: 'File must be under 5MB.' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `leave/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabaseAdmin.storage.from('hr-docs').upload(path, buffer, {
    contentType: file.type || 'application/octet-stream', upsert: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from('hr-docs').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
