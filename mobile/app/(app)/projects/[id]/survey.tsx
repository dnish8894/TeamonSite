import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import DatePickerField from '@/components/DatePickerField'

interface Project {
  id: string
  name: string
  sites: { name: string } | null
}

const YES_NO = [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]
const SITE_TYPE = [{ value: 'EXISTING SITE', label: 'Existing Site' }, { value: 'NEW SITE', label: 'New Site' }]
const JOB_TYPE = [
  { value: 'NEW', label: 'New' },
  { value: 'ADDITIONAL', label: 'Additional' },
  { value: 'NEW or ADDITIONAL', label: 'New & Additional' },
]

const emptyForm = {
  site_name: '', site_location: '', pic_name: '', pic_no: '',
  site_type: '', job_type: '',
  no_of_doors: '', door_license: '', type_of_doors: '',
  double_leaf_doors: '', single_leaf_doors: '', type_of_reader: '', shift_patterns: '',
  no_of_controllers: '', type_of_controller: '', no_of_sub_controllers: '', type_of_sub_controller: '',
  power_supply_required: '', cabling_by_infiniteql: '', hacking_drill: '', cable_measurement: '',
  installation_termination: '', existing_fire_signal: '', drawing_layout_required: '',
  touch_up_make_good: '', type_of_touch_up: '', paint_job: '', notes: '',
  surveyed_by: '', survey_date: '', survey_time: '',
}
type Form = typeof emptyForm

// Defined at module level (not inside the screen component) so they keep a stable
// identity across re-renders — otherwise every keystroke remounts the TextInput and
// the keyboard closes.
function LabeledInput({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad'; multiline?: boolean
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={multiline ? styles.textarea : styles.input}
        placeholder={placeholder} placeholderTextColor="#6b7280"
        value={value} onChangeText={onChangeText}
        keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 3 : undefined}
      />
    </>
  )
}

function ChipField({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(o => (
        <TouchableOpacity key={o.value}
          style={[styles.chip, value === o.value && styles.chipActive]}
          onPress={() => onChange(o.value)}>
          <Text style={[styles.chipText, value === o.value && styles.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function AcsSiteSurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(emptyForm)

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch(`${apiUrl}/api/projects/${id}`),
          fetch(`${apiUrl}/api/projects/${id}/survey`),
        ])
        const project: Project = await pRes.json()
        const survey = await sRes.json()
        setForm(f => ({
          ...f,
          site_name: project?.name ?? '',
          site_location: project?.sites?.name ?? '',
          ...(survey?.acs_survey ?? {}),
        }))
      } catch { /* prefill is best-effort */ }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    setSaving(true); setError('')
    // Auto-stamp the completion time (and date, if not already chosen) on save.
    const now = new Date()
    const completed: Form = {
      ...form,
      survey_date: form.survey_date || now.toISOString().split('T')[0],
      survey_time: now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
    setForm(completed)
    try {
      const res = await fetch(`${apiUrl}/api/projects/${id}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acs_survey: completed }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to save survey')
      }
      router.replace({ pathname: '/(app)/projects/[id]', params: { id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.')
    }
    setSaving(false)
  }

  async function downloadPdf() {
    setDownloading(true)
    const esc = (s: string) => (s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const fmtDate = (d: string) => d ? new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const row = (label: string, value: string) => `<tr><td class="lbl">${label}</td><td class="val">${esc(value)}</td></tr>`
    const section = (title: string) => `<tr><td colspan="2" class="sec">${title}</td></tr>`

    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1917; padding: 24px; }
        .head { background: #f97316; color: #fff; padding: 12px 16px; border-radius: 6px; }
        .head h1 { font-size: 16px; margin: 0; }
        .head p { font-size: 11px; margin: 2px 0 0; color: #ffe8d6; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
        td { border: 1px solid #e7e5e4; padding: 7px 10px; vertical-align: top; }
        .sec { background: #1c1917; color: #fff; font-weight: bold; font-size: 12px; text-transform: uppercase; }
        .lbl { width: 42%; color: #78716c; }
        .val { font-weight: 600; }
        .note { margin-top: 18px; font-size: 10px; font-style: italic; color: #78716c; }
      </style></head>
      <body>
        <div class="head"><h1>ACS Site Survey Form</h1><p>${esc(form.site_name)}</p></div>
        <table>
          ${section('Site Details')}
          ${row('Site Name', form.site_name)}
          ${row('Site Location', form.site_location)}
          ${row('Person In Charge', form.pic_name)}
          ${row('PIC Contact No', form.pic_no)}
          ${row('Site', form.site_type)}
          ${row('Type of Job', form.job_type)}
          ${section('Doors')}
          ${row('No of Doors', form.no_of_doors)}
          ${row('Door License', form.door_license)}
          ${row('Type of Doors', form.type_of_doors)}
          ${row('No. of Double Leaf Doors', form.double_leaf_doors)}
          ${row('No. of Single Leaf Doors', form.single_leaf_doors)}
          ${row('Type of Reader', form.type_of_reader)}
          ${row('Shift Patterns', form.shift_patterns)}
          ${section('Backend Installation Area')}
          ${row('No. of Controllers', form.no_of_controllers)}
          ${row('Type of Controller', form.type_of_controller)}
          ${row('No. of Sub-Controllers', form.no_of_sub_controllers)}
          ${row('Type of Sub Controller', form.type_of_sub_controller)}
          ${row('Power Supply Required', form.power_supply_required)}
          ${row('Cabling by InfiniteQL', form.cabling_by_infiniteql)}
          ${row('Hacking & Drill', form.hacking_drill)}
          ${row('Cable Measurement', form.cable_measurement)}
          ${row('Installation & Termination', form.installation_termination)}
          ${row('Existing Fire Signal', form.existing_fire_signal)}
          ${row('Drawing / Layout Required', form.drawing_layout_required)}
          ${row('Touch-Up & Make Good', form.touch_up_make_good)}
          ${row('Type of Touch Up', form.type_of_touch_up)}
          ${row('Paint Job', form.paint_job)}
          ${section('Notes & Sign-Off')}
          ${row('Notes', form.notes)}
          ${row('Site Survey Done By', form.surveyed_by)}
          ${row('Date of Survey', fmtDate(form.survey_date))}
          ${row('Time of Survey', form.survey_time)}
        </table>
        <p class="note">All information provided is accurate, and the sales quotation will be prepared based on the details collected by the site surveyor.</p>
      </body></html>`

    try {
      const { uri } = await Print.printToFileAsync({ html })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'ACS Site Survey' })
      }
    } catch {
      Alert.alert('Download Failed', 'Could not generate the PDF. Try again.')
    }
    setDownloading(false)
  }

  if (loading) return (
    <View style={styles.loadingBg}><ActivityIndicator color="#f97316" size="large" /></View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace({ pathname: '/(app)/projects/[id]', params: { id } })} style={styles.backBtn}>
          <Text style={styles.backText}>← Skip</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ACS Site Survey</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Site Details</Text>
        <LabeledInput label="Site Name" value={form.site_name} onChangeText={v => set('site_name', v)} placeholder="e.g. Bangunan Public Bank" />
        <LabeledInput label="Site Location" value={form.site_location} onChangeText={v => set('site_location', v)} placeholder="Address / building" />
        <LabeledInput label="Person In Charge Name" value={form.pic_name} onChangeText={v => set('pic_name', v)} placeholder="e.g. Mr. Jaya" />
        <LabeledInput label="Person In Charge No" value={form.pic_no} onChangeText={v => set('pic_no', v)} placeholder="+60-12-345 6789" keyboardType="phone-pad" />

        <Text style={styles.label}>Site</Text>
        <ChipField value={form.site_type} onChange={v => set('site_type', v)} options={SITE_TYPE} />
        <Text style={styles.label}>Type of Job</Text>
        <ChipField value={form.job_type} onChange={v => set('job_type', v)} options={JOB_TYPE} />

        <Text style={styles.sectionTitle}>Doors</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><LabeledInput label="No of Doors" value={form.no_of_doors} onChangeText={v => set('no_of_doors', v)} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><LabeledInput label="Door License" value={form.door_license} onChangeText={v => set('door_license', v)} keyboardType="numeric" /></View>
        </View>
        <LabeledInput label="Type of Doors" value={form.type_of_doors} onChangeText={v => set('type_of_doors', v)} placeholder="e.g. Reader In & Reader Out" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><LabeledInput label="Double Leaf Doors" value={form.double_leaf_doors} onChangeText={v => set('double_leaf_doors', v)} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><LabeledInput label="Single Leaf Doors" value={form.single_leaf_doors} onChangeText={v => set('single_leaf_doors', v)} keyboardType="numeric" /></View>
        </View>
        <LabeledInput label="Type of Reader" value={form.type_of_reader} onChangeText={v => set('type_of_reader', v)} placeholder="e.g. Face Reader, Card Reader" />
        <LabeledInput label="Shift Patterns" value={form.shift_patterns} onChangeText={v => set('shift_patterns', v)} placeholder="e.g. 3 shifts, 24hr" />

        <Text style={styles.sectionTitle}>Backend Installation Area</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><LabeledInput label="No. of Controller Required" value={form.no_of_controllers} onChangeText={v => set('no_of_controllers', v)} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><LabeledInput label="No. of Sub-Controllers" value={form.no_of_sub_controllers} onChangeText={v => set('no_of_sub_controllers', v)} keyboardType="numeric" /></View>
        </View>
        <LabeledInput label="Type of Controller" value={form.type_of_controller} onChangeText={v => set('type_of_controller', v)} />
        <LabeledInput label="Type of Sub Controller" value={form.type_of_sub_controller} onChangeText={v => set('type_of_sub_controller', v)} placeholder="e.g. 4IN 2OUT Wiegand Module" />
        <LabeledInput label="Power Supply Required" value={form.power_supply_required} onChangeText={v => set('power_supply_required', v)} keyboardType="numeric" />

        <Text style={styles.label}>Cabling by InfiniteQL</Text>
        <ChipField value={form.cabling_by_infiniteql} onChange={v => set('cabling_by_infiniteql', v)} options={YES_NO} />
        <LabeledInput label="Hacking and Drill Requirement" value={form.hacking_drill} onChangeText={v => set('hacking_drill', v)} multiline />
        <LabeledInput label="Cable Measurement" value={form.cable_measurement} onChangeText={v => set('cable_measurement', v)} placeholder="e.g. 1xCat6, 2xAlarm cable (5m)..." multiline />

        <Text style={styles.label}>Installation & Termination Work</Text>
        <ChipField value={form.installation_termination} onChange={v => set('installation_termination', v)} options={YES_NO} />
        <Text style={styles.label}>Existing Fire Signal</Text>
        <ChipField value={form.existing_fire_signal} onChange={v => set('existing_fire_signal', v)} options={YES_NO} />
        <LabeledInput label="Drawing / Layout Planning Required" value={form.drawing_layout_required} onChangeText={v => set('drawing_layout_required', v)} />

        <Text style={styles.label}>Touch-Up & Make Good</Text>
        <ChipField value={form.touch_up_make_good} onChange={v => set('touch_up_make_good', v)} options={YES_NO} />
        <LabeledInput label="Type of Touch Up" value={form.type_of_touch_up} onChangeText={v => set('type_of_touch_up', v)} placeholder="e.g. Minor (Plaster & etc)" />
        <LabeledInput label="Paint Job" value={form.paint_job} onChangeText={v => set('paint_job', v)} />

        <Text style={styles.sectionTitle}>Notes & Sign-Off</Text>
        <LabeledInput label="Notes" value={form.notes} onChangeText={v => set('notes', v)} placeholder="Any additional remarks..." multiline />
        <LabeledInput label="Site Survey Done By" value={form.surveyed_by} onChangeText={v => set('surveyed_by', v)} placeholder="Engineer name" />
        <DatePickerField label="Date of Survey" placeholder="Select date" value={form.survey_date} onChange={v => set('survey_date', v)} />

        <Text style={styles.label}>Time of Survey</Text>
        <View style={styles.autoField}>
          <Text style={form.survey_time ? styles.autoValue : styles.autoPlaceholder}>
            {form.survey_time || 'Auto-recorded when you save'}
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={[styles.pdfBtn, downloading && { opacity: 0.6 }]} onPress={downloadPdf} disabled={downloading}>
          {downloading ? <ActivityIndicator color="#f97316" /> : <Text style={styles.pdfBtnText}>⬇ Download PDF</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Survey</Text>}
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

  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 26, marginBottom: 4 },
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
    color: '#fff', fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524', backgroundColor: '#1c1917',
  },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  autoField: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524', borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  autoValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  autoPlaceholder: { color: '#6b7280', fontSize: 14, fontStyle: 'italic' },

  errorText: { color: '#ef4444', fontSize: 13, marginTop: 16 },

  pdfBtn: {
    marginTop: 28, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)',
  },
  pdfBtnText: { color: '#f97316', fontSize: 15, fontWeight: '700' },

  submitBtn: {
    marginTop: 12, backgroundColor: '#f97316', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

