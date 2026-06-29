import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

interface Equipment {
  id: string
  name: string
  category: string
  asset_tag: string | null
  serial_no: string | null
  condition: string
  location: string | null
}

const CAT_LABEL: Record<string, string> = { tool: 'Tool', instrument: 'Instrument', laptop: 'Laptop', ladder: 'Ladder', vehicle: 'Vehicle', other: 'Other' }

export default function EquipmentScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState<string | null>(null)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) { setLoading(false); return }
    const { data: profile } = await supabase.from('users').select('id').eq('email', email).single()
    if (!profile?.id) { setLoading(false); return }
    const { data } = await supabase.from('company_equipment')
      .select('id,name,category,asset_tag,serial_no,condition,location')
      .eq('assigned_to', profile.id)
      .eq('is_active', true)
      .order('name')
    setItems(Array.isArray(data) ? data as Equipment[] : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function returnItem(id: string) {
    setReturning(id)
    try {
      const res = await fetch(`${apiUrl}/api/equipment/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'return' }),
      })
      if (!res.ok) throw new Error()
      setItems(items.filter(i => i.id !== id))
    } catch {
      Alert.alert('Failed', 'Could not return the item. Try again.')
    }
    setReturning(null)
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>My Equipment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {items.length === 0 ? (
          <Text style={styles.empty}>No equipment is currently checked out to you.</Text>
        ) : items.map(e => (
          <View key={e.id} style={styles.card}>
            <Text style={styles.name}>{e.name}</Text>
            <Text style={styles.meta}>
              {CAT_LABEL[e.category] ?? e.category}{e.asset_tag ? ` · ${e.asset_tag}` : ''}{e.serial_no ? ` · ${e.serial_no}` : ''}
            </Text>
            {e.location ? <Text style={styles.meta}>📍 {e.location}</Text> : null}
            <TouchableOpacity style={[styles.returnBtn, returning === e.id && { opacity: 0.6 }]} onPress={() => returnItem(e.id)} disabled={returning === e.id}>
              {returning === e.id ? <ActivityIndicator color="#34d399" /> : <Text style={styles.returnText}>↩ Return</Text>}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  bg: { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#292524' },
  backBtn: { marginRight: 12 },
  backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 12 },
  empty: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: '#1c1917', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#292524', marginBottom: 10 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#a8a29e', fontSize: 13, marginTop: 3 },
  returnBtn: {
    marginTop: 12, borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  returnText: { color: '#34d399', fontSize: 14, fontWeight: '700' },
})
