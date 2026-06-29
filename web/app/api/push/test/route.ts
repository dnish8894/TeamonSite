import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentUser } from '@/lib/auth'
import { pushToUser } from '@/lib/push'

// Sends a test push to the currently logged-in user's own devices.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const [{ count: webCount }, { count: expoCount }] = await Promise.all([
    supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabaseAdmin.from('expo_push_tokens').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])
  const total = (webCount ?? 0) + (expoCount ?? 0)
  if (total === 0) {
    return NextResponse.json({ error: 'No registered devices. Click "Enable Notifications" in the sidebar (web) or open the mobile app first.' }, { status: 400 })
  }

  await pushToUser(user.id, {
    title: 'TeamOnSite — Test Notification',
    body: '✅ Push notifications are working.',
    url: '/',
    tag: 'test-push',
  })
  return NextResponse.json({ ok: true, devices: total, web: webCount ?? 0, mobile: expoCount ?? 0 })
}
