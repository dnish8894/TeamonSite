import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'

const SYS_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control',
  structured_cabling: 'Structured Cabling', av: 'AV', pa: 'PA', bms: 'BMS',
}
const DEFAULT_CHECKS = [
  { key: 'cleaned', label: 'Device Cleaned' },
  { key: 'power_ok', label: 'Power Supply OK' },
  { key: 'functional', label: 'Functioning Normally' },
]

interface CheckItem { key: string; label: string }
interface DeviceLine { device_id: string; name: string | null; tag_id: string | null; checks: Record<string, boolean>; notes: string }
interface Report {
  id: string; visit_date: string; summary: string | null; status: string
  devices: DeviceLine[]; service_engineers: { id: string; name: string }[]
  engineer_name: string | null; engineer_signature: string | null
  client_name: string | null; client_signature: string | null
  sites: { name: string; clients: { name: string } | null } | null
  elv_systems: { name: string; type: string } | null
  pm_schedules: { name: string; next_due_at: string | null } | null
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PMReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL
  const [report, setReport] = useState<Report | null>(null)
  const [checkItems, setCheckItems] = useState<CheckItem[]>(DEFAULT_CHECKS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEngSig, setShowEngSig] = useState(false)
  const [showCliSig, setShowCliSig] = useState(false)
  const engSigRef = useRef<SignatureViewRef>(null)
  const cliSigRef = useRef<SignatureViewRef>(null)

  useEffect(() => {
    (async () => {
      try {
        const [rep, settings] = await Promise.all([
          fetch(`${apiUrl}/api/pm/reports/${id}`).then(r => r.json()),
          fetch(`${apiUrl}/api/settings`).then(r => r.ok ? r.json() : null),
        ])
        setReport(rep)
        const items = settings?.pm_check_items
        if (Array.isArray(items) && items.length > 0) setCheckItems(items)
      } catch {
        setReport(null)
      }
      setLoading(false)
    })()
  }, [id, apiUrl])

  const completed = report?.status === 'completed'

  function setCheck(idx: number, key: string, val: boolean) {
    setReport(r => r ? { ...r, devices: r.devices.map((d, i) => i === idx ? { ...d, checks: { ...(d.checks ?? {}), [key]: val } } : d) } : r)
  }
  function setNote(idx: number, val: string) {
    setReport(r => r ? { ...r, devices: r.devices.map((d, i) => i === idx ? { ...d, notes: val } : d) } : r)
  }

  async function save(markComplete: boolean) {
    if (!report) return
    setSaving(true)
    try {
      const body = {
        visit_date: report.visit_date,
        summary: report.summary,
        engineer_name: report.engineer_name,
        client_name: report.client_name,
        engineer_signature: report.engineer_signature,
        client_signature: report.client_signature,
        devices: report.devices,
        service_engineers: report.service_engineers,
        ...(markComplete ? { status: 'completed' } : {}),
      }
      const res = await fetch(`${apiUrl}/api/pm/reports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      const fresh = await fetch(`${apiUrl}/api/pm/reports/${id}`).then(r => r.json())
      setReport(fresh)
      if (markComplete) {
        const due = fmt(fresh?.pm_schedules?.next_due_at)
        Alert.alert('Report Completed', `Next PM for "${fresh?.pm_schedules?.name ?? 'this schedule'}" is due on ${due}.`,
          [{ text: 'OK', onPress: () => router.back() }])
      } else {
        Alert.alert('Saved', 'Draft saved.')
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.')
    }
    setSaving(false)
  }

  if (loading) return <View style={styles.bg}><ActivityIndicator color="#f97316" size="large" /></View>
  if (!report) return <View style={styles.bg}><Text style={{ color: '#6b7280' }}>Report not found.</Text></View>

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>PM Report</Text>
        <View style={[styles.pill, { backgroundColor: (completed ? '#34d399' : '#facc15') + '22' }]}>
          <Text style={[styles.pillText, { color: completed ? '#34d399' : '#facc15' }]}>{completed ? 'Completed' : 'Draft'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.schedName}>{report.pm_schedules?.name}</Text>
        <Text style={styles.meta}>📍 {report.sites?.name}{report.sites?.clients ? ` · ${report.sites.clients.name}` : ''}</Text>
        <Text style={styles.meta}>{report.elv_systems ? `🔧 ${SYS_LABELS[report.elv_systems.type] ?? report.elv_systems.type}` : ''}</Text>
        {report.service_engineers?.length > 0 && (
          <Text style={styles.meta}>👤 {report.service_engineers.map(e => e.name).filter(Boolean).join(', ')}</Text>
        )}

        {/* Devices */}
        <Text style={styles.section}>Devices ({report.devices.length})</Text>
        {report.devices.map((d, i) => (
          <View key={d.device_id} style={styles.devCard}>
            <Text style={styles.devName}>{d.name ?? 'Device'}{d.tag_id ? ` · ${d.tag_id}` : ''}</Text>
            <View style={styles.checkRow}>
              {checkItems.map(c => {
                const on = !!d.checks?.[c.key]
                return (
                  <TouchableOpacity key={c.key} style={[styles.checkChip, on && styles.checkChipOn]}
                    onPress={() => setCheck(i, c.key, !on)}>
                    <Text style={[styles.checkText, on && { color: '#fff' }]}>{on ? '✓ ' : ''}{c.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TextInput style={styles.noteInput} placeholder="Remarks (optional)…" placeholderTextColor="#6b7280"
              value={d.notes} onChangeText={t => setNote(i, t)} />
          </View>
        ))}

        {/* Summary */}
        <Text style={styles.section}>Overall Remarks</Text>
        <TextInput style={styles.summary} multiline placeholder="Summary of the visit…" placeholderTextColor="#6b7280"
          value={report.summary ?? ''} onChangeText={t => setReport(r => r ? { ...r, summary: t } : r)} />

        {/* Sign-off */}
        <Text style={styles.section}>Sign-Off</Text>
        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Engineer</Text>
            <TextInput style={styles.nameInput} placeholder="Name" placeholderTextColor="#6b7280"
              value={report.engineer_name ?? ''} onChangeText={t => setReport(r => r ? { ...r, engineer_name: t } : r)} />
            <TouchableOpacity style={styles.sigBtn} onPress={() => setShowEngSig(true)}>
              <Text style={styles.sigBtnText}>{report.engineer_signature ? '✓ Signed — tap to redo' : '✍ Sign'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Client</Text>
            <TextInput style={styles.nameInput} placeholder="Name" placeholderTextColor="#6b7280"
              value={report.client_name ?? ''} onChangeText={t => setReport(r => r ? { ...r, client_name: t } : r)} />
            <TouchableOpacity style={styles.sigBtn} onPress={() => setShowCliSig(true)}>
              <Text style={styles.sigBtnText}>{report.client_signature ? '✓ Signed — tap to redo' : '✍ Sign'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.draftBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={() => save(false)}>
          <Text style={styles.draftBtnText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.completeBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={() => save(true)}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeBtnText}>Mark Completed</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Engineer signature modal */}
      <Modal visible={showEngSig} animationType="slide">
        <SafeAreaView style={styles.sigModal}>
          <Text style={styles.sigModalTitle}>Engineer Signature</Text>
          <View style={styles.sigCanvas}>
            <SignatureScreen ref={engSigRef}
              onOK={(sig: string) => { setReport(r => r ? { ...r, engineer_signature: sig } : r); setShowEngSig(false) }}
              webStyle=".m-signature-pad--footer {display: none;}" />
          </View>
          <View style={styles.sigActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => engSigRef.current?.clearSignature()}><Text style={styles.cancelText}>Clear</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEngSig(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => engSigRef.current?.readSignature()}><Text style={styles.confirmText}>Save</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Client signature modal */}
      <Modal visible={showCliSig} animationType="slide">
        <SafeAreaView style={styles.sigModal}>
          <Text style={styles.sigModalTitle}>Client Signature</Text>
          <View style={styles.sigCanvas}>
            <SignatureScreen ref={cliSigRef}
              onOK={(sig: string) => { setReport(r => r ? { ...r, client_signature: sig } : r); setShowCliSig(false) }}
              webStyle=".m-signature-pad--footer {display: none;}" />
          </View>
          <View style={styles.sigActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => cliSigRef.current?.clearSignature()}><Text style={styles.cancelText}>Clear</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCliSig(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => cliSigRef.current?.readSignature()}><Text style={styles.confirmText}>Save</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0a09' },
  bg: { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#292524' },
  backBtn: {}, backText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 14 },
  schedName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  meta: { color: '#a8a29e', fontSize: 13, marginTop: 3 },
  section: { color: '#f97316', fontSize: 13, fontWeight: '700', marginTop: 22, marginBottom: 8, textTransform: 'uppercase' },
  devCard: { backgroundColor: '#1c1917', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#292524', marginBottom: 10 },
  devName: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#44403c' },
  checkChipOn: { backgroundColor: '#f97316', borderColor: '#f97316' },
  checkText: { color: '#a8a29e', fontSize: 12, fontWeight: '600' },
  noteInput: { marginTop: 8, backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13 },
  summary: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  signRow: { flexDirection: 'row', gap: 12 },
  signBox: { flex: 1, backgroundColor: '#1c1917', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#292524' },
  signLabel: { color: '#a8a29e', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  nameInput: { backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13, marginBottom: 8 },
  sigBtn: { backgroundColor: '#292524', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  sigBtnText: { color: '#f97316', fontSize: 12, fontWeight: '600' },
  draftBtn: { marginTop: 24, backgroundColor: '#292524', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  draftBtnText: { color: '#e7e5e4', fontSize: 15, fontWeight: '700' },
  completeBtn: { marginTop: 12, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sigModal: { flex: 1, backgroundColor: '#0c0a09', padding: 16 },
  sigModalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sigCanvas: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  sigActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, backgroundColor: '#292524', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: '#e7e5e4', fontSize: 14, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
