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

/** Send a push notification to all web-push subscriptions for a given user_id */
async function pushToUserWeb(userId: string, payload: PushPayload) {
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

/** Send a push notification to all Expo (mobile app) tokens for a given user_id */
async function pushToUserExpo(userId: string, payload: PushPayload) {
  const { data: tokens } = await supabaseAdmin
    .from('expo_push_tokens')
    .select('token, id')
    .eq('user_id', userId)

  if (!tokens || tokens.length === 0) return

  const messages = tokens.map(t => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: { url: payload.url, tag: payload.tag },
  }))

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
    const json = await res.json()
    const dead: string[] = []
    const tickets = Array.isArray(json?.data) ? json.data : []
    tickets.forEach((t: { status: string; details?: { error?: string } }, i: number) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
        dead.push(tokens[i].id)
      }
    })
    if (dead.length > 0) {
      await supabaseAdmin.from('expo_push_tokens').delete().in('id', dead)
    }
  } catch {
    // Expo push service unreachable — ignore, will retry on next event
  }
}

/** Send a push notification to all subscriptions (web + mobile) for a given user_id */
export async function pushToUser(userId: string, payload: PushPayload) {
  await Promise.allSettled([
    pushToUserWeb(userId, payload),
    pushToUserExpo(userId, payload),
  ])
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

/** Send a push notification to every engineer who is a member of any of the given groups */
export async function pushToGroups(groupIds: string[], payload: PushPayload) {
  if (groupIds.length === 0) return
  const { data: members } = await supabaseAdmin
    .from('engineer_group_members')
    .select('engineers ( user_id )')
    .in('group_id', groupIds)

  const userIds = new Set<string>()
  for (const m of members ?? []) {
    const uid = (m.engineers as unknown as { user_id: string } | null)?.user_id
    if (uid) userIds.add(uid)
  }

  await Promise.allSettled([...userIds].map(uid => pushToUser(uid, payload)))
}
