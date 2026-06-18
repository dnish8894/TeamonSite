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

export default function ScheduleScreen() {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [entries,    setEntries]    = useState<StandbyEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myUserId,   setMyUserId]   = useState<string | null>(null)
  const [showMyOnly, setShowMyOnly] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    const lastDay = new Date(year, month, 0).getDate()
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    const { data } = await supabase
      .from('standby_schedule')
      .select('id,schedule_date,shift,notes,user_id,users(full_name,phone,role)')
      .gte('schedule_date', from)
      .lte('schedule_date', to)
      .order('schedule_date')
    setEntries(Array.isArray(data) ? (data as unknown as StandbyEntry[]) : [])
    setLoading(false); setRefreshing(false)
  }, [year, month])

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
          {days.map(iso => {
            const dayEntries = (byDate[iso] ?? []).filter(e =>
              showMyOnly ? e.user_id === myUserId : true
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
                  {dayEntries.length === 0 ? (
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
})
