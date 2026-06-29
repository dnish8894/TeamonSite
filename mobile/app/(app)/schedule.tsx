import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

interface StandbyEntry {
  id: string
  schedule_date: string
  shift: string
  notes: string | null
  user_id: string
  users: { full_name: string; phone: string | null; role: string }
}

interface AttendanceEntry {
  id: string
  check_in_at: string
  check_out_at: string | null
  engineer_id: string
  site_name: string | null
  engineers: { id: string; users: { full_name: string } | null } | null
  sites: { name: string } | null
}

interface TicketEntry {
  id: string
  ticket_no: string
  title: string
  status: string
  work_started_at: string | null
  work_completed_at: string | null
  assigned_to: string | null
  engineers: { id: string; users: { full_name: string } | null } | null
  sites: { name: string } | null
}

const SHIFT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  all_day:   { label: 'All Day',   color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  morning:   { label: 'Morning',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  afternoon: { label: 'Afternoon', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  night:     { label: 'Night',     color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

interface WeekEntry {
  id: string; week_start: string; notes: string | null; user_id: string
  users: { full_name: string; role: string; phone: string | null }
}
function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function weekLabel(weekStart: string): string {
  const s = new Date(weekStart + 'T00:00'); const e = new Date(weekStart + 'T00:00'); e.setDate(e.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
  return `${f(s)} – ${f(e)}`
}
function weeksOfMonth(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1); const last = new Date(year, month, 0)
  const out: string[] = []; let cur = mondayOf(first)
  while (new Date(cur + 'T00:00') <= last) {
    out.push(cur); const n = new Date(cur + 'T00:00'); n.setDate(n.getDate() + 7); cur = mondayOf(n)
  }
  return out
}

export default function ScheduleScreen() {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [entries,    setEntries]    = useState<StandbyEntry[]>([])
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([])
  const [ticketsDone, setTicketsDone] = useState<TicketEntry[]>([])
  const [weeklyStandby, setWeeklyStandby] = useState<WeekEntry[]>([])
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myUserId,   setMyUserId]   = useState<string | null>(null)
  const [myEngineerId, setMyEngineerId] = useState<string | null>(null)
  const [showMyOnly, setShowMyOnly] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setMyUserId(data.user?.id ?? null)
      if (data.user?.email) {
        const { data: profile } = await supabase.from('users').select('id').eq('email', data.user.email).single()
        if (profile?.id) {
          const { data: eng } = await supabase.from('engineers').select('id').eq('user_id', profile.id).single()
          setMyEngineerId(eng?.id ?? null)
        }
      }
    })
  }, [])

  const load = useCallback(async () => {
    const lastDay = new Date(year, month, 0).getDate()
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    const nextMonthStart = new Date(year, month, 1).toISOString()
    const monthStart = new Date(year, month - 1, 1).toISOString()

    const [{ data: standby }, { data: att }, { data: tix }] = await Promise.all([
      supabase
        .from('standby_schedule')
        .select('id,schedule_date,shift,notes,user_id,users(full_name,phone,role)')
        .gte('schedule_date', from)
        .lte('schedule_date', to)
        .order('schedule_date'),
      supabase
        .from('attendance_checkins')
        .select('id,check_in_at,check_out_at,engineer_id,site_name,engineers(id,users(full_name)),sites(name)')
        .gte('check_in_at', monthStart)
        .lt('check_in_at', nextMonthStart)
        .order('check_in_at'),
      supabase
        .from('tickets')
        .select('id,ticket_no,title,status,work_started_at,work_completed_at,assigned_to,engineers(id,users(full_name)),sites(name)')
        .not('work_started_at', 'is', null)
        .gte('work_started_at', monthStart)
        .lt('work_started_at', nextMonthStart)
        .order('work_started_at'),
    ])

    setEntries(Array.isArray(standby) ? (standby as unknown as StandbyEntry[]) : [])
    setAttendance(Array.isArray(att) ? (att as unknown as AttendanceEntry[]) : [])
    setTicketsDone(Array.isArray(tix) ? (tix as unknown as TicketEntry[]) : [])

    // Weekly standby roster (new model) via the API
    try {
      const wk = await fetch(`${apiUrl}/api/standby-weeks?year=${year}&month=${month}`).then(r => r.ok ? r.json() : [])
      setWeeklyStandby(Array.isArray(wk) ? wk : [])
    } catch { setWeeklyStandby([]) }

    setLoading(false); setRefreshing(false)
  }, [year, month, apiUrl])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const todayIso = today.toISOString().split('T')[0]

  // Group by date
  const byDate: Record<string, StandbyEntry[]> = {}
  entries.forEach(e => {
    if (!byDate[e.schedule_date]) byDate[e.schedule_date] = []
    byDate[e.schedule_date].push(e)
  })

  function isoOf(dateStr: string) { return new Date(dateStr).toISOString().split('T')[0] }

  const attByDate: Record<string, AttendanceEntry[]> = {}
  attendance.forEach(a => {
    const iso = isoOf(a.check_in_at)
    if (!attByDate[iso]) attByDate[iso] = []
    attByDate[iso].push(a)
  })

  const tixByDate: Record<string, TicketEntry[]> = {}
  ticketsDone.forEach(t => {
    if (!t.work_started_at) return
    const iso = isoOf(t.work_started_at)
    if (!tixByDate[iso]) tixByDate[iso] = []
    tixByDate[iso].push(t)
  })

  // Only show dates from today onwards for this month, or all if past month
  const totalDays = new Date(year, month, 0).getDate()
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = i + 1
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  })

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Standby Schedule</Text>
        <TouchableOpacity
          style={[styles.myToggle, showMyOnly && styles.myToggleActive]}
          onPress={() => setShowMyOnly(v => !v)}>
          <Text style={[styles.myToggleText, showMyOnly && styles.myToggleTextActive]}>
            {showMyOnly ? '👤 Mine' : '👥 All'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }}
              tintColor="#f97316" colors={['#f97316']} />
          }>
          {/* ── Standby (weekly) ── */}
          {(() => {
            const thisMon = mondayOf(today)
            const myWeeks = weeklyStandby.filter(w => w.user_id === myUserId)
            const weeks = weeksOfMonth(year, month)
            return (
              <>
                {/* My standby */}
                <View style={styles.sbCard}>
                  <Text style={styles.sbHeading}>🔔 My Standby Weeks</Text>
                  {myWeeks.length === 0 ? (
                    <Text style={styles.sbEmpty}>You are not on standby this month.</Text>
                  ) : myWeeks.map(w => (
                    <View key={w.id} style={styles.sbMyRow}>
                      <Text style={styles.sbMyWeek}>{weekLabel(w.week_start)}</Text>
                      {w.week_start === thisMon && <Text style={styles.sbNow}>This week</Text>}
                    </View>
                  ))}
                </View>

                {/* Team roster by week */}
                <Text style={styles.sbSection}>Team Standby Roster</Text>
                {weeks.map(ws => {
                  const list = weeklyStandby.filter(w => w.week_start === ws)
                    .filter(w => showMyOnly ? w.user_id === myUserId : true)
                  if (showMyOnly && list.length === 0) return null
                  const isNow = ws === thisMon
                  return (
                    <View key={ws} style={[styles.sbWeek, isNow && styles.sbWeekNow]}>
                      <View style={styles.sbWeekTop}>
                        <Text style={styles.sbWeekLabel}>{weekLabel(ws)}</Text>
                        {isNow && <Text style={styles.sbNow}>This week</Text>}
                      </View>
                      {list.length === 0 ? (
                        <Text style={styles.sbEmpty}>— No one assigned</Text>
                      ) : (
                        <View style={styles.sbChips}>
                          {list.map(w => (
                            <View key={w.id} style={styles.sbChip}>
                              <Text style={styles.sbChipText}>{w.users.full_name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )
                })}
                <Text style={styles.sbSection}>Daily Activity</Text>
              </>
            )
          })()}
          {days.map(iso => {
            const dayEntries = (byDate[iso] ?? []).filter(e =>
              showMyOnly ? e.user_id === myUserId : true
            )
            const dayAttendance = (attByDate[iso] ?? []).filter(a =>
              showMyOnly ? a.engineer_id === myEngineerId : true
            )
            const dayTickets = (tixByDate[iso] ?? []).filter(t =>
              showMyOnly ? t.assigned_to === myEngineerId : true
            )
            const dateObj  = new Date(iso + 'T00:00')
            const isToday  = iso === todayIso
            const dayNum   = dateObj.getDate()
            const weekday  = dateObj.toLocaleDateString('en-MY', { weekday: 'short' })
            const isWeekend = [0,6].includes(dateObj.getDay())

            return (
              <View key={iso} style={[styles.dayRow, isToday && styles.dayRowToday]}>
                {/* Date column */}
                <View style={styles.dateCol}>
                  <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                    <Text style={[styles.dayNum, isToday && { color: '#fff' }]}>{dayNum}</Text>
                  </View>
                  <Text style={[styles.weekday, isWeekend && { color: '#f97316' }]}>{weekday}</Text>
                </View>

                {/* Assignments */}
                <View style={styles.assignCol}>
                  {dayEntries.length === 0 && dayAttendance.length === 0 && dayTickets.length === 0 ? (
                    <Text style={styles.noAssign}>—</Text>
                  ) : (
                    dayEntries.map(e => {
                      const ss = SHIFT_STYLE[e.shift] ?? SHIFT_STYLE.all_day
                      return (
                        <View key={e.id} style={[styles.chip, { backgroundColor: ss.bg }]}>
                          <Text style={[styles.chipName, { color: ss.color }]}>
                            {e.users?.full_name ?? '—'}
                          </Text>
                          <Text style={[styles.chipShift, { color: ss.color, opacity: 0.8 }]}>
                            {ss.label}
                          </Text>
                          {e.users?.phone && (
                            <Text style={[styles.chipPhone, { color: ss.color, opacity: 0.7 }]}>
                              📞 {e.users.phone}
                            </Text>
                          )}
                          {e.notes && (
                            <Text style={[styles.chipNotes, { color: ss.color, opacity: 0.65 }]}>
                              {e.notes}
                            </Text>
                          )}
                        </View>
                      )
                    })
                  )}

                  {dayAttendance.map(a => (
                    <View key={a.id} style={styles.attChip}>
                      <Text style={styles.attChipText}>
                        📍 {a.engineers?.users?.full_name ?? '—'} · {a.sites?.name ?? a.site_name ?? '—'}
                      </Text>
                      <Text style={styles.attChipTime}>
                        {new Date(a.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {a.check_out_at ? new Date(a.check_out_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : 'Still in'}
                      </Text>
                    </View>
                  ))}

                  {dayTickets.map(t => (
                    <View key={t.id} style={styles.ticketChip}>
                      <Text style={styles.ticketChipText}>
                        🎫 {t.ticket_no} · {t.engineers?.users?.full_name ?? '—'}
                      </Text>
                      <Text style={styles.ticketChipTitle}>{t.title}</Text>
                      <Text style={styles.ticketChipMeta}>
                        {t.sites?.name ?? '—'} · {t.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#0c0a09' },
  scroll:{ paddingHorizontal: 16, paddingBottom: 40, gap: 2 },

  // Weekly standby
  sbCard: { backgroundColor: '#1c1917', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f97316', marginBottom: 12, marginTop: 4 },
  sbHeading: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  sbEmpty: { color: '#6b7280', fontSize: 13 },
  sbMyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  sbMyWeek: { color: '#f97316', fontSize: 14, fontWeight: '700' },
  sbNow: { color: '#34d399', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(52,211,153,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  sbSection: { color: '#a8a29e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  sbWeek: { backgroundColor: '#1c1917', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#292524', marginBottom: 8 },
  sbWeekNow: { borderColor: '#34d399' },
  sbWeekTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sbWeekLabel: { color: '#e7e5e4', fontSize: 14, fontWeight: '600' },
  sbChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sbChip: { backgroundColor: '#292524', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  sbChipText: { color: '#e7e5e4', fontSize: 12, fontWeight: '600' },
  center:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },

  myToggle: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524',
  },
  myToggleActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  myToggleText:   { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  myToggleTextActive: { color: '#fff' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 },
  navBtn:   { padding: 8 },
  navArrow: { color: '#f97316', fontSize: 26, fontWeight: '700' },
  monthLabel: { color: '#fff', fontSize: 17, fontWeight: '700', minWidth: 160, textAlign: 'center' },

  dayRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#1c1917',
  },
  dayRowToday: { backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: 12 },

  dateCol:      { width: 52, alignItems: 'center', marginRight: 10, paddingTop: 2 },
  dayCircle:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { backgroundColor: '#f97316' },
  dayNum:       { color: '#e7e5e4', fontSize: 15, fontWeight: '700' },
  weekday:      { color: '#44403c', fontSize: 10, fontWeight: '600', marginTop: 2 },

  assignCol: { flex: 1, gap: 6 },
  noAssign:  { color: '#292524', fontSize: 14, paddingTop: 6 },

  chip:      { borderRadius: 10, padding: 10 },
  chipName:  { fontSize: 14, fontWeight: '700' },
  chipShift: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  chipPhone: { fontSize: 12, marginTop: 4 },
  chipNotes: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },

  attChip: {
    borderRadius: 10, padding: 10,
    backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
  },
  attChipText: { color: '#34d399', fontSize: 13, fontWeight: '700' },
  attChipTime: { color: '#34d399', fontSize: 12, opacity: 0.8, marginTop: 2 },

  ticketChip: {
    borderRadius: 10, padding: 10,
    backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
  },
  ticketChipText:  { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  ticketChipTitle: { color: '#60a5fa', fontSize: 12, opacity: 0.9, marginTop: 2 },
  ticketChipMeta:  { color: '#60a5fa', fontSize: 11, opacity: 0.7, marginTop: 2, textTransform: 'capitalize' },
})
