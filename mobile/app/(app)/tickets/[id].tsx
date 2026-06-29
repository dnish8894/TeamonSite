import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Modal,
  TextInput, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'
import { supabase } from '@/lib/supabase'
import { uploadBase64 } from '@/lib/upload'
import type { Ticket, TicketActivity, JobReport, Part, ReportPhoto } from '@/lib/types'

const JOB_STATUSES = [
  { value: 'under_monitoring', label: 'Under Monitoring' },
  { value: 'resolved',         label: 'Issue Resolved' },
  { value: 'equipment_faulty', label: 'Equipment Faulty — Need Replacement' },
]
const emptyPart: Part = { device: '', qty: '1', model: '', serial_no: '', remarks: '' }
const emptyReport: JobReport = {
  ticket_id: '', engineer_id: null,
  findings: '', root_cause: '', work_done: '', recommendation: '',
  job_status: 'in_progress', remarks: '', parts_used: [],
  reported_by: '', reported_date: new Date().toISOString().split('T')[0], engineer_signature: null,
  client_name: '', client_date: new Date().toISOString().split('T')[0], client_signature: null,
}

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#ef4444', P2: '#f97316', P3: '#facc15', P4: '#60a5fa',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#ef4444', assigned: '#f97316', in_progress: '#facc15',
  pending_parts: '#a78bfa', pending_client: '#60a5fa',
  resolved: '#34d399', closed: '#6b7280', cancelled: '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In Progress',
  pending_parts: 'Pending Parts', pending_client: 'Pending Client',
  resolved: 'Resolved', closed: 'Closed', cancelled: 'Cancelled',
}
const TYPE_LABEL: Record<string, string> = {
  breakdown: 'Breakdown', preventive_maintenance: 'Preventive Maintenance',
  installation: 'Installation', inspection: 'Inspection', relocation: 'Relocation',
}

export default function TicketDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()
  const [ticket,     setTicket]     = useState<Ticket | null>(null)
  const [activities, setActivities] = useState<TicketActivity[]>([])
  const [loading,    setLoading]    = useState(true)
  const [photos,     setPhotos]     = useState<ReportPhoto[]>([])
  const [photoLabel, setPhotoLabel] = useState<'before' | 'after'>('before')
  const [uploading,  setUploading]  = useState(false)
  const [report,     setReport]     = useState<JobReport>(emptyReport)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportSaved,  setReportSaved]  = useState(false)
  const [showEngSig, setShowEngSig] = useState(false)
  const [showCliSig, setShowCliSig] = useState(false)
  const engSigRef = useRef<SignatureViewRef>(null)
  const cliSigRef = useRef<SignatureViewRef>(null)
  const [workSaving, setWorkSaving] = useState(false)
  const [tick, setTick] = useState(0)
  const [showFaultyOptions, setShowFaultyOptions] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pendingFaultyAction, setPendingFaultyAction] = useState<'pause' | 'complete' | null>(null)
  const [showProcurementModal, setShowProcurementModal] = useState(false)
  const [equipmentDesc, setEquipmentDesc] = useState('')
  const [requestType, setRequestType] = useState<'warranty' | 'preventive_maintenance' | 'quotation'>('warranty')
  const [procurementSaving, setProcurementSaving] = useState(false)
  const [org, setOrg] = useState<{
    name: string; address: string | null; phone: string | null; email: string | null
    logo_url: string | null; report_settings: { report_title?: string } | null
  } | null>(null)

  async function load() {
    const [{ data: t }, { data: a }, { data: o }] = await Promise.all([
      supabase.from('tickets')
        .select('id,ticket_no,title,description,type,priority,status,created_at,resolved_at,sla_resolve_due,quotation_no,reporter_name,reporter_phone,assigned_to,work_status,work_seconds,work_last_resume_at,work_started_at,work_completed_at,sites(id,name,city,state,site_contact,site_phone,pm_classification,contract_type,clients(name),site_contacts(name,title,phone,is_primary)),elv_systems(id,name,type),devices(name,tag_id,work_at_height,work_at_height_notes,warranty_expiry,vendor_warranty_end,under_contract,last_service_date),created_by_user:created_by(full_name)')
        .eq('id', id).single(),
      supabase.from('ticket_activities')
        .select('id,ticket_id,action,note,old_value,new_value,created_at')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('organisations').select('name,address,phone,email,logo_url,report_settings').limit(1).single(),
    ])
    setTicket(t as unknown as Ticket)
    setActivities((a ?? []) as TicketActivity[])
    setOrg(o ?? null)

    // Load existing Field Service Report, if any
    const { data: r } = await supabase.from('job_reports').select('*').eq('ticket_id', id).single()
    if (r) {
      setReport({
        ticket_id: id, engineer_id: r.engineer_id,
        findings: r.findings ?? '', root_cause: r.root_cause ?? '',
        work_done: r.work_done ?? '', recommendation: r.recommendation ?? '',
        job_status: r.job_status ?? 'in_progress', remarks: r.remarks ?? '',
        parts_used: r.parts_used?.length ? r.parts_used : [],
        reported_by: r.reported_by ?? '', reported_date: r.reported_date ?? emptyReport.reported_date,
        engineer_signature: r.engineer_signature ?? null,
        client_name: r.client_name ?? '', client_date: r.client_date ?? emptyReport.client_date,
        client_signature: r.client_signature ?? null,
      })
      setPhotos(r.photos?.length ? r.photos : [])
    } else {
      setReport({ ...emptyReport, ticket_id: id as string, engineer_id: (t as unknown as Ticket)?.assigned_to ?? null })
      setPhotos([])
    }
    setLoading(false)
  }

  function setR<K extends keyof JobReport>(key: K, value: JobReport[K]) {
    setReport(r => ({ ...r, [key]: value }))
  }

  function addPart() {
    setReport(r => ({ ...r, parts_used: [...r.parts_used, { ...emptyPart }] }))
  }
  function removePart(i: number) {
    setReport(r => ({ ...r, parts_used: r.parts_used.filter((_, idx) => idx !== i) }))
  }
  function setPart(i: number, key: keyof Part, value: string) {
    setReport(r => {
      const parts = [...r.parts_used]
      parts[i] = { ...parts[i], [key]: value }
      return { ...r, parts_used: parts }
    })
  }

  async function saveReport() {
    setReportSaving(true)
    const { error } = await supabase.from('job_reports').upsert({
      ticket_id: id,
      engineer_id: report.engineer_id,
      findings: report.findings || null,
      root_cause: report.root_cause || null,
      work_done: report.work_done || null,
      recommendation: report.recommendation || null,
      onsite_time: onSiteSpanText(),
      job_status: report.job_status,
      remarks: report.remarks || null,
      parts_used: report.parts_used.filter(p => p.device.trim()),
      reported_by: report.reported_by || null,
      reported_date: report.reported_date || null,
      engineer_signature: report.engineer_signature || null,
      client_name: report.client_name || null,
      client_date: report.client_date || null,
      client_signature: report.client_signature || null,
    }, { onConflict: 'ticket_id' })
    setReportSaving(false)
    if (error) { Alert.alert('Save Failed', error.message); return }
    setReportSaved(true)
    setTimeout(() => setReportSaved(false), 2500)
  }

  async function uploadPhoto(base64: string, uri: string) {
    setUploading(true)
    let publicUrl: string
    try {
      publicUrl = await uploadBase64(base64, uri, 'ticket-photos', `${id}/${photoLabel}`)
    } catch (e) {
      setUploading(false); Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload photo.'); return
    }

    const newPhoto: ReportPhoto = { url: publicUrl, label: photoLabel, caption: '', taken_at: new Date().toISOString() }
    const updatedPhotos = [...photos, newPhoto]

    await supabase.from('job_reports').upsert({
      ticket_id: id,
      engineer_id: report.engineer_id,
      photos: updatedPhotos,
    }, { onConflict: 'ticket_id' })

    setPhotos(updatedPhotos)
    setUploading(false)
  }

  async function removePhoto(url: string) {
    const updatedPhotos = photos.filter(p => p.url !== url)
    await supabase.from('job_reports').update({ photos: updatedPhotos }).eq('ticket_id', id)
    setPhotos(updatedPhotos)
    const path = url.split('/ticket-photos/')[1]
    if (path) await supabase.storage.from('ticket-photos').remove([path])
  }

  useEffect(() => { load() }, [id])

  // Live ticking clock while work is in progress
  useEffect(() => {
    if (ticket?.work_status !== 'in_progress') return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [ticket?.work_status])

  function elapsedSeconds(): number {
    if (!ticket) return 0
    let secs = ticket.work_seconds ?? 0
    if (ticket.work_status === 'in_progress' && ticket.work_last_resume_at) {
      secs += Math.floor((Date.now() - new Date(ticket.work_last_resume_at).getTime()) / 1000)
    }
    return secs
  }

  function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function onSiteSpanText(): string {
    if (!ticket?.work_started_at) return '—'
    const fmt = (d: string) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
    const start = fmt(ticket.work_started_at)
    const end = ticket.work_completed_at ? fmt(ticket.work_completed_at) : 'In Progress'
    return `${start} → ${end}`
  }

  async function doWorkAction(action: 'start' | 'pause' | 'resume' | 'complete', statusOverride?: string) {
    if (!ticket) return

    if (action === 'complete' && (!report.engineer_signature || !report.client_signature)) {
      Alert.alert(
        'Signatures Required',
        'Both the engineer and client signature must be filled in before the job can be marked complete.'
      )
      return
    }

    setWorkSaving(true)
    const now = new Date()
    const updates: Record<string, unknown> = {}

    if (action === 'start') {
      updates.work_status = 'in_progress'
      updates.work_started_at = now.toISOString()
      updates.work_last_resume_at = now.toISOString()
      updates.status = 'in_progress'
    } else if (action === 'pause') {
      const elapsed = ticket.work_last_resume_at
        ? Math.floor((now.getTime() - new Date(ticket.work_last_resume_at).getTime()) / 1000)
        : 0
      updates.work_status = 'paused'
      updates.work_seconds = (ticket.work_seconds ?? 0) + elapsed
      updates.work_last_resume_at = null
      if (statusOverride) updates.status = statusOverride
    } else if (action === 'resume') {
      updates.work_status = 'in_progress'
      updates.work_last_resume_at = now.toISOString()
      updates.status = 'in_progress'
    } else if (action === 'complete') {
      let elapsed = 0
      if (ticket.work_status === 'in_progress' && ticket.work_last_resume_at) {
        elapsed = Math.floor((now.getTime() - new Date(ticket.work_last_resume_at).getTime()) / 1000)
      }
      updates.work_status = 'completed'
      updates.work_seconds = (ticket.work_seconds ?? 0) + elapsed
      updates.work_last_resume_at = null
      updates.work_completed_at = now.toISOString()
      updates.status = statusOverride ?? 'resolved'
      updates.resolved_at = now.toISOString()
    }

    const { error } = await supabase.from('tickets').update(updates).eq('id', id)
    setWorkSaving(false)
    if (error) { Alert.alert('Error', error.message); return }

    await supabase.from('ticket_activities').insert({ ticket_id: id, action: 'work_' + action })
    load()
  }

  async function handleJobStatusSelect(value: string) {
    setR('job_status', value)
    if (value === 'equipment_faulty') {
      setShowFaultyOptions(true)
    } else if (value === 'resolved') {
      await saveReport()
      await doWorkAction('complete', 'resolved')
    }
    // under_monitoring: just stays saved as a report field, no ticket/timer action
  }

  // Non-comprehensive contracts (or device not under contract) → parts are chargeable,
  // so default the request toward a quotation.
  function defaultRequestType(): 'warranty' | 'preventive_maintenance' | 'quotation' {
    const cls = ticket?.sites?.pm_classification
    const covered = ticket?.devices?.under_contract
    if (cls === 'non_comprehensive' || covered === false) return 'quotation'
    return 'warranty'
  }

  function handleFaultyPause() {
    setShowFaultyOptions(false)
    setPendingFaultyAction('pause')
    setRequestType(defaultRequestType())
    setShowProcurementModal(true)
  }

  function handleFaultyComplete() {
    setShowFaultyOptions(false)
    setPendingFaultyAction('complete')
    setRequestType(defaultRequestType())
    setShowProcurementModal(true)
  }

  async function submitProcurementRequest() {
    if (!ticket || !pendingFaultyAction) return
    if (!equipmentDesc.trim()) { Alert.alert('Missing Info', 'Please describe the equipment.'); return }

    setProcurementSaving(true)
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL
      if (apiUrl) {
        await fetch(`${apiUrl}/api/part-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: ticket.id,
            equipment_description: equipmentDesc.trim(),
            request_type: requestType,
          }),
        })
      }
    } catch {
      // Procurement notification is best-effort — don't block the engineer's workflow on a network hiccup
    }

    setProcurementSaving(false)
    setShowProcurementModal(false)
    setEquipmentDesc('')
    setRequestType('warranty')

    await saveReport()
    await doWorkAction(pendingFaultyAction, 'pending_parts')
    setPendingFaultyAction(null)
  }

  async function savePdf() {
    if (!ticket) return
    setPdfLoading(true)
    try {
      const before = photos.filter(p => p.label === 'before')
      const after  = photos.filter(p => p.label === 'after')
      const photoRow = (label: string, list: ReportPhoto[]) => `
        <div class="photoCol">
          <p class="photoColLabel">${label} (${list.length})</p>
          ${list.map(p => `<img class="photo" src="${p.url}" />`).join('') || '<p class="muted">No photos.</p>'}
        </div>`

      const partsRows = report.parts_used.length
        ? report.parts_used.map(p => `
            <tr><td>${p.device}</td><td>${p.qty}</td><td>${p.model}</td><td>${p.serial_no}</td><td>${p.remarks}</td></tr>
          `).join('')
        : '<tr><td colspan="5" class="muted">No parts used.</td></tr>'

      const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
      const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
      const clientName = (ticket.sites as unknown as { clients?: { name: string } })?.clients?.name ?? '—'
      const jobStatusLabel = (report.job_status ?? ticket.status).replace(/_/g, ' ').toUpperCase()

      const kvRow = (lk: string, lv: string, rk: string, rv: string) => `
        <tr><td class="k">${lk}</td><td class="v">${lv}</td><td class="k">${rk}</td><td class="v">${rv}</td></tr>`

      const reportTitle = org?.report_settings?.report_title || 'FIELD SERVICE REPORT'

      const html = `
        <html>
          <head><meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; color: #1a1a1a; }
              .header { background: #1e2130; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: flex-start; }
              .headerLeft { display: flex; align-items: center; gap: 12px; }
              .orgLogo { width: 44px; height: 44px; object-fit: contain; border-radius: 6px; background: #fff; }
              .orgName { font-size: 22px; font-weight: 700; margin: 0; }
              .orgSub { font-size: 12px; color: #cbd5e1; margin-top: 4px; }
              .callIdBox { background: #fff; border-radius: 6px; padding: 8px 16px; text-align: center; }
              .callIdLabel { font-size: 10px; font-weight: 700; color: #888; letter-spacing: 0.5px; }
              .callIdValue { font-size: 16px; font-weight: 700; color: #1e2130; margin-top: 2px; }
              .body { padding: 24px 28px; }
              h1 { font-size: 22px; text-align: center; margin: 4px 0 20px; }
              h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; margin-top: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
              p { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
              .muted { color: #999; }
              .breakdownBox { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
              .breakdownTitle { background: #1e2130; color: #fff; text-align: center; font-size: 13px; font-weight: 700; padding: 8px; }
              .breakdownTable { width: 100%; border-collapse: collapse; background: #f5f7fa; }
              .breakdownTable td { padding: 7px 14px; font-size: 12.5px; }
              .breakdownTable td.k { color: #666; font-weight: 700; width: 18%; }
              .breakdownTable td.v { color: #111; width: 32%; }
              table.dataTable { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
              table.dataTable th, table.dataTable td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
              table.dataTable th { background: #f5f5f5; }
              .row2 { display: flex; gap: 16px; }
              .col { flex: 1; }
              .photoRow { display: flex; gap: 16px; margin-top: 8px; }
              .photoCol { flex: 1; }
              .photoColLabel { font-size: 11px; font-weight: 700; color: #555; margin-bottom: 6px; }
              img.photo { width: 100%; max-height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; }
              img.sig { width: 220px; height: 80px; object-fit: contain; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
              .sigBlock { margin-top: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="headerLeft">
                ${org?.logo_url ? `<img class="orgLogo" src="${org.logo_url}" />` : ''}
                <div>
                  <p class="orgName">${org?.name ?? '—'}</p>
                  <p class="orgSub">${[org?.address, org?.phone ? `Tel: ${org.phone}` : null, org?.email].filter(Boolean).join('  ·  ')}</p>
                </div>
              </div>
              <div class="callIdBox">
                <div class="callIdLabel">CALL ID</div>
                <div class="callIdValue">${ticket.ticket_no}</div>
              </div>
            </div>

            <div class="body">
              <h1>${reportTitle}</h1>

              <div class="breakdownBox">
                <div class="breakdownTitle">Breakdown Details</div>
                <table class="breakdownTable">
                  ${kvRow('Company', clientName, 'Tech. Name', report.reported_by || '—')}
                  ${kvRow('Site Name', ticket.sites?.name ?? '—', 'Response Date', fmtDate(ticket.created_at))}
                  ${kvRow('Reported By', ticket.reporter_name ?? '—', 'Response Time', fmtTime(ticket.created_at))}
                  ${kvRow('Log Date', fmtDate(ticket.created_at), 'Log Time', fmtTime(ticket.created_at))}
                  ${kvRow('On-Site Time', onSiteSpanText(), 'Target Resolve', fmtTime(ticket.sla_resolve_due))}
                  ${kvRow('Priority', ticket.priority, 'System', ticket.elv_systems?.type?.replace(/_/g, ' ') ?? '—')}
                  ${kvRow('Job Type', ticket.type.replace(/_/g, ' '), 'Severity', ticket.priority)}
                  ${kvRow('Job Status', jobStatusLabel, 'Quotation No.', ticket.quotation_no ?? '—')}
                </table>
              </div>

              <h2>Description of Problem</h2>
              <p>${ticket.description ?? '—'}</p>

            <div class="row2">
              <div class="col">
                <h2>Inspection / Observation</h2>
                <p>${report.findings || '—'}</p>
              </div>
              <div class="col">
                <h2>Root Cause</h2>
                <p>${report.root_cause || '—'}</p>
              </div>
            </div>

            <div class="row2">
              <div class="col">
                <h2>Action Taken</h2>
                <p>${report.work_done || '—'}</p>
              </div>
              <div class="col">
                <h2>Recommendations</h2>
                <p>${report.recommendation || '—'}</p>
              </div>
            </div>

            <h2>Details of Part(s) Replacement</h2>
            <table class="dataTable">
              <tr><th>Device</th><th>Qty</th><th>Model</th><th>Serial No.</th><th>Remarks</th></tr>
              ${partsRows}
            </table>

            <h2>Remarks</h2>
            <p>${report.remarks || '—'}</p>

            <h2>Photos</h2>
            <div class="photoRow">
              ${photoRow('BEFORE', before)}
              ${photoRow('AFTER', after)}
            </div>

            <h2>Acknowledgement</h2>
            <div class="row2">
              <div class="col">
                <p><strong>Engineer:</strong> ${report.reported_by || '—'}</p>
                <div class="sigBlock">${report.engineer_signature ? `<img class="sig" src="${report.engineer_signature}" />` : '<p class="muted">No signature.</p>'}</div>
              </div>
              <div class="col">
                <p><strong>Client:</strong> ${report.client_name || '—'}</p>
                <div class="sigBlock">${report.client_signature ? `<img class="sig" src="${report.client_signature}" />` : '<p class="muted">No signature.</p>'}</div>
              </div>
            </div>
            </div>
          </body>
        </html>
      `

      const { uri } = await Print.printToFileAsync({ html })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${ticket.ticket_no} Field Service Report` })
      } else {
        Alert.alert('PDF Saved', `Saved to: ${uri}`)
      }
    } catch (err) {
      Alert.alert('Failed to generate PDF', err instanceof Error ? err.message : 'Unknown error')
    }
    setPdfLoading(false)
  }

  async function pickAndUploadPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    })
    if (result.canceled || !result.assets[0]?.base64) return
    await uploadPhoto(result.assets[0].base64, result.assets[0].uri)
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
    if (result.canceled || !result.assets[0]?.base64) return
    await uploadPhoto(result.assets[0].base64, result.assets[0].uri)
  }

  if (loading) return (
    <View style={styles.loadingBg}>
      <ActivityIndicator color="#f97316" size="large" />
    </View>
  )
  if (!ticket) return (
    <View style={styles.loadingBg}>
      <Text style={{ color: '#6b7280' }}>Ticket not found.</Text>
    </View>
  )

  const pc = PRIORITY_COLOR[ticket.priority] ?? '#6b7280'
  const sc = STATUS_COLOR[ticket.status]    ?? '#6b7280'

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTicketNo}>{ticket.ticket_no}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Priority + Status badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: pc + '20' }]}>
            <Text style={[styles.badgeText, { color: pc }]}>{ticket.priority} — {ticket.priority === 'P1' ? 'Critical' : ticket.priority === 'P2' ? 'High' : ticket.priority === 'P3' ? 'Medium' : 'Low'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc + '20' }]}>
            <Text style={[styles.badgeText, { color: sc }]}>{STATUS_LABEL[ticket.status] ?? ticket.status}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.typeText}>{TYPE_LABEL[ticket.type] ?? ticket.type}</Text>

        {/* Work Timer */}
        <View key={tick} style={styles.timerCard}>
          <Text style={styles.timerLabel}>WORK TIMER</Text>
          <Text style={styles.timerClock}>{formatDuration(elapsedSeconds())}</Text>
          <Text style={[styles.timerStatus, {
            color: ticket.work_status === 'in_progress' ? '#34d399'
              : ticket.work_status === 'paused' ? '#facc15'
              : ticket.work_status === 'completed' ? '#60a5fa' : '#6b7280',
          }]}>
            {ticket.work_status.replace('_', ' ').toUpperCase()}
          </Text>

          <View style={styles.timerBtnRow}>
            {ticket.work_status === 'not_started' && (
              <TouchableOpacity style={styles.timerBtnPrimary} onPress={() => doWorkAction('start')} disabled={workSaving}>
                {workSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.timerBtnPrimaryText}>▶ Start (Set to In Progress)</Text>}
              </TouchableOpacity>
            )}
            {ticket.work_status === 'in_progress' && (
              <TouchableOpacity style={styles.timerBtnPrimary} onPress={() => doWorkAction('pause')} disabled={workSaving}>
                {workSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.timerBtnPrimaryText}>⏸ Pause</Text>}
              </TouchableOpacity>
            )}
            {ticket.work_status === 'paused' && (
              <TouchableOpacity style={styles.timerBtnPrimary} onPress={() => doWorkAction('resume')} disabled={workSaving}>
                {workSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.timerBtnPrimaryText}>▶ Resume</Text>}
              </TouchableOpacity>
            )}
            {ticket.work_status === 'completed' && (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={styles.timerDoneText}>✓ Work completed</Text>
                <TouchableOpacity style={styles.pdfBtn} onPress={savePdf} disabled={pdfLoading}>
                  {pdfLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.pdfBtnText}>📄 Save Report as PDF</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {ticket.work_status === 'not_started' && (
            <Text style={styles.timerHint}>1. Start  →  2. Save the report  →  3. Pick a Job Status below to finish.</Text>
          )}
          {(ticket.work_status === 'in_progress' || ticket.work_status === 'paused') && (
            <Text style={styles.timerHint}>Save your report, then choose a Job Status below to complete or pause.</Text>
          )}
        </View>

        {/* Description */}
        {ticket.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.bodyText}>{ticket.description}</Text>
          </View>
        ) : null}

        {/* Site info */}
        {ticket.sites && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Site</Text>
            <Text style={styles.bodyTextBold}>{ticket.sites.name}</Text>
            {(ticket.sites as any).city && <Text style={styles.bodyText}>{(ticket.sites as any).city}, {(ticket.sites as any).state ?? ''}</Text>}
            {(ticket.sites as any).site_contact && (
              <Text style={styles.bodyText}>Contact: {(ticket.sites as any).site_contact}</Text>
            )}
            {(ticket.sites as any).site_phone && (
              <Text style={[styles.bodyText, { color: '#60a5fa' }]}>📞 {(ticket.sites as any).site_phone}</Text>
            )}
            {(ticket.sites.site_contacts ?? []).length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Text style={[styles.bodyText, { color: '#6b7280', fontSize: 12, fontWeight: '700' }]}>PEOPLE IN CHARGE</Text>
                {(ticket.sites.site_contacts ?? []).map((c, i) => (
                  <View key={i} style={{ marginTop: 4 }}>
                    <Text style={styles.bodyTextBold}>
                      {c.name}{c.title ? ` · ${c.title}` : ''}{c.is_primary ? ' ⭐' : ''}
                    </Text>
                    {c.phone && <Text style={[styles.bodyText, { color: '#60a5fa' }]}>📞 {c.phone}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* System */}
        {ticket.elv_systems && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ELV System</Text>
            <Text style={styles.bodyTextBold}>{ticket.elv_systems.name}</Text>
            <Text style={styles.bodyText}>{ticket.elv_systems.type.replace(/_/g,' ').toUpperCase()}</Text>
          </View>
        )}

        {/* Device + work-at-height warning */}
        {ticket.devices && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Device</Text>
            <Text style={styles.bodyTextBold}>
              {ticket.devices.name}{ticket.devices.tag_id ? ` · ${ticket.devices.tag_id}` : ''}
            </Text>
            {ticket.devices.last_service_date && (
              <Text style={styles.bodyText}>
                Last serviced: {new Date(ticket.devices.last_service_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
            {(ticket.devices.warranty_expiry || ticket.devices.vendor_warranty_end) && (
              <Text style={styles.bodyText}>
                {ticket.devices.warranty_expiry ? `Client warranty until ${new Date(ticket.devices.warranty_expiry).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                {ticket.devices.warranty_expiry && ticket.devices.vendor_warranty_end ? '  ·  ' : ''}
                {ticket.devices.vendor_warranty_end ? `Vendor warranty until ${new Date(ticket.devices.vendor_warranty_end).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </Text>
            )}
            {ticket.devices.work_at_height && (
              <View style={styles.heightWarning}>
                <Text style={styles.heightWarningText}>
                  ⚠️ Work-at-height equipment required (ladder / scaffold)
                </Text>
                {ticket.devices.work_at_height_notes ? (
                  <Text style={styles.heightWarningNote}>{ticket.devices.work_at_height_notes}</Text>
                ) : null}
              </View>
            )}
            {ticket.sites?.contract_type === 'maintenance' && ticket.sites.pm_classification && (
              <Text style={[styles.bodyText, { marginTop: 6, color: ticket.sites.pm_classification === 'comprehensive' ? '#34d399' : '#facc15', fontWeight: '700' }]}>
                {ticket.sites.pm_classification === 'comprehensive' ? 'Comprehensive — parts covered' : 'Non-Comprehensive — parts chargeable'}
                {ticket.devices.under_contract === false ? ' · Device NOT under contract' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Reporter */}
        {ticket.reporter_name && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reported By</Text>
            <Text style={styles.bodyTextBold}>{ticket.reporter_name}</Text>
            {ticket.reporter_phone && (
              <Text style={[styles.bodyText, { color: '#60a5fa' }]}>📞 {ticket.reporter_phone}</Text>
            )}
          </View>
        )}

        {/* Quotation No */}
        {ticket.quotation_no && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Quotation No.</Text>
            <Text style={styles.bodyTextBold}>{ticket.quotation_no}</Text>
          </View>
        )}

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Timeline</Text>
          <Text style={styles.bodyText}>
            Created: {new Date(ticket.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            {ticket.created_by_user?.full_name ? ` by ${ticket.created_by_user.full_name}` : ''}
          </Text>
          {ticket.resolved_at && (
            <Text style={styles.bodyText}>
              Resolved: {new Date(ticket.resolved_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' })}
            </Text>
          )}
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photos ({photos.length})</Text>

          {/* Before / After label toggle */}
          <View style={styles.labelToggleRow}>
            {(['before', 'after'] as const).map(l => (
              <TouchableOpacity key={l}
                style={[styles.labelToggle, photoLabel === l && (l === 'before' ? styles.labelToggleBefore : styles.labelToggleAfter)]}
                onPress={() => setPhotoLabel(l)}>
                <Text style={[styles.labelToggleText, photoLabel === l && { color: '#fff' }]}>
                  {l === 'before' ? 'Before' : 'After'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} disabled={uploading}>
              <Text style={styles.photoBtnText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickAndUploadPhoto} disabled={uploading}>
              <Text style={styles.photoBtnText}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>

          {uploading && <ActivityIndicator color="#f97316" style={{ marginVertical: 8 }} />}

          <View style={styles.photoCols}>
            {(['before', 'after'] as const).map(l => {
              const list = photos.filter(p => p.label === l)
              return (
                <View key={l} style={styles.photoCol}>
                  <Text style={[styles.photoColLabel, { color: l === 'before' ? '#60a5fa' : '#34d399' }]}>
                    {l.toUpperCase()} ({list.length})
                  </Text>
                  {list.length === 0 ? (
                    <Text style={styles.emptyPhotoText}>No {l} photos.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {list.map((p, i) => (
                        <TouchableOpacity key={i} onLongPress={() => removePhoto(p.url)}>
                          <Image source={{ uri: p.url }} style={styles.photo} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )
            })}
          </View>
          <Text style={styles.photoHint}>Long-press a photo to remove it.</Text>
        </View>

        {/* Field Service Report */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Field Service Report</Text>
            <TouchableOpacity style={styles.saveReportBtn} onPress={saveReport} disabled={reportSaving || ticket.work_status === 'not_started'}>
              {reportSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveReportBtnText}>{reportSaved ? '✓ Saved' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>

          {ticket.work_status === 'not_started' && (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedBannerText}>🔒 Start the Work Timer above before filling in this report.</Text>
            </View>
          )}

          <View pointerEvents={ticket.work_status === 'not_started' ? 'none' : 'auto'}
            style={ticket.work_status === 'not_started' ? { opacity: 0.4 } : undefined}>

          <Text style={styles.fsrLabel}>On-Site Time</Text>
          <View key={tick} style={styles.onSiteSpanBox}>
            <Text style={styles.onSiteSpanText}>{onSiteSpanText()}</Text>
            <Text style={styles.onSiteSpanHint}>From Work Timer start until completed.</Text>
          </View>

          <Text style={styles.fsrLabel}>Inspection / Observation</Text>
          <TextInput style={styles.fsrTextarea} multiline numberOfLines={3}
            placeholder="Describe what was found on-site..." placeholderTextColor="#6b7280"
            value={report.findings ?? ''} onChangeText={v => setR('findings', v)} />

          <Text style={styles.fsrLabel}>Root Cause Analysis</Text>
          <TextInput style={styles.fsrTextarea} multiline numberOfLines={3}
            placeholder="What caused the fault?" placeholderTextColor="#6b7280"
            value={report.root_cause ?? ''} onChangeText={v => setR('root_cause', v)} />

          <Text style={styles.fsrLabel}>Action Taken</Text>
          <TextInput style={styles.fsrTextarea} multiline numberOfLines={3}
            placeholder="What did you do to fix it?" placeholderTextColor="#6b7280"
            value={report.work_done ?? ''} onChangeText={v => setR('work_done', v)} />

          <Text style={styles.fsrLabel}>Recommendations</Text>
          <TextInput style={styles.fsrTextarea} multiline numberOfLines={2}
            placeholder="Any follow-up required?" placeholderTextColor="#6b7280"
            value={report.recommendation ?? ''} onChangeText={v => setR('recommendation', v)} />

          <Text style={styles.fsrLabel}>Job Status</Text>
          <Text style={styles.jobStatusHint}>
            Save your report first, then pick the outcome below.
          </Text>
          <View style={styles.jobStatusRow}>
            {JOB_STATUSES.map(s => (
              <TouchableOpacity key={s.value}
                style={[styles.jobStatusChip, report.job_status === s.value && styles.jobStatusChipActive]}
                onPress={() => handleJobStatusSelect(s.value)}
                disabled={ticket.work_status === 'completed' || workSaving}>
                <Text style={[styles.jobStatusChipText, report.job_status === s.value && { color: '#fff' }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fsrLabel}>Remarks</Text>
          <TextInput style={styles.fsrTextarea} multiline numberOfLines={2}
            placeholder="Any additional remarks..." placeholderTextColor="#6b7280"
            value={report.remarks ?? ''} onChangeText={v => setR('remarks', v)} />

          {/* Parts Used */}
          <View style={[styles.sectionRow, { marginTop: 10 }]}>
            <Text style={styles.fsrLabel}>Parts Used</Text>
            <TouchableOpacity style={styles.addPartBtn} onPress={addPart}>
              <Text style={styles.addPartBtnText}>+ Add Part</Text>
            </TouchableOpacity>
          </View>
          {report.parts_used.length === 0 ? (
            <Text style={styles.emptyPhotoText}>No parts added.</Text>
          ) : (
            report.parts_used.map((p, i) => (
              <View key={i} style={styles.partCard}>
                <View style={styles.partCardHeader}>
                  <Text style={styles.partCardIndex}>Part {i + 1}</Text>
                  <TouchableOpacity onPress={() => removePart(i)}>
                    <Text style={styles.partRemoveText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.fsrInput} placeholder="Device / Part name" placeholderTextColor="#6b7280"
                  value={p.device} onChangeText={v => setPart(i, 'device', v)} />
                <View style={styles.fsrRow}>
                  <View style={styles.fsrHalf}>
                    <TextInput style={styles.fsrInput} placeholder="Qty" placeholderTextColor="#6b7280"
                      keyboardType="number-pad" value={p.qty} onChangeText={v => setPart(i, 'qty', v)} />
                  </View>
                  <View style={styles.fsrHalf}>
                    <TextInput style={styles.fsrInput} placeholder="Model" placeholderTextColor="#6b7280"
                      value={p.model} onChangeText={v => setPart(i, 'model', v)} />
                  </View>
                </View>
                <View style={styles.fsrRow}>
                  <View style={styles.fsrHalf}>
                    <TextInput style={styles.fsrInput} placeholder="Serial No." placeholderTextColor="#6b7280"
                      value={p.serial_no} onChangeText={v => setPart(i, 'serial_no', v)} />
                  </View>
                  <View style={styles.fsrHalf}>
                    <TextInput style={styles.fsrInput} placeholder="Remarks" placeholderTextColor="#6b7280"
                      value={p.remarks} onChangeText={v => setPart(i, 'remarks', v)} />
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Acknowledgement / Signatures */}
          <Text style={[styles.fsrLabel, { marginTop: 14 }]}>Acknowledgement</Text>

          <View style={styles.sigBlock}>
            <Text style={styles.sigBlockTitle}>Tech / Engineer</Text>
            <TextInput style={styles.fsrInput} placeholder="Engineer name" placeholderTextColor="#6b7280"
              value={report.reported_by ?? ''} onChangeText={v => setR('reported_by', v)} />
            {report.engineer_signature ? (
              <View style={styles.sigPreviewWrap}>
                <Image source={{ uri: report.engineer_signature }} style={styles.sigPreview} resizeMode="contain" />
                <TouchableOpacity style={styles.sigClearBtn} onPress={() => setR('engineer_signature', null)}>
                  <Text style={styles.sigClearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.sigCaptureBtn} onPress={() => setShowEngSig(true)}>
                <Text style={styles.sigCaptureBtnText}>✍️ Tap to Sign</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sigBlock}>
            <Text style={[styles.sigBlockTitle, { color: '#34d399' }]}>Client Representative</Text>
            <TextInput style={styles.fsrInput} placeholder="Client name" placeholderTextColor="#6b7280"
              value={report.client_name ?? ''} onChangeText={v => setR('client_name', v)} />
            {report.client_signature ? (
              <View style={styles.sigPreviewWrap}>
                <Image source={{ uri: report.client_signature }} style={styles.sigPreview} resizeMode="contain" />
                <TouchableOpacity style={styles.sigClearBtn} onPress={() => setR('client_signature', null)}>
                  <Text style={styles.sigClearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.sigCaptureBtn} onPress={() => setShowCliSig(true)}>
                <Text style={styles.sigCaptureBtnText}>✍️ Tap to Sign</Text>
              </TouchableOpacity>
            )}
          </View>

          </View>
        </View>

        {/* Equipment Faulty — Pause or Complete (pending parts) */}
        <Modal visible={showFaultyOptions} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Equipment Faulty — Need Replacement</Text>
              <Text style={styles.faultyModalDesc}>
                A part needs to be ordered. Choose what to do with this ticket while you wait.
              </Text>

              <TouchableOpacity style={styles.faultyOptionBtn} onPress={handleFaultyPause} disabled={workSaving}>
                <Text style={styles.faultyOptionTitle}>⏸ Pause Task</Text>
                <Text style={styles.faultyOptionSub}>Order the part first, resume work later.</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.faultyOptionBtn, { marginTop: 10 }]} onPress={handleFaultyComplete} disabled={workSaving}>
                <Text style={styles.faultyOptionTitle}>✓ Complete Now — Part Pending</Text>
                <Text style={styles.faultyOptionSub}>Your work here is done; part will be ordered separately.</Text>
              </TouchableOpacity>

              {workSaving && <ActivityIndicator color="#f97316" style={{ marginTop: 14 }} />}

              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setShowFaultyOptions(false)} disabled={workSaving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Procurement request — describe equipment + request type */}
        <Modal visible={showProcurementModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Request Replacement Part</Text>

              <Text style={styles.modalLabel}>Describe the Equipment</Text>
              <TextInput
                style={[styles.fsrTextarea, { marginBottom: 0 }]}
                placeholder="e.g. NVR Channel 4 power supply burnt out, needs replacement..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
                value={equipmentDesc}
                onChangeText={setEquipmentDesc}
              />

              <Text style={[styles.modalLabel, { marginTop: 16 }]}>Request Type</Text>
              <View style={styles.requestTypeRow}>
                {([
                  { value: 'warranty', label: 'Under Warranty' },
                  { value: 'preventive_maintenance', label: 'Preventive Maintenance' },
                  { value: 'quotation', label: 'Need Quotation' },
                ] as const).map(t => (
                  <TouchableOpacity key={t.value}
                    style={[styles.requestTypeChip, requestType === t.value && styles.requestTypeChipActive]}
                    onPress={() => setRequestType(t.value)}>
                    <Text style={[styles.requestTypeChipText, requestType === t.value && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowProcurementModal(false); setPendingFaultyAction(null) }} disabled={procurementSaving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, procurementSaving && { opacity: 0.6 }]} onPress={submitProcurementRequest} disabled={procurementSaving}>
                  {procurementSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.confirmBtnText}>Request</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Engineer signature modal */}
        <Modal visible={showEngSig} transparent animationType="slide">
          <View style={styles.sigModalOverlay}>
            <View style={styles.sigModalCard}>
              <Text style={styles.modalTitle}>Engineer Signature</Text>
              <View style={styles.sigCanvasWrap}>
                <SignatureScreen
                  ref={engSigRef}
                  onOK={(sig: string) => { setR('engineer_signature', sig); setShowEngSig(false) }}
                  webStyle=".m-signature-pad--footer {display: none;}"
                />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEngSig(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => engSigRef.current?.clearSignature()}>
                  <Text style={styles.cancelBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => engSigRef.current?.readSignature()}>
                  <Text style={styles.confirmBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Client signature modal */}
        <Modal visible={showCliSig} transparent animationType="slide">
          <View style={styles.sigModalOverlay}>
            <View style={styles.sigModalCard}>
              <Text style={styles.modalTitle}>Client Signature</Text>
              <View style={styles.sigCanvasWrap}>
                <SignatureScreen
                  ref={cliSigRef}
                  onOK={(sig: string) => { setR('client_signature', sig); setShowCliSig(false) }}
                  webStyle=".m-signature-pad--footer {display: none;}"
                />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCliSig(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cliSigRef.current?.clearSignature()}>
                  <Text style={styles.cancelBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => cliSigRef.current?.readSignature()}>
                  <Text style={styles.confirmBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Activity log */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Activity Log</Text>
            {activities.map(a => (
              <View key={a.id} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityAction}>
                    {a.action.replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    {a.old_value && a.new_value
                      ? `: ${STATUS_LABEL[a.old_value] ?? a.old_value} → ${STATUS_LABEL[a.new_value] ?? a.new_value}`
                      : ''}
                  </Text>
                  {a.note && <Text style={styles.activityNote}>{a.note}</Text>}
                  <Text style={styles.activityDate}>
                    {new Date(a.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating countdown badge */}
      {(ticket.work_status === 'in_progress' || ticket.work_status === 'paused') && (
        <View key={tick} style={styles.floatingTimer}>
          <View style={[styles.floatingDot, { backgroundColor: ticket.work_status === 'in_progress' ? '#34d399' : '#facc15' }]} />
          <Text style={styles.floatingTimerText}>{formatDuration(elapsedSeconds())}</Text>
          {ticket.work_status === 'paused' && <Text style={styles.floatingTimerPaused}>PAUSED</Text>}
        </View>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  timerCard: {
    backgroundColor: '#1c1917', borderRadius: 16, borderWidth: 1, borderColor: '#292524',
    padding: 18, alignItems: 'center', marginTop: 16, marginBottom: 6,
  },
  timerLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  timerClock: { color: '#fff', fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 6 },
  timerStatus: { fontSize: 12, fontWeight: '700', marginTop: 2, marginBottom: 12 },
  timerBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  timerBtnPrimary: { flex: 1, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  timerBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  timerBtnSecondary: { flex: 1, borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  timerBtnSecondaryText: { color: '#a8a29e', fontSize: 14, fontWeight: '700' },
  timerDoneText: { color: '#34d399', fontSize: 14, fontWeight: '700' },
  pdfBtn: { marginTop: 12, backgroundColor: '#60a5fa', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  pdfBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  timerHint: { color: '#6b7280', fontSize: 11, marginTop: 10, textAlign: 'center' },

  lockedBanner: { backgroundColor: 'rgba(250,204,21,0.12)', borderRadius: 10, padding: 10, marginBottom: 10 },
  lockedBannerText: { color: '#facc15', fontSize: 12, fontWeight: '600' },

  floatingTimer: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1c1917', borderRadius: 24, borderWidth: 1, borderColor: '#292524',
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  floatingDot: { width: 8, height: 8, borderRadius: 4 },
  floatingTimerText: { color: '#fff', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  floatingTimerPaused: { color: '#facc15', fontSize: 10, fontWeight: '700' },

  saveReportBtn:     { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveReportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  fsrRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  fsrHalf: { flex: 1 },
  fsrLabel: { color: '#a8a29e', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  fsrInput: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14,
  },
  fsrTextarea: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14, minHeight: 70, textAlignVertical: 'top', marginBottom: 4,
  },
  onSiteSpanBox: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4,
  },
  onSiteSpanText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  onSiteSpanHint: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  jobStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  jobStatusChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524',
  },
  jobStatusChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  jobStatusChipText: { color: '#a8a29e', fontSize: 12, fontWeight: '600' },
  jobStatusHint: { color: '#6b7280', fontSize: 11, marginTop: -4, marginBottom: 8 },

  faultyModalDesc: { color: '#a8a29e', fontSize: 13, marginBottom: 18, lineHeight: 19 },
  faultyOptionBtn: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 14, padding: 16,
  },
  faultyOptionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  faultyOptionSub: { color: '#6b7280', fontSize: 12 },

  requestTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  requestTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524',
  },
  requestTypeChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  requestTypeChipText: { color: '#a8a29e', fontSize: 12, fontWeight: '600' },

  labelToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' },
  labelToggle: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#292524',
  },
  labelToggleBefore: { backgroundColor: '#60a5fa', borderColor: '#60a5fa' },
  labelToggleAfter:  { backgroundColor: '#34d399', borderColor: '#34d399' },
  labelToggleText: { color: '#a8a29e', fontSize: 12, fontWeight: '700' },

  photoCols: { flexDirection: 'row', gap: 14, marginTop: 4 },
  photoCol:  { flex: 1 },
  photoColLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  emptyPhotoText: { color: '#6b7280', fontSize: 12 },
  photoHint: { color: '#44403c', fontSize: 11, marginTop: 8 },

  addPartBtn: { backgroundColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  addPartBtnText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  partCard: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, padding: 10, marginBottom: 10, gap: 8,
  },
  partCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  partCardIndex: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  partRemoveText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  sigBlock: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, padding: 12, marginTop: 10, gap: 8,
  },
  sigBlockTitle: { color: '#60a5fa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sigCaptureBtn: {
    borderWidth: 1, borderColor: '#292524', borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', backgroundColor: '#1c1917',
  },
  sigCaptureBtnText: { color: '#a8a29e', fontSize: 13, fontWeight: '600' },
  sigPreviewWrap: { backgroundColor: '#fff', borderRadius: 10, padding: 6, position: 'relative' },
  sigPreview: { width: '100%', height: 90 },
  sigClearBtn: {
    position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  sigClearBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  sigModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sigModalCard: {
    backgroundColor: '#1c1917', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: '#292524',
  },
  sigCanvasWrap: {
    height: 220, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#292524', backgroundColor: '#fff', marginTop: 12,
  },

  safe:      { flex: 1, backgroundColor: '#0c0a09' },
  loadingBg: { flex: 1, backgroundColor: '#0c0a09', alignItems: 'center', justifyContent: 'center' },
  scroll:    { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#292524',
  },
  backBtn:        { marginRight: 12 },
  backText:       { color: '#f97316', fontSize: 15, fontWeight: '600' },
  headerTicketNo: { color: '#a8a29e', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 10 },
  badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  title:    { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 6 },
  typeText: { color: '#6b7280', fontSize: 13, marginBottom: 4 },

  section:      { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#292524' },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  bodyText:     { color: '#a8a29e', fontSize: 14, lineHeight: 22 },
  bodyTextBold: { color: '#e7e5e4', fontSize: 15, fontWeight: '600', marginBottom: 2 },

  heightWarning: {
    marginTop: 8, backgroundColor: 'rgba(250,204,21,0.12)', borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)', borderRadius: 10, padding: 10,
  },
  heightWarningText: { color: '#facc15', fontSize: 13, fontWeight: '700' },
  heightWarningNote: { color: '#d6c884', fontSize: 12, marginTop: 3 },

  photoBtn:     { backgroundColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  photoBtnText: { color: '#a8a29e', fontSize: 12, fontWeight: '600' },
  photo:        { width: 110, height: 110, borderRadius: 10, marginRight: 8, backgroundColor: '#292524' },

  activityItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  activityDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316', marginTop: 6, flexShrink: 0 },
  activityAction: { color: '#e7e5e4', fontSize: 13, fontWeight: '600' },
  activityNote:   { color: '#a8a29e', fontSize: 13, marginTop: 2 },
  activityDate:   { color: '#44403c', fontSize: 11, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1c1917', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: '#292524',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  modalLabel: { color: '#6b7280', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },

  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:{ color: '#a8a29e', fontSize: 15, fontWeight: '600' },
  confirmBtn:    { flex: 2, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
})
