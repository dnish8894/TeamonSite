import { supabaseAdmin } from './supabase-admin'

// Lazy-load webpush only when actually sending a notification
async function getWebpush() {
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  return webpush
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Send a push notification to all subscriptions for a given user_id */
export async function pushToUser(userId: string, payload: PushPayload) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, id')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const wp = await getWebpush()
  const dead: string[] = []
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired, clean it up
        if ((err as { statusCode?: number })?.statusCode === 410) dead.push(sub.id)
      }
    })
  )

  if (dead.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', dead)
  }
}

/** Resolve the users.id for an engineer (via engineers table) */
export async function engineerUserId(engineerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('engineers')
    .select('user_id')
    .eq('id', engineerId)
    .single()
  return data?.user_id ?? null
}
