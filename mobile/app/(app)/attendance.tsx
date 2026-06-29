import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { uploadBase64 } from '@/lib/upload'
import SelectField, { SelectOption } from '@/components/SelectField'

interface OpenCheckin {
  id: string
  check_in_at: string
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_landmark: string | null
  site_id: string | null
  site_name: string | null
}

interface AttendanceRecord {
  id: string
  check_in_at: string
  check_in_landmark: string | null
  check_out_at: string | null
  check_out_landmark: string | null
  site_id: string | null
  site_name: string | null
  sites: { name: string } | null
}

const CUSTOM_SITE_ID = '__custom__'
type Period = 'daily' | 'weekly' | 'monthly'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

function periodRange(period: Period): { from: string; to: string; label: string } {
  const now = new Date()
  if (period === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start); end.setDate(end.getDate() + 1)
    return { from: start.toISOString(), to: end.toISOString(), label: start.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) }
  }
  if (period === 'weekly') {
    const dow = (now.getDay() + 6) % 7 // Monday = 0
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
    const end = new Date(start); end.setDate(end.getDate() + 7)
    return { from: start.toISOString(), to: end.toISOString(), label: `${start.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} – ${new Date(end.getTime() - 86400000).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}` }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: start.toISOString(), to: end.toISOString(), label: start.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }) }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function hoursStr(inAt: string, outAt: string | null, breakMin = 0): string {
  if (!outAt) return '—'
  let mins = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000
  if (mins > 300 && breakMin > 0) mins -= breakMin
  mins = Math.max(0, Math.round(mins))
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function AttendanceScreen() {
  const [loading, setLoading] = useState(true)
  const [engineerId, setEngineerId] = useState<string | null>(null)
  const [sites, setSites] = useState<SelectOption[]>([])
  const [siteId, setSiteId] = useState('')
  const [openCheckin, setOpenCheckin] = useState<OpenCheckin | null>(null)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [showCustomSite, setShowCustomSite] = useState(false)
  const [customSiteName, setCustomSiteName] = useState('')
  const [period, setPeriod] = useState<Period>('daily')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [engineerName, setEngineerName] = useState('')
  const [photoRequired, setPhotoRequired] = useState(true)
  const [breakMin, setBreakMin] = useState(0)

  useEffect(() => { load() }, [])
  useEffect(() => { if (engineerId) loadRecords() }, [engineerId, period])

  async function loadRecords() {
    if (!engineerId) return
    setRecordsLoading(true)
    const { from, to } = periodRange(period)
    const apiUrl = process.env.EXPO_PUBLIC_API_URL
    try {
      const res = await fetch(`${apiUrl}/api/attendance?engineer_id=${engineerId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      setRecords([])
    }
    setRecordsLoading(false)
  }

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase.from('users').select('id,full_name').eq('email', user.email!).single()
    if (profile?.full_name) setEngineerName(profile.full_name)

    const { data: orgRow } = await supabase.from('organisations').select('attendance_photo_required, attendance_break_minutes').limit(1).single()
    setPhotoRequired(orgRow?.attendance_photo_required !== false)
    setBreakMin(orgRow?.attendance_break_minutes ?? 0)

    const { data: siteRows } = await supabase.from('sites').select('id,name').order('name')
    setSites([
      ...(siteRows ?? []).map(s => ({ id: s.id, label: s.name })),
      { id: CUSTOM_SITE_ID, label: '+ Add new site...' },
    ])

    if (profile?.id) {
      const { data: eng } = await supabase.from('engineers').select('id').eq('user_id', profile.id).single()
      if (eng?.id) {
        setEngineerId(eng.id)
        const { data: openRow } = await supabase
          .from('attendance_checkins')
          .select('id,check_in_at,check_in_lat,check_in_lng,check_in_landmark,site_id,site_name')
          .eq('engineer_id', eng.id)
          .is('check_out_at', null)
          .order('check_in_at', { ascending: false })
          .limit(1)
          .single()
        setOpenCheckin(openRow ?? null)
      }
    }
    setLoading(false)
  }

  function handleSiteSelect(id: string) {
    if (id === CUSTOM_SITE_ID) {
      setShowCustomSite(true)
      return
    }
    setSiteId(id)
    setCustomSiteName('')
  }

  function confirmCustomSite() {
    if (!customSiteName.trim()) return
    setShowCustomSite(false)
    setSiteId(CUSTOM_SITE_ID)
  }

  async function getLocation(): Promise<{ lat: number; lng: number; landmark: string | null } | null> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Location Required', 'Please enable location access to check in/out.')
      return null
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      let landmark: string | null = null
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        if (place) {
          landmark = [place.name, place.street, place.district || place.city, place.region]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(', ')
        }
      } catch { /* reverse geocoding unavailable — fall back to raw coordinates only */ }
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, landmark }
    } catch {
      Alert.alert('Location Error', 'Could not get your current location. Try again.')
      return null
    }
  }

  // Capture a check-in/out selfie via camera and upload it. Returns the URL,
  // or '' if photo isn't required, or null if the user cancelled / it failed.
  async function capturePhoto(): Promise<string | null | ''> {
    if (!photoRequired) return ''
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'Please enable camera access, or ask HR to disable attendance photos.')
      return null
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, cameraType: ImagePicker.CameraType.front, base64: true })
    if (res.canceled || !res.assets?.[0]?.base64) return res.canceled ? null : null
    try {
      return await uploadBase64(res.assets[0].base64, res.assets[0].uri, 'attendance-photos', engineerId ?? 'misc')
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload the photo. Try again.')
      return null
    }
  }

  async function handleCheckIn() {
    if (!engineerId) return
    if (!siteId) { Alert.alert('Select Site', 'Please select the site you are checking in at.'); return }
    setCheckinLoading(true)
    const photo = await capturePhoto()
    if (photo === null) { setCheckinLoading(false); return }
    const loc = await getLocation()
    if (!loc) { setCheckinLoading(false); return }

    const apiUrl = process.env.EXPO_PUBLIC_API_URL
    try {
      const res = await fetch(`${apiUrl}/api/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineer_id: engineerId,
          lat: loc.lat,
          lng: loc.lng,
          landmark: loc.landmark,
          photo: photo || null,
          site_id: siteId === CUSTOM_SITE_ID ? null : siteId,
          site_name: siteId === CUSTOM_SITE_ID ? customSiteName.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Check-in failed')
      setOpenCheckin(data as OpenCheckin)
    } catch (err) {
      Alert.alert('Check-In Failed', err instanceof Error ? err.message : 'Could not reach the server.')
    }
    setCheckinLoading(false)
  }

  async function handleCheckOut() {
    if (!openCheckin) return
    setCheckinLoading(true)
    const photo = await capturePhoto()
    if (photo === null) { setCheckinLoading(false); return }
    const loc = await getLocation()
    if (!loc) { setCheckinLoading(false); return }

    const apiUrl = process.env.EXPO_PUBLIC_API_URL
    let error: Error | null = null
    try {
      const res = await fetch(`${apiUrl}/api/attendance/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_id: openCheckin.id, lat: loc.lat, lng: loc.lng, landmark: loc.landmark, photo: photo || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Check-out failed')
    } catch (err) {
      error = err instanceof Error ? err : new Error('Could not reach the server.')
    }

    setCheckinLoading(false)
    if (error) { Alert.alert('Check-Out Failed', error.message); return }
    setOpenCheckin(null)
    setSiteId('')
    setCustomSiteName('')
  }

  async function downloadReport() {
    if (records.length === 0) {
      Alert.alert('No Records', 'There are no attendance records for this period.')
      return
    }
    setDownloading(true)
    const { label } = periodRange(period)
    const rows = records.map(r => `
      <tr>
        <td>${new Date(r.check_in_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${escapeHtml(r.sites?.name || r.site_name || '—')}</td>
        <td>${new Date(r.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}<br/><span class="lm">${escapeHtml(r.check_in_landmark || '—')}</span></td>
        <td>${r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '—'}<br/><span class="lm">${escapeHtml(r.check_out_landmark || '—')}</span></td>
        <td>${hoursStr(r.check_in_at, r.check_out_at, breakMin)}</td>
      </tr>`).join('')

    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1917; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.sub { color: #6b7280; font-size: 12px; margin-top: 0; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d6d3d1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #1c1917; color: #fff; }
        .lm { color: #78716c; font-size: 10px; }
      </style></head>
      <body>
        <h1>Attendance Report — ${escapeHtml(engineerName || 'Engineer')}</h1>
        <p class="sub">${PERIODS.find(p => p.key === period)?.label} period: ${label}</p>
        <table>
          <thead><tr><th>Date</th><th>Site</th><th>Check-In (Landmark)</th><th>Check-Out (Landmark)</th><th>Hours</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`

    try {
      const { uri } = await Print.printToFileAsync({ html })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Attendance Report' })
      }
    } catch {
      Alert.alert('Download Failed', 'Could not generate the report. Try again.')
    }
    setDownloading(false)
  }

  if (loading) return (
    <View style={styles.bg}>
      <ActivityIndicator color="#f97316" size="large" />
    </View>
  )

  if (!engineerId) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bg}>
        <Text style={styles.notEngineerText}>Attendance check-in is only available for engineers.</Text>
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Attendance</Text>
        <View style={styles.checkinCard}>
          {openCheckin ? (
            <>
              <Text style={styles.checkinStatusOn}>● Checked In</Text>
              <Text style={styles.checkinSite}>
                {openCheckin.site_name || sites.find(s => s.id === openCheckin.site_id)?.label || '—'}
              </Text>
              <Text style={styles.checkinTime}>
                Since {new Date(openCheckin.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {openCheckin.check_in_landmark ? (
                <Text style={styles.checkinLandmark}>📍 {openCheckin.check_in_landmark}</Text>
              ) : null}
              <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckOut} disabled={checkinLoading}>
                {checkinLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>📍 Check Out</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.checkinStatusOff}>○ Not Checked In</Text>
              <SelectField
                label="Site"
                placeholder="Select site..."
                options={sites}
                value={siteId === CUSTOM_SITE_ID ? '' : siteId}
                onChange={handleSiteSelect}
              />
              {siteId === CUSTOM_SITE_ID && customSiteName ? (
                <Text style={styles.customSiteChosen}>New site: {customSiteName}</Text>
              ) : null}
              <TouchableOpacity style={styles.checkinBtn} onPress={handleCheckIn} disabled={checkinLoading}>
                {checkinLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkinBtnText}>📍 Check In</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>My Attendance Report</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, period === p.key && styles.periodChipActive]}
              onPress={() => setPeriod(p.key)}>
              <Text style={[styles.periodChipText, period === p.key && styles.periodChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.reportCard}>
          {recordsLoading ? (
            <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
          ) : records.length === 0 ? (
            <Text style={styles.emptyRecords}>No attendance records for this period.</Text>
          ) : (
            records.map(r => (
              <View key={r.id} style={styles.recordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordDate}>
                    {new Date(r.check_in_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                  </Text>
                  <Text style={styles.recordSite}>{r.sites?.name || r.site_name || '—'}</Text>
                  {r.check_in_landmark ? (
                    <Text style={styles.recordLandmark}>📍 {r.check_in_landmark}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recordTime}>
                    {new Date(r.check_in_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Text>
                  <Text style={styles.recordHours}>{hoursStr(r.check_in_at, r.check_out_at, breakMin)}</Text>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.downloadBtn} onPress={downloadReport} disabled={downloading || records.length === 0}>
            {downloading ? <ActivityIndicator color="#fff" /> : <Text style={styles.downloadBtnText}>⬇ Download Report</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showCustomSite} transparent animationType="fade" onRequestClose={() => setShowCustomSite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Site Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. ABC Tower Lobby"
              placeholderTextColor="#6b7280"
              value={customSiteName}
              onChangeText={setCustomSiteName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCustomSite(false); setCustomSiteName('') }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmCustomSite}>
                <Text style={styles.modalConfirmText}>Use This Site</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0c0a09' },
  bg:     { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  notEngineerText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },

  checkinCard: {
    backgroundColor: '#1c1917', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#292524', alignItems: 'center',
  },
  checkinStatusOn:  { color: '#34d399', fontSize: 16, fontWeight: '700' },
  checkinStatusOff: { color: '#6b7280', fontSize: 16, fontWeight: '700', alignSelf: 'flex-start' },
  checkinSite: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 6 },
  checkinTime: { color: '#a8a29e', fontSize: 12, marginTop: 2, marginBottom: 4 },
  checkinLandmark: { color: '#6b7280', fontSize: 12, marginBottom: 14, textAlign: 'center' },
  checkinBtn: { marginTop: 18, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, alignSelf: 'stretch', alignItems: 'center' },
  checkinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkoutBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28 },
  checkoutBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  customSiteChosen: { color: '#34d399', fontSize: 13, marginTop: 8, alignSelf: 'flex-start' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  modalBox: { backgroundColor: '#1c1917', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: '#292524' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#292524' },
  modalCancelText: { color: '#a8a29e', fontWeight: '600' },
  modalConfirm: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#f97316' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },

  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917',
  },
  periodChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  periodChipText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  periodChipTextActive: { color: '#fff' },

  reportCard: {
    backgroundColor: '#1c1917', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#292524',
  },
  emptyRecords: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  recordRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  recordDate: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recordSite: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  recordLandmark: { color: '#57534e', fontSize: 11, marginTop: 2, maxWidth: 200 },
  recordTime: { color: '#e7e5e4', fontSize: 12, fontWeight: '600' },
  recordHours: { color: '#34d399', fontSize: 12, fontWeight: '700', marginTop: 2 },
  downloadBtn: {
    marginTop: 14, backgroundColor: '#292524', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: '#3f3a37',
  },
  downloadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
