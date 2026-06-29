import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import { supabase } from '@/lib/supabase'

const SYS_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control',
  structured_cabling: 'Structured Cabling', av: 'AV', pa: 'PA', bms: 'BMS',
}

interface PMReportLite { id: string; visit_date: string; status: string; created_at: string }
interface Schedule {
  id: string; name: string; next_due_at: string | null; is_active: boolean
  sites: { name: string; clients: { name: string } | null } | null
  elv_systems: { name: string; type: string } | null
  engineers: { id: string } | null
  pm_schedule_devices: { device_id: string }[] | null
  pm_reports: PMReportLite[] | null
}

function daysUntil(d: string | null): number | null {
  if (!d) return null
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000)
}
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ServicingScreen() {
  const router = useRouter()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [genId, setGenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      // Resolve my engineer id so we can show schedules assigned to me first.
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      let myEngId: string | null = null
      if (email) {
        const engRes = await fetch(`${apiUrl}/api/engineers`)
        const engs = engRes.ok ? await engRes.json() : []
        const mine = Array.isArray(engs)
          ? engs.find((e: { users?: { email?: string } }) => e.users?.email === email)
          : null
        myEngId = mine?.id ?? null
      }

      const res = await fetch(`${apiUrl}/api/pm`)
      const all: Schedule[] = res.ok ? await res.json() : []
      const active = (Array.isArray(all) ? all : []).filter(s => s.is_active)
      // Mine first (if resolvable), then the rest.
      const mineList = myEngId ? active.filter(s => s.engineers?.id === myEngId) : []
      const others   = myEngId ? active.filter(s => s.engineers?.id !== myEngId) : active
      setSchedules([...mineList, ...others])
    } catch {
      setSchedules([])
    }
    setLoading(false)
  }, [apiUrl])

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => { load() }, [load])

  async function generate(schedId: string) {
    setGenId(schedId)
    try {
      const res = await fetch(`${apiUrl}/api/pm/${schedId}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not generate report')
      // Cast: typed-routes regenerate via Metro on next run; new route isn't in the stale stub yet.
      router.push(`/(app)/servicing/${json.reportId}` as Href)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate report.')
    }
    setGenId(null)
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PM Servicing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {schedules.length === 0 ? (
          <Text style={styles.empty}>No PM schedules.</Text>
        ) : schedules.map(s => {
          const days = daysUntil(s.next_due_at)
          const overdue = days !== null && days < 0
          const dueSoon = days !== null && days >= 0 && days <= 14
          const color = overdue ? '#ef4444' : dueSoon ? '#facc15' : '#34d399'
          const reports = [...(s.pm_reports ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
          const devCount = s.pm_schedule_devices?.length ?? 0
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{s.name}</Text>
                <View style={[styles.pill, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.pillText, { color }]}>
                    {overdue ? `Overdue ${Math.abs(days!)}d` : days !== null ? `Due ${days}d` : 'No date'}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>📍 {s.sites?.name}{s.sites?.clients ? ` · ${s.sites.clients.name}` : ''}</Text>
              <Text style={styles.meta}>
                {s.elv_systems ? `🔧 ${SYS_LABELS[s.elv_systems.type] ?? s.elv_systems.type}` : '🔧 All systems'}
                {devCount > 0 ? `  ·  🖥 ${devCount} device${devCount !== 1 ? 's' : ''}` : ''}
              </Text>
              <Text style={styles.metaDim}>Next due: {fmt(s.next_due_at)}</Text>

              <TouchableOpacity style={[styles.genBtn, genId === s.id && { opacity: 0.6 }]}
                disabled={genId === s.id} onPress={() => generate(s.id)}>
                {genId === s.id
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.genBtnText}>+ Generate PM Report</Text>}
              </TouchableOpacity>

              {reports.length > 0 && (
                <View style={styles.reportsBox}>
                  {reports.map(r => (
                    <TouchableOpacity key={r.id} style={styles.reportRow}
                      onPress={() => router.push(`/(app)/servicing/${r.id}` as Href)}>
                      <Text style={styles.reportDate}>📄 {fmt(r.visit_date)}</Text>
                      <Text style={[styles.reportStatus, { color: r.status === 'completed' ? '#34d399' : '#facc15' }]}>
                        {r.status === 'completed' ? 'Completed' : 'Draft'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  bg: { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#292524' },
  backBtn: { marginRight: 12 }, backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 12 },
  empty: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#1c1917', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#292524', marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: '700' },
  meta: { color: '#a8a29e', fontSize: 13, marginTop: 4 },
  metaDim: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  genBtn: { marginTop: 12, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  genBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reportsBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#292524', paddingTop: 8 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  reportDate: { color: '#e7e5e4', fontSize: 13 },
  reportStatus: { fontSize: 12, fontWeight: '600' },
})
