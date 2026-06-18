import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import type { Ticket } from '@/lib/types'

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#ef4444', P2: '#f97316', P3: '#facc15', P4: '#60a5fa',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#ef4444', assigned: '#f97316', in_progress: '#facc15',
  pending_parts: '#a78bfa', pending_client: '#60a5fa',
  resolved: '#34d399', closed: '#6b7280', cancelled: '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In Progress',
  pending_parts: 'Pending Parts', pending_client: 'Pending Client',
  resolved: 'Resolved', closed: 'Closed', cancelled: 'Cancelled',
}
const TYPE_LABEL: Record<string, string> = {
  breakdown: 'Breakdown', preventive_maintenance: 'PM',
  installation: 'Install', inspection: 'Inspect', relocation: 'Relocation',
}

const FILTER_TABS = [
  { key: 'active',   label: 'Active'    },
  { key: 'all',      label: 'All'       },
  { key: 'resolved', label: 'Resolved'  },
]

export default function TicketsScreen() {
  const router = useRouter()
  const [tickets,    setTickets]    = useState<Ticket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter,     setFilter]     = useState('active')
  const [userId,     setUserId]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const loadTickets = useCallback(async () => {
    if (!userId) return
    let query = supabase
      .from('tickets')
      .select('id,ticket_no,title,type,priority,status,created_at,resolved_at,reporter_name,reporter_phone,sites(id,name,city),elv_systems(id,name,type)')
      .order('created_at', { ascending: false })
      .limit(100)

    // Filter by assigned engineer — look up engineer id from users id
    // For now fetch by assigned engineer matching auth user's engineer record
    if (filter === 'active') {
      query = query.in('status', ['open','assigned','in_progress','pending_parts','pending_client'])
    } else if (filter === 'resolved') {
      query = query.in('status', ['resolved','closed'])
    }

    const { data } = await query
    setTickets((data as unknown as Ticket[]) ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [userId, filter])

  useEffect(() => { if (userId) loadTickets() }, [userId, filter])

  function onRefresh() { setRefreshing(true); loadTickets() }

  const renderTicket = ({ item: t }: { item: Ticket }) => {
    const pc = PRIORITY_COLOR[t.priority] ?? '#6b7280'
    const sc = STATUS_COLOR[t.status]    ?? '#6b7280'
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => router.push(`/(app)/tickets/${t.id}`)}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <Text style={[styles.ticketNo, { color: '#f97316' }]}>{t.ticket_no}</Text>
          <View style={[styles.badge, { backgroundColor: pc + '20' }]}>
            <Text style={[styles.badgeText, { color: pc }]}>{t.priority}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{t.title}</Text>

        {/* Site */}
        {t.sites && (
          <Text style={styles.site}>📍 {t.sites.name}{t.sites.city ? ` · ${t.sites.city}` : ''}</Text>
        )}

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <View style={[styles.badge, { backgroundColor: sc + '20' }]}>
            <Text style={[styles.badgeText, { color: sc }]}>{STATUS_LABEL[t.status] ?? t.status}</Text>
          </View>
          <Text style={styles.typePill}>{TYPE_LABEL[t.type] ?? t.type}</Text>
          <Text style={styles.dateText}>
            {new Date(t.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short' })}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Tickets</Text>
          <Text style={styles.headerSub}>{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={styles.emptyTitle}>No tickets</Text>
          <Text style={styles.emptySub}>
            {filter === 'active' ? 'No active tickets assigned to you.' : 'No tickets found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f97316"
              colors={['#f97316']}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:   { color: '#6b7280', fontSize: 13, marginTop: 2 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524',
  },
  filterTabActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  filterText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },

  card: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#292524',
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },

  ticketNo: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title:    { color: '#e7e5e4', fontSize: 15, fontWeight: '600', lineHeight: 22 },
  site:     { color: '#6b7280', fontSize: 12, marginTop: 5 },
  dateText: { color: '#44403c', fontSize: 11, marginLeft: 'auto' },
  typePill: { color: '#78716c', fontSize: 11 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: '#e7e5e4', fontSize: 17, fontWeight: '700' },
  emptySub:   { color: '#6b7280', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
})
