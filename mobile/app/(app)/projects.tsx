import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

interface Project {
  id: string
  project_no: string
  name: string
  status: string
  value: number | null
  start_date: string | null
  end_date: string | null
  clients: { name: string } | null
  sites: { name: string } | null
}

export const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  planning:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  label: 'Planning'      },
  survey:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'Site Survey'   },
  installation: { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  label: 'Installation'  },
  testing:      { color: '#facc15', bg: 'rgba(250,204,21,0.15)',  label: 'Testing / UAT' },
  handover:     { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  label: 'Handover'      },
  completed:    { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  label: 'Completed'     },
  on_hold:      { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'On Hold'       },
}

export default function ProjectsScreen() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL
    try {
      const res = await fetch(`${apiUrl}/api/projects`)
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setProjects([])
    }
    setLoading(false); setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <View style={styles.bg}>
      <ActivityIndicator color="#f97316" size="large" />
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Projects</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/(app)/projects/new')}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }}
            tintColor="#f97316" colors={['#f97316']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No projects assigned to you yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.planning
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/(app)/projects/[id]', params: { id: item.id } })}>
              <View style={styles.cardTop}>
                <Text style={styles.projectNo}>{item.project_no}</Text>
                <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusChipText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.projectMeta}>
                {item.clients?.name ?? '—'}{item.sites?.name ? ` · ${item.sites.name}` : ''}
              </Text>
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  bg:   { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, marginBottom: 12,
  },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800' },
  newBtn: { backgroundColor: '#f97316', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },

  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 13 },

  card: {
    backgroundColor: '#1c1917', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#292524',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  projectNo: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  projectName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  projectMeta: { color: '#a8a29e', fontSize: 13, marginTop: 3 },
})
