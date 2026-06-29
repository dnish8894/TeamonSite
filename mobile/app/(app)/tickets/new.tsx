import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import SelectField from '@/components/SelectField'

interface Site { id: string; name: string; city: string | null }
interface System { id: string; name: string; type: string; site_id: string }
interface Device { id: string; name: string; system_id: string }

const TYPE_OPTIONS = [
  { value: 'breakdown',              label: 'Breakdown' },
  { value: 'preventive_maintenance', label: 'PM' },
  { value: 'installation',           label: 'Installation' },
  { value: 'inspection',             label: 'Inspection' },
  { value: 'relocation',             label: 'Relocation' },
]
const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 — Critical', color: '#ef4444' },
  { value: 'P2', label: 'P2 — High',     color: '#f97316' },
  { value: 'P3', label: 'P3 — Medium',   color: '#facc15' },
  { value: 'P4', label: 'P4 — Low',      color: '#60a5fa' },
]

export default function NewTicketScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ site_id?: string; system_id?: string; device_id?: string }>()
  const [sites,   setSites]   = useState<Site[]>([])
  const [systems, setSystems] = useState<System[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const [siteId,   setSiteId]   = useState(params.site_id ?? '')
  const [systemId, setSystemId] = useState(params.system_id ?? '')
  const [deviceId, setDeviceId] = useState(params.device_id ?? '')
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [type,     setType]     = useState('breakdown')
  const [priority, setPriority] = useState('P3')
  const [reporterName,  setReporterName]  = useState('')
  const [reporterPhone, setReporterPhone] = useState('')

  // Skip the auto-reset of child selections on the very first effect run
  // so a site/system/device prefilled from a QR scan survives mount.
  const skipSiteReset   = useRef(true)
  const skipSystemReset = useRef(true)

  useEffect(() => {
    supabase.from('sites').select('id,name,city').order('name').then(({ data }) => {
      setSites((data as Site[]) ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!skipSiteReset.current) { setSystemId(''); setDeviceId(''); setDevices([]) }
    skipSiteReset.current = false
    if (!siteId) { setSystems([]); return }
    supabase.from('elv_systems').select('id,name,type,site_id').eq('site_id', siteId).order('name')
      .then(({ data }) => setSystems((data as System[]) ?? []))
  }, [siteId])

  useEffect(() => {
    if (!skipSystemReset.current) { setDeviceId('') }
    skipSystemReset.current = false
    if (!systemId) { setDevices([]); return }
    supabase.from('devices').select('id,name,system_id').eq('system_id', systemId).order('name')
      .then(({ data }) => setDevices((data as Device[]) ?? []))
  }, [systemId])

  async function handleSubmit() {
    if (!siteId) return Alert.alert('Missing Info', 'Please select a site.')
    if (!title.trim()) return Alert.alert('Missing Info', 'Please enter a title.')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user } }))
    if (!user?.email) { setSaving(false); Alert.alert('Error', 'Not signed in.'); return }

    const { data: profile } = await supabase.from('users').select('id,organisation_id').eq('email', user.email).single()
    if (!profile?.organisation_id) { setSaving(false); Alert.alert('Error', 'Could not resolve your organisation.'); return }

    const { data: inserted, error } = await supabase.from('tickets').insert({
      organisation_id: profile.organisation_id,
      created_by: profile.id,
      ticket_no: '',
      site_id: siteId,
      system_id: systemId || null,
      device_id: deviceId || null,
      title: title.trim(),
      description: description.trim() || null,
      type, priority,
      reporter_name: reporterName.trim() || null,
      reporter_phone: reporterPhone.trim() || null,
    }).select('id').single()

    setSaving(false)
    if (error) { Alert.alert('Failed to create ticket', error.message); return }
    router.replace(`/(app)/tickets/${inserted!.id}`)
  }

  if (loading) return (
    <View style={styles.loadingBg}>
      <ActivityIndicator color="#f97316" size="large" />
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Ticket</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SelectField
          label="Site *"
          placeholder="Select a site"
          options={sites.map(s => ({ id: s.id, label: s.name, sublabel: s.city ?? undefined }))}
          value={siteId}
          onChange={setSiteId}
        />

        <SelectField
          label="System (optional)"
          placeholder={siteId ? 'Select a system' : 'Select a site first'}
          options={systems.map(s => ({ id: s.id, label: s.name }))}
          value={systemId}
          onChange={v => setSystemId(v === systemId ? '' : v)}
          disabled={!siteId || systems.length === 0}
        />

        <SelectField
          label="Device (optional)"
          placeholder={systemId ? 'Select a device' : 'Select a system first'}
          options={devices.map(d => ({ id: d.id, label: d.name }))}
          value={deviceId}
          onChange={v => setDeviceId(v === deviceId ? '' : v)}
          disabled={!systemId || devices.length === 0}
        />

        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} placeholder="e.g. Camera offline at main lobby"
          placeholderTextColor="#6b7280" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.textarea} multiline numberOfLines={4}
          placeholder="Describe the issue..." placeholderTextColor="#6b7280"
          value={description} onChangeText={setDescription} />

        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map(t => (
            <TouchableOpacity key={t.value}
              style={[styles.chip, type === t.value && styles.chipActive]}
              onPress={() => setType(t.value)}>
              <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.chipRow}>
          {PRIORITY_OPTIONS.map(p => (
            <TouchableOpacity key={p.value}
              style={[styles.chip, priority === p.value && { backgroundColor: p.color, borderColor: p.color }]}
              onPress={() => setPriority(p.value)}>
              <Text style={[styles.chipText, priority === p.value && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Reporter Name (optional)</Text>
        <TextInput style={styles.input} placeholder="Who reported this?" placeholderTextColor="#6b7280"
          value={reporterName} onChangeText={setReporterName} />

        <Text style={styles.label}>Reporter Phone (optional)</Text>
        <TextInput style={styles.input} placeholder="+60 12-345 6789" placeholderTextColor="#6b7280"
          keyboardType="phone-pad" value={reporterPhone} onChangeText={setReporterPhone} />

        <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Ticket</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  loadingBg: { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 6 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  backBtn:  { marginRight: 12 },
  backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  emptyText: { color: '#6b7280', fontSize: 13 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917',
  },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  input: {
    backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15,
  },
  textarea: {
    backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15, minHeight: 90, textAlignVertical: 'top',
  },

  submitBtn: {
    marginTop: 28, backgroundColor: '#f97316', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
