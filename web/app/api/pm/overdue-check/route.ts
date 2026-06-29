import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pushToUser, engineerUserId } from '@/lib/push'
import { notifyTeams } from '@/lib/notify'

// Daily overdue-PM reminder. Intended to be called by a scheduled job
// (e.g. a Vercel Cron). Protect with CRON_SECRET: the caller must send
//   Authorization: Bearer <CRON_SECRET>   or   ?key=<CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key  = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const nowIso = new Date().toISOString()
  const { data: overdue } = await supabaseAdmin
    .from('pm_schedules')
    .select('id, name, assigned_to, next_due_at, sites ( name )')
    .eq('is_active', true)
    .lt('next_due_at', nowIso)
    .order('next_due_at')

  const list = overdue ?? []
  if (list.length === 0) return NextResponse.json({ overdue: 0, notified_engineers: 0 })

  // Notify each schedule's assigned engineer.
  let engNotified = 0
  for (const s of list) {
    if (!s.assigned_to) continue
    const uid = await engineerUserId(s.assigned_to as string)
    if (!uid) continue
    const siteName = (s.sites as unknown as { name: string } | null)?.name ?? ''
    await pushToUser(uid, {
      title: 'PM Overdue',
      body: `${s.name}${siteName ? ` · ${siteName}` : ''} is past its due date.`,
      url: '/pm',
      tag: `pm-overdue-${s.id}`,
    })
    engNotified++
  }

  // One digest to Management.
  const lines = list.slice(0, 20).map(s => {
    const siteName = (s.sites as unknown as { name: string } | null)?.name ?? ''
    const due = s.next_due_at ? new Date(s.next_due_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    return `<li>${s.name}${siteName ? ` · ${siteName}` : ''} — due ${due}</li>`
  }).join('')
  await notifyTeams(['management'], {
    title: 'Overdue PM Schedules',
    body: `${list.length} preventive-maintenance schedule(s) overdue.`,
    url: '/pm',
    tag: 'pm-overdue-digest',
  }, {
    subject: `${list.length} Overdue PM Schedule(s)`,
    html: `<p><strong>${list.length}</strong> preventive-maintenance schedule(s) are overdue:</p><ul>${lines}</ul>`,
  })

  return NextResponse.json({ overdue: list.length, notified_engineers: engNotified })
}
