import { supabaseAdmin } from '@/lib/supabase-admin'

export const TEAMS = ['procurement', 'sales', 'hr', 'hod', 'ceo', 'management'] as const
export type Team = typeof TEAMS[number]
export const TEAM_LABEL: Record<Team, string> = {
  procurement: 'Procurement', sales: 'Sales', hr: 'HR', hod: 'HOD', ceo: 'CEO', management: 'Management',
}

/** Members (id + email) of one or more notification teams, de-duplicated. */
export async function teamRecipients(teams: Team[]): Promise<{ id: string; email: string }[]> {
  if (teams.length === 0) return []
  const { data } = await supabaseAdmin
    .from('user_teams')
    .select('users:user_id ( id, email )')
    .in('team', teams)
  const map = new Map<string, { id: string; email: string }>()
  for (const row of data ?? []) {
    const u = row.users as unknown as { id: string; email: string } | null
    if (u?.id && u.email) map.set(u.id, { id: u.id, email: u.email })
  }
  return Array.from(map.values())
}

/** Replace a user's team membership with the given list. */
export async function setUserTeams(userId: string, teams: string[]) {
  const valid = teams.filter((t): t is Team => (TEAMS as readonly string[]).includes(t))
  await supabaseAdmin.from('user_teams').delete().eq('user_id', userId)
  if (valid.length > 0) {
    await supabaseAdmin.from('user_teams').insert(valid.map(team => ({ user_id: userId, team })))
  }
}
