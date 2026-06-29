import { supabaseAdmin } from '@/lib/supabase-admin'
import { pushToUser, type PushPayload } from '@/lib/push'
import { sendEmailSafe } from '@/lib/email'
import { teamRecipients, type Team } from '@/lib/teams'

type Channel = { push?: boolean; email?: boolean }
type Prefs = Partial<Record<Team, Channel>>

async function getPrefs(): Promise<Prefs> {
  const { data } = await supabaseAdmin
    .from('organisations').select('notification_prefs').limit(1).single()
  return (data?.notification_prefs ?? {}) as Prefs
}

/**
 * Notify the members of one or more notification teams, honouring the org's
 * notification_prefs toggles (Settings → Notifications). For each team, push/email
 * default to ON when no preference is stored. A user in several of the given teams
 * is notified once (deduped); they get push if ANY of those teams has push enabled,
 * and email if ANY has email enabled.
 */
export async function notifyTeams(teams: Team[], payload: PushPayload, email?: { subject: string; html: string }) {
  if (teams.length === 0) return
  const prefs = await getPrefs()

  const pushIds = new Set<string>()
  const emailTo = new Map<string, string>() // id -> email

  for (const team of teams) {
    const ch = prefs[team] ?? {}
    const pushOn  = ch.push  ?? true
    const emailOn = ch.email ?? true
    if (!pushOn && !emailOn) continue
    const recipients = await teamRecipients([team])
    for (const u of recipients) {
      if (pushOn) pushIds.add(u.id)
      if (emailOn) emailTo.set(u.id, u.email)
    }
  }

  await Promise.allSettled([...pushIds].map(id => pushToUser(id, payload)))
  if (email && emailTo.size > 0) {
    await sendEmailSafe({ to: [...emailTo.values()], subject: email.subject, html: email.html })
  }
}
