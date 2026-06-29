import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import SelectField from '@/components/SelectField'
import DatePickerField from '@/components/DatePickerField'

interface Client { id: string; name: string }
interface Site { id: string; name: string; client_id: string }

export default function NewProjectScreen() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  useEffect(() => {
    async function load() {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch(`${apiUrl}/api/clients`),
          fetch(`${apiUrl}/api/sites`),
        ])
        setClients(await cRes.json())
        setSites(await sRes.json())
      } catch { /* leave empty — pickers will just show no options */ }
      setLoading(false)
    }
    load()
  }, [])

  const filteredSites = sites.filter(s => !clientId || s.client_id === clientId)

  async function handleSubmit() {
    if (!name.trim()) return setError('Project name is required.')
    if (!clientId) return setError('Client is required.')
    setSaving(true); setError('')
    try {
      const res = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          client_id: clientId,
          site_id: siteId || null,
          description: description.trim() || null,
          status: 'planning',
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create project')
      router.replace({ pathname: '/(app)/projects/[id]/survey', params: { id: json.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.')
    }
    setSaving(false)
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
        <Text style={styles.headerTitle}>New Project</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Project Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. TRX Tower CCTV Upgrade"
          placeholderTextColor="#6b7280" value={name} onChangeText={setName} />

        <SelectField
          label="Client *"
          placeholder="Select a client"
          options={clients.map(c => ({ id: c.id, label: c.name }))}
          value={clientId}
          onChange={v => { setClientId(v); setSiteId('') }}
        />

        <SelectField
          label="Site (optional)"
          placeholder={clientId ? 'Select a site' : 'Select a client first'}
          options={filteredSites.map(s => ({ id: s.id, label: s.name }))}
          value={siteId}
          onChange={v => setSiteId(v === siteId ? '' : v)}
          disabled={!clientId || filteredSites.length === 0}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.textarea} multiline numberOfLines={4}
          placeholder="Scope of work..." placeholderTextColor="#6b7280"
          value={description} onChangeText={setDescription} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <DatePickerField label="Start Date" placeholder="Select date" value={startDate} onChange={setStartDate} />
          </View>
          <View style={{ flex: 1 }}>
            <DatePickerField label="End Date" placeholder="Select date" value={endDate} onChange={setEndDate} />
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Project</Text>}
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
  backBtn: { marginRight: 12 },
  backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },

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

  errorText: { color: '#ef4444', fontSize: 13, marginTop: 16 },

  submitBtn: {
    marginTop: 28, backgroundColor: '#f97316', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
