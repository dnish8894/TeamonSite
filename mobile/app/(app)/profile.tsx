import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'

const ROLE_COLOR: Record<string, string> = {
  admin: '#f97316', manager: '#60a5fa', engineer: '#34d399', client: '#a78bfa',
}

export default function ProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState({ total: 0, open: 0, resolved: 0 })

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('users')
      .select('id,full_name,email,role,phone,avatar_url')
      .eq('email', user.email!)
      .single()
    setProfile(data as UserProfile)

    // Ticket stats (all tickets visible to this user)
    const { count: total } = await supabase.from('tickets').select('id', { count: 'exact', head: true })
    const { count: open }  = await supabase.from('tickets').select('id', { count: 'exact', head: true })
      .in('status', ['open','assigned','in_progress','pending_parts','pending_client'])
    const { count: resolved } = await supabase.from('tickets').select('id', { count: 'exact', head: true })
      .in('status', ['resolved','closed'])
    setStats({ total: total ?? 0, open: open ?? 0, resolved: resolved ?? 0 })
    setLoading(false)
  }

  async function doSignOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  function handleLogout() {
    // Alert.alert has no effect on web — fall back to window.confirm there.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to sign out?')) {
        doSignOut()
      }
      return
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
    ])
  }

  if (loading) return (
    <View style={styles.bg}>
      <ActivityIndicator color="#f97316" size="large" />
    </View>
  )

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
    : '?'
  const rc = ROLE_COLOR[profile?.role ?? 'engineer']

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: rc + '30' }]}>
            <Text style={[styles.avatarText, { color: rc }]}>{initials}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: rc + '20' }]}>
            <Text style={[styles.roleText, { color: rc }]}>
              {(profile?.role ?? '').charAt(0).toUpperCase() + (profile?.role ?? '').slice(1)}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: '#f97316' },
            { label: 'Open',  value: stats.open,  color: '#ef4444' },
            { label: 'Done',  value: stats.resolved, color: '#34d399' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          {[
            { label: 'Email',  value: profile?.email   ?? '—' },
            { label: 'Phone',  value: profile?.phone   ?? '—' },
            { label: 'Role',   value: profile?.role    ?? '—' },
          ].map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Leave */}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => router.push('/(app)/leave')} activeOpacity={0.8}>
          <Text style={styles.leaveText}>📅  My Leave</Text>
          <Text style={styles.leaveChevron}>›</Text>
        </TouchableOpacity>

        {/* Claims */}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => router.push('/(app)/claims')} activeOpacity={0.8}>
          <Text style={styles.leaveText}>🧾  My Claims</Text>
          <Text style={styles.leaveChevron}>›</Text>
        </TouchableOpacity>

        {/* Equipment */}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => router.push('/(app)/equipment')} activeOpacity={0.8}>
          <Text style={styles.leaveText}>🧰  My Equipment</Text>
          <Text style={styles.leaveChevron}>›</Text>
        </TouchableOpacity>

        {/* Equipment bookings */}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => router.push('/(app)/bookings')} activeOpacity={0.8}>
          <Text style={styles.leaveText}>📆  Equipment Bookings</Text>
          <Text style={styles.leaveChevron}>›</Text>
        </TouchableOpacity>

        {/* App info */}
        <View style={styles.infoCard}>
          {[
            { label: 'App',     value: 'TeamOnSite v1.0' },
            { label: 'Company', value: 'InfiniteQL Sdn Bhd' },
          ].map(row => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0c0a09' },
  bg:     { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar:        { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:    { fontSize: 28, fontWeight: '800' },
  name:          { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  roleBadge:     { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleText:      { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#1c1917', borderRadius: 14,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#292524',
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#6b7280', fontSize: 12, marginTop: 4 },

  infoCard: {
    backgroundColor: '#1c1917', borderRadius: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#292524', overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  infoLabel: { color: '#6b7280', fontSize: 13 },
  infoValue: { color: '#e7e5e4', fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1c1917', borderRadius: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#292524', paddingHorizontal: 16, paddingVertical: 15,
  },
  leaveText: { color: '#e7e5e4', fontSize: 15, fontWeight: '600' },
  leaveChevron: { color: '#6b7280', fontSize: 20 },

  logoutBtn: {
    marginTop: 8, backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
})
