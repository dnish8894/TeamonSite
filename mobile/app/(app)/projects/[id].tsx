import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SelectField, { SelectOption } from '@/components/SelectField'
import { STATUS_STYLE } from '@/app/(app)/projects'

interface Project {
  id: string
  project_no: string
  name: string
  status: string
  description: string | null
  value: number | null
  start_date: string | null
  end_date: string | null
  clients: { name: string; type: string } | null
  sites: { name: string } | null
}

interface Item { description: string; model: string; remark: string }
const emptyItem = (): Item => ({ description: '', model: '', remark: '' })
const REQUEST_TYPES = [
  { value: 'warranty', label: 'Under Warranty' },
  { value: 'preventive_maintenance', label: 'Preventive Maintenance' },
  { value: 'quotation', label: 'Need Quotation' },
  { value: 'project', label: 'Project' },
]

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [devices, setDevices] = useState<{ id: string; name: string; tag_id: string | null }[]>([])

  const [showPartRequest, setShowPartRequest] = useState(false)
  const [users, setUsers] = useState<SelectOption[]>([])
  const [requestedBy, setRequestedBy] = useState('')
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [requestType, setRequestType] = useState('project')
  const [submittingRequest, setSubmittingRequest] = useState(false)

  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  async function load() {
    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}`)
      const data = await res.json()
      setProject(data)
      setSelectedStatus(data?.status ?? '')
      try {
        const dRes = await fetch(`${apiUrl}/api/projects/${id}/devices`)
        const dData = await dRes.json()
        setDevices(Array.isArray(dData?.linked) ? dData.linked : [])
      } catch { /* devices are best-effort */ }
    } catch {
      setProject(null)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  async function updateStatus() {
    if (!project || !selectedStatus || selectedStatus === project.status) return
    setSavingStatus(true)
    try {
      await fetch(`${apiUrl}/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      })
      setProject(p => p ? { ...p, status: selectedStatus } : p)
    } catch {
      Alert.alert('Failed to update status', 'Could not reach the server.')
    }
    setSavingStatus(false)
  }

  async function openPartRequest() {
    setShowPartRequest(true)
    if (users.length === 0) {
      try {
        const res = await fetch(`${apiUrl}/api/users`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setUsers(data.filter((u: { is_active?: boolean }) => u.is_active !== false)
            .map((u: { id: string; full_name: string }) => ({ id: u.id, label: u.full_name })))
        }
      } catch { /* leave empty — picker will just show no options */ }
    }
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(rows => rows.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function addItem() { setItems(rows => [...rows, emptyItem()]) }
  function removeItem(i: number) { setItems(rows => rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows) }

  async function submitPartRequest() {
    const cleanItems = items
      .map(it => ({ description: it.description.trim(), model: it.model.trim(), remark: it.remark.trim() }))
      .filter(it => it.description)
    if (cleanItems.length === 0) return Alert.alert('Missing Info', 'Please describe at least one piece of equipment.')
    if (!requestedBy) return Alert.alert('Missing Info', 'Please select who is requesting this.')

    setSubmittingRequest(true)
    try {
      const res = await fetch(`${apiUrl}/api/part-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id, items: cleanItems, request_type: requestType, requested_by: requestedBy }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request')
      setShowPartRequest(false)
      setItems([emptyItem()]); setRequestedBy(''); setRequestType('project')
      Alert.alert('Request Sent', 'Procurement has been notified.')
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not reach the server.')
    }
    setSubmittingRequest(false)
  }

  if (loading) return (
    <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>
  )
  if (!project) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bg}><Text style={styles.notFound}>Project not found.</Text></View>
    </SafeAreaView>
  )

  const st = STATUS_STYLE[project.status] ?? STATUS_STYLE.planning

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.projectNo}>{project.project_no}</Text>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.projectMeta}>
          {project.clients?.name ?? '—'}{project.sites?.name ? ` · ${project.sites.name}` : ''}
        </Text>
        {project.description && <Text style={styles.description}>{project.description}</Text>}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.requestBtn, { flex: 1 }]} onPress={openPartRequest}>
            <Text style={styles.requestBtnText}>📦 Request Part</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.surveyBtn, { flex: 1 }]}
            onPress={() => router.push({ pathname: '/(app)/projects/[id]/survey', params: { id } })}>
            <Text style={styles.surveyBtnText}>📋 Site Survey</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.statusGrid}>
          {Object.entries(STATUS_STYLE).map(([key, val]) => (
            <TouchableOpacity
              key={key}
              disabled={savingStatus}
              style={[styles.statusOption, selectedStatus === key && { backgroundColor: val.bg, borderColor: val.color }]}
              onPress={() => setSelectedStatus(key)}>
              <Text style={[styles.statusOptionText, selectedStatus === key && { color: val.color }]}>{val.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.updateStatusBtn, (savingStatus || selectedStatus === project.status) && { opacity: 0.5 }]}
          onPress={updateStatus}
          disabled={savingStatus || selectedStatus === project.status}>
          {savingStatus ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateStatusBtnText}>Update Status</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Details</Text>
        <View style={styles.detailCard}>
          {[
            ['Start Date', project.start_date ? new Date(project.start_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
            ['End Date', project.end_date ? new Date(project.end_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'],
            ['Client Type', project.clients?.type ?? '—'],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {devices.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Project Devices ({devices.length})</Text>
            <View style={styles.detailCard}>
              {devices.map(d => (
                <View key={d.id} style={styles.detailRow}>
                  <Text style={styles.detailValue}>{d.name}</Text>
                  <Text style={styles.detailLabel}>{d.tag_id ?? ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showPartRequest} animationType="slide" onRequestClose={() => setShowPartRequest(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowPartRequest(false)} style={styles.backBtn}>
              <Text style={styles.backText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request Part</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <SelectField
              label="Requested By"
              placeholder="Select a person..."
              options={users}
              value={requestedBy}
              onChange={setRequestedBy}
            />

            <Text style={styles.sectionLabel}>Equipment Requested</Text>
            {items.map((item, i) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemHeaderText}>Item {i + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(i)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput style={styles.input} placeholder="Equipment / description"
                  placeholderTextColor="#6b7280" value={item.description}
                  onChangeText={v => updateItem(i, { description: v })} />
                <TextInput style={styles.input} placeholder="Model (optional)"
                  placeholderTextColor="#6b7280" value={item.model}
                  onChangeText={v => updateItem(i, { model: v })} />
                <TextInput style={styles.input} placeholder="Remark (optional)"
                  placeholderTextColor="#6b7280" value={item.remark}
                  onChangeText={v => updateItem(i, { remark: v })} />
              </View>
            ))}
            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Text style={styles.addItemText}>+ Add Another Item</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Request Type</Text>
            <View style={styles.statusGrid}>
              {REQUEST_TYPES.map(t => (
                <TouchableOpacity key={t.value}
                  style={[styles.statusOption, requestType === t.value && styles.statusOptionActive]}
                  onPress={() => setRequestType(t.value)}>
                  <Text style={[styles.statusOptionText, requestType === t.value && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={submitPartRequest} disabled={submittingRequest}>
              {submittingRequest ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  bg:   { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#6b7280', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  backBtn: { marginRight: 12 },
  backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 16 },

  projectNo: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  projectName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  projectMeta: { color: '#a8a29e', fontSize: 14, marginTop: 4 },
  description: { color: '#a8a29e', fontSize: 14, marginTop: 10, lineHeight: 20 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  requestBtn: {
    backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
  },
  requestBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '700' },
  surveyBtn: {
    backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  surveyBtnText: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },

  sectionLabel: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 24, marginBottom: 10 },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917',
  },
  statusOptionActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  statusOptionText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },

  updateStatusBtn: {
    marginTop: 14, backgroundColor: '#f97316', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  updateStatusBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  detailCard: {
    backgroundColor: '#1c1917', borderRadius: 16, borderWidth: 1, borderColor: '#292524', overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  detailLabel: { color: '#6b7280', fontSize: 13 },
  detailValue: { color: '#e7e5e4', fontSize: 13, fontWeight: '600' },

  itemCard: {
    backgroundColor: '#1c1917', borderRadius: 12, borderWidth: 1, borderColor: '#292524',
    padding: 12, marginBottom: 10, gap: 8,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemHeaderText: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  removeText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14,
  },
  addItemBtn: {
    borderWidth: 1, borderColor: '#292524', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginBottom: 8,
  },
  addItemText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },

  submitBtn: { marginTop: 24, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
