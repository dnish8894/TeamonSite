import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('id').eq('email', user.email!).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  await supabaseAdmin.from('push_subscriptions').upsert({
    user_id: profile.id,
    endpoint,
    p256dh: keys.p256dh,
    auth:   keys.auth,
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (endpoint) {
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
  return NextResponse.json({ ok: true })
}
