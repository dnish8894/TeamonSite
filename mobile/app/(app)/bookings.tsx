import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import SelectField, { SelectOption } from '@/components/SelectField'
import DatePickerField from '@/components/DatePickerField'

interface Booking {
  id: string
  from_date: string
  to_date: string
  purpose: string | null
  company_equipment: { name: string; asset_tag: string | null } | null
}

export default function BookingsScreen() {
  const router = useRouter()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
  const [userId, setUserId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [equipment, setEquipment] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const [equipmentId, setEquipmentId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) { setLoading(false); return }
    const { data: profile } = await supabase.from('users').select('id').eq('email', email).single()
    if (!profile?.id) { setLoading(false); return }
    setUserId(profile.id)

    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('equipment_bookings')
      .select('id,from_date,to_date,purpose,company_equipment:equipment_id(name,asset_tag)')
      .eq('user_id', profile.id).eq('status', 'booked').gte('to_date', today)
      .order('from_date')
    setBookings(Array.isArray(data) ? data as unknown as Booking[] : [])

    const { data: eq } = await supabase.from('company_equipment')
      .select('id,name,asset_tag').eq('is_active', true).neq('status', 'retired').order('name')
    setEquipment((eq ?? []).map(e => ({ id: e.id, label: e.name + (e.asset_tag ? ` (${e.asset_tag})` : '') })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!equipmentId) return Alert.alert('Missing Info', 'Please select equipment.')
    if (!fromDate || !toDate) return Alert.alert('Missing Info', 'Please choose start and end dates.')
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/api/equipment/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_id: equipmentId, from_date: fromDate, to_date: toDate, purpose: purpose.trim() || null, user_id: userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Booking failed')
      setShowNew(false); setEquipmentId(''); setFromDate(''); setToDate(''); setPurpose('')
      load()
    } catch (e) {
      Alert.alert('Booking Failed', e instanceof Error ? e.message : 'Could not create booking.')
    }
    setSaving(false)
  }

  async function cancel(id: string) {
    await supabase.from('equipment_bookings').update({ status: 'cancelled' }).eq('id', id)
    setBookings(bookings.filter(b => b.id !== id))
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Equipment Bookings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowNew(true)}>
          <Text style={styles.newBtnText}>+ New Booking</Text>
        </TouchableOpacity>

        {bookings.length === 0 ? (
          <Text style={styles.empty}>No upcoming bookings.</Text>
        ) : bookings.map(b => (
          <View key={b.id} style={styles.card}>
            <Text style={styles.name}>{b.company_equipment?.name}{b.company_equipment?.asset_tag ? ` · ${b.company_equipment.asset_tag}` : ''}</Text>
            <Text style={styles.meta}>
              {new Date(b.from_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
              {' → '}
              {new Date(b.to_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            {b.purpose ? <Text style={styles.meta}>{b.purpose}</Text> : null}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => cancel(b.id)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showNew} animationType="slide" onRequestClose={() => setShowNew(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowNew(false)} style={styles.backBtn}><Text style={styles.backText}>✕ Close</Text></TouchableOpacity>
            <Text style={styles.headerTitle}>New Booking</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <SelectField label="Equipment" placeholder="Select equipment..." options={equipment} value={equipmentId} onChange={setEquipmentId} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><DatePickerField label="From" placeholder="Select date" value={fromDate} onChange={setFromDate} /></View>
              <View style={{ flex: 1 }}><DatePickerField label="To" placeholder="Select date" value={toDate} onChange={setToDate} /></View>
            </View>
            <Text style={styles.label}>Purpose (optional)</Text>
            <TextInput style={styles.textarea} multiline placeholder="Job / reason..." placeholderTextColor="#6b7280" value={purpose} onChangeText={setPurpose} />
            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={create} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Booking</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  newBtn: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 18 },
  newBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: '#1c1917', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#292524', marginBottom: 10 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#a8a29e', fontSize: 13, marginTop: 3 },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  cancelText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  textarea: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { marginTop: 28, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
