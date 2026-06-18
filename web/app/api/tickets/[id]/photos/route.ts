import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET — return photos stored in job_reports for this ticket
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data } = await supabaseAdmin
    .from('job_reports')
    .select('photos')
    .eq('ticket_id', id)
    .single()
  return NextResponse.json(data?.photos ?? [])
}

// POST — upload a photo (multipart/form-data)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const form = await req.formData()
  const file = form.get('file') as File | null
  const label = (form.get('label') as string) ?? 'before' // 'before' | 'after'
  const caption = (form.get('caption') as string) ?? ''

  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${id}/${label}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('ticket-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage.from('ticket-photos').getPublicUrl(path)
  const url = urlData.publicUrl

  // Upsert job_report and append photo to array
  const { data: existing } = await supabaseAdmin
    .from('job_reports')
    .select('id, photos')
    .eq('ticket_id', id)
    .single()

  const newPhoto = { url, label, caption, taken_at: new Date().toISOString() }

  if (existing) {
    const photos = [...(existing.photos ?? []), newPhoto]
    await supabaseAdmin.from('job_reports').update({ photos }).eq('ticket_id', id)
  } else {
    // Get engineer from ticket
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('assigned_to, organisation_id')
      .eq('id', id)
      .single()

    await supabaseAdmin.from('job_reports').insert({
      ticket_id: id,
      engineer_id: ticket?.assigned_to ?? null,
      photos: [newPhoto],
    })
  }

  return NextResponse.json({ url, label, caption })
}

// DELETE — remove a photo by URL
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { url } = await req.json()

  const { data: existing } = await supabaseAdmin
    .from('job_reports')
    .select('id, photos')
    .eq('ticket_id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const photos = (existing.photos ?? []).filter((p: { url: string }) => p.url !== url)
  await supabaseAdmin.from('job_reports').update({ photos }).eq('ticket_id', id)

  // Extract storage path and delete from bucket
  const path = url.split('/ticket-photos/')[1]
  if (path) await supabaseAdmin.storage.from('ticket-photos').remove([path])

  return NextResponse.json({ ok: true })
}
