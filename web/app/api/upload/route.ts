import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Image upload used by the mobile app. Mobile sends the picked image as base64 JSON
// (FormData and Blob uploads are both unreliable in React Native), and the server
// decodes and uploads with the service-role key — bypassing storage RLS.
const ALLOWED_BUCKETS = ['ticket-photos', 'hr-docs', 'attendance-photos', 'org-assets']

export async function POST(req: NextRequest) {
  let body: { bucket?: string; folder?: string; base64?: string; ext?: string; contentType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }

  const bucket = String(body.bucket ?? '')
  if (!ALLOWED_BUCKETS.includes(bucket)) return NextResponse.json({ error: 'Invalid bucket.' }, { status: 400 })
  if (!body.base64) return NextResponse.json({ error: 'No image data.' }, { status: 400 })

  const folder = String(body.folder ?? '').replace(/[^a-zA-Z0-9/_-]/g, '')
  const ext = (body.ext || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
  const contentType = body.contentType || `image/${ext === 'jpg' ? 'jpeg' : ext}`

  const buffer = Buffer.from(body.base64, 'base64')
  if (buffer.length === 0) return NextResponse.json({ error: 'Empty image.' }, { status: 400 })
  if (buffer.length > 12_000_000) return NextResponse.json({ error: 'Image too large.' }, { status: 400 })

  const path = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, path })
}
