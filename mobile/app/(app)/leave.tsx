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

interface Leave {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  supporting_doc_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
}

const TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'medical', label: 'Medical' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'other', label: 'Other' },
]
const STATUS_COLOR: Record<string, string> = { pending: '#facc15', approved: '#34d399', rejected: '#ef4444' }

function daysBetween(s: string, e: string) {
  return Math.max(1, Math.round((new Date(e + 'T00:00').getTime() - new Date(s + 'T00:00').getTime()) / 86400000) + 1)
}

export default function LeaveScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  const [type, setType] = useState('annual')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email
    if (!email) { setLoading(false); return }
    const { data: profile } = await supabase.from('users').select('id').eq('email', email).single()
    if (!profile?.id) { setLoading(false); return }
    setUserId(profile.id)
    const { data } = await supabase.from('leave_requests')
      .select('id,leave_type,start_date,end_date,days,reason,supporting_doc_url,status,review_note')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setLeaves(Array.isArray(data) ? data as Leave[] : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function pickDoc() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true })
    if (res.canceled || !res.assets?.[0]?.base64) return
    setUploading(true)
    try {
      const url = await uploadBase64(res.assets[0].base64, res.assets[0].uri, 'hr-docs', 'leave')
      setDocUrl(url)
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload the document.')
    }
    setUploading(false)
  }

  async function apply() {
    if (!from || !to) return Alert.alert('Missing Info', 'Please choose start and end dates.')
    if (to < from) return Alert.alert('Invalid Dates', 'End date cannot be before start date.')
    if (!userId) return
    setSaving(true)
    const { error } = await supabase.from('leave_requests').insert({
      user_id: userId, leave_type: type, start_date: from, end_date: to,
      days: daysBetween(from, to), reason: reason.trim() || null, supporting_doc_url: docUrl || null,
    })
    setSaving(false)
    if (error) { Alert.alert('Failed', error.message); return }
    setShowApply(false)
    setType('annual'); setFrom(''); setTo(''); setReason(''); setDocUrl('')
    load()
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>My Leave</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowApply(true)}>
          <Text style={styles.applyBtnText}>+ Apply for Leave</Text>
        </TouchableOpacity>

        {leaves.length === 0 ? (
          <Text style={styles.empty}>No leave applications yet.</Text>
        ) : leaves.map(l => (
          <View key={l.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardType}>{TYPES.find(t => t.value === l.leave_type)?.label ?? l.leave_type}</Text>
              <View style={[styles.statusChip, { backgroundColor: (STATUS_COLOR[l.status] ?? '#888') + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[l.status] ?? '#888' }]}>{l.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.cardDates}>
              {new Date(l.start_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' → '}
              {new Date(l.end_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              {`  ·  ${l.days} day${l.days !== 1 ? 's' : ''}`}
            </Text>
            {l.reason ? <Text style={styles.cardReason}>{l.reason}</Text> : null}
            {l.review_note ? <Text style={styles.cardNote}>Note: {l.review_note}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showApply} animationType="slide" onRequestClose={() => setShowApply(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowApply(false)} style={styles.backBtn}><Text style={styles.backText}>✕ Close</Text></TouchableOpacity>
            <Text style={styles.headerTitle}>Apply for Leave</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map(t => (
                <TouchableOpacity key={t.value} style={[styles.chip, type === t.value && styles.chipActive]} onPress={() => setType(t.value)}>
                  <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}><DatePickerField label="From" placeholder="Select date" value={from} onChange={setFrom} /></View>
              <View style={{ flex: 1 }}><DatePickerField label="To" placeholder="Select date" value={to} onChange={setTo} /></View>
            </View>

            <Text style={styles.label}>Reason</Text>
            <TextInput style={styles.textarea} multiline placeholder="Reason for leave..." placeholderTextColor="#6b7280" value={reason} onChangeText={setReason} />

            <Text style={styles.label}>Supporting Document (optional)</Text>
            <TouchableOpacity style={styles.docBtn} onPress={pickDoc} disabled={uploading}>
              <Text style={styles.docBtnText}>{uploading ? 'Uploading…' : docUrl ? '✓ Attached — change' : '📎 Attach photo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={apply} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Application</Text>}
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
  cardType: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDates: { color: '#a8a29e', fontSize: 13 },
  cardReason: { color: '#a8a29e', fontSize: 13, marginTop: 4 },
  cardNote: { color: '#facc15', fontSize: 12, marginTop: 4 },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917' },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  textarea: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  docBtn: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  docBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
  submitBtn: { marginTop: 28, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
