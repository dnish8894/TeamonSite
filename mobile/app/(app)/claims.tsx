import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { uploadBase64 } from '@/lib/upload'
import DatePickerField from '@/components/DatePickerField'
import TimePickerField from '@/components/TimePickerField'

interface Claim {
  id: string
  claim_type: string
  amount: number
  claim_date: string
  description: string | null
  receipt_url: string | null
  reference_note: string | null
  ot_from: string | null
  ot_to: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
}

const TYPES = [
  { value: 'travel', label: 'Travel' }, { value: 'meal', label: 'Meal' },
  { value: 'parts', label: 'Parts' }, { value: 'accommodation', label: 'Lodging' },
  { value: 'ot', label: 'Overtime' }, { value: 'other', label: 'Other' },
]
const STATUS_COLOR: Record<string, string> = { pending: '#facc15', approved: '#34d399', rejected: '#ef4444' }

export default function ClaimsScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  const [type, setType] = useState('travel')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [otFrom, setOtFrom] = useState('')
  const [otTo, setOtTo] = useState('')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) { setLoading(false); return }
    const { data: profile } = await supabase.from('users').select('id').eq('email', email).single()
    if (!profile?.id) { setLoading(false); return }
    setUserId(profile.id)
    const { data } = await supabase.from('claims')
      .select('id,claim_type,amount,claim_date,description,receipt_url,reference_note,ot_from,ot_to,status,review_note')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setClaims(Array.isArray(data) ? data as Claim[] : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function pickReceipt() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true })
    if (res.canceled || !res.assets?.[0]?.base64) return
    setUploading(true)
    try {
      const url = await uploadBase64(res.assets[0].base64, res.assets[0].uri, 'hr-docs', 'claims')
      setReceiptUrl(url)
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload the receipt.')
    }
    setUploading(false)
  }

  async function apply() {
    if (!date) return Alert.alert('Missing Info', 'Please choose the date.')
    const amt = type === 'ot' ? 0 : parseFloat(amount)
    if (type !== 'ot' && (!amt || amt <= 0)) return Alert.alert('Invalid Amount', 'Please enter a valid amount.')
    if (type === 'ot' && (!otFrom || !otTo)) return Alert.alert('Missing Info', 'Please set OT from and to times.')
    if (!userId) return
    setSaving(true)
    const { error } = await supabase.from('claims').insert({
      user_id: userId, claim_type: type, amount: amt, claim_date: date,
      description: description.trim() || null, reference_note: reference.trim() || null,
      receipt_url: receiptUrl || null,
      ot_from: type === 'ot' ? (otFrom.trim() || null) : null,
      ot_to:   type === 'ot' ? (otTo.trim() || null) : null,
    })
    setSaving(false)
    if (error) { Alert.alert('Failed', error.message); return }
    setShowApply(false)
    setType('travel'); setAmount(''); setDate(''); setDescription(''); setReference(''); setReceiptUrl(''); setOtFrom(''); setOtTo('')
    load()
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>My Claims</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowApply(true)}>
          <Text style={styles.applyBtnText}>+ New Claim</Text>
        </TouchableOpacity>

        {claims.length === 0 ? (
          <Text style={styles.empty}>No claims submitted yet.</Text>
        ) : claims.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardAmount}>
                {c.claim_type === 'ot' ? `OT ${c.ot_from ?? ''}–${c.ot_to ?? ''}` : `RM ${Number(c.amount).toFixed(2)}`}
                {' · '}{TYPES.find(t => t.value === c.claim_type)?.label ?? c.claim_type}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: (STATUS_COLOR[c.status] ?? '#888') + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[c.status] ?? '#888' }]}>{c.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.cardDate}>{new Date(c.claim_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {c.description ? <Text style={styles.cardReason}>{c.description}</Text> : null}
            {c.review_note ? <Text style={styles.cardNote}>Note: {c.review_note}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showApply} animationType="slide" onRequestClose={() => setShowApply(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowApply(false)} style={styles.backBtn}><Text style={styles.backText}>✕ Close</Text></TouchableOpacity>
            <Text style={styles.headerTitle}>New Claim</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map(t => (
                <TouchableOpacity key={t.value} style={[styles.chip, type === t.value && styles.chipActive]} onPress={() => setType(t.value)}>
                  <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {type !== 'ot' && (
              <>
                <Text style={styles.label}>Amount (RM)</Text>
                <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#6b7280" value={amount} onChangeText={setAmount} />
              </>
            )}

            <DatePickerField label={type === 'ot' ? 'OT Date' : 'Claim Date'} placeholder="Select date" value={date} onChange={setDate} />

            {type === 'ot' && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}><TimePickerField label="From" value={otFrom} onChange={setOtFrom} /></View>
                <View style={{ flex: 1 }}><TimePickerField label="To" value={otTo} onChange={setOtTo} /></View>
              </View>
            )}

            <Text style={styles.label}>Reference (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. ticket no / PM visit" placeholderTextColor="#6b7280" value={reference} onChangeText={setReference} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.textarea} multiline placeholder="What is this claim for..." placeholderTextColor="#6b7280" value={description} onChangeText={setDescription} />

            <Text style={styles.label}>Receipt (optional)</Text>
            <TouchableOpacity style={styles.docBtn} onPress={pickReceipt} disabled={uploading}>
              <Text style={styles.docBtnText}>{uploading ? 'Uploading…' : receiptUrl ? '✓ Attached — change' : '📎 Attach receipt photo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={apply} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Claim</Text>}
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

  applyBtn: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 18 },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: '#1c1917', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#292524', marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardAmount: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDate: { color: '#a8a29e', fontSize: 13 },
  cardReason: { color: '#a8a29e', fontSize: 13, marginTop: 4 },
  cardNote: { color: '#facc15', fontSize: 12, marginTop: 4 },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917' },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  input: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
  textarea: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  docBtn: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  docBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
  submitBtn: { marginTop: 28, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
