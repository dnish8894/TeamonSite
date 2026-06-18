import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Modal,
  TextInput, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import type { Ticket, TicketActivity } from '@/lib/types'

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

// Allowed next statuses per current status
const NEXT_STATUSES: Record<string, string[]> = {
  open:           ['assigned','in_progress'],
  assigned:       ['in_progress','pending_parts','pending_client'],
  in_progress:    ['pending_parts','pending_client','resolved'],
  pending_parts:  ['in_progress','resolved'],
  pending_client: ['in_progress','resolved'],
  resolved:       ['closed'],
  closed:         [],
  cancelled:      [],
}

export default function TicketDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()
  const [ticket,     setTicket]     = useState<Ticket | null>(null)
  const [activities, setActivities] = useState<TicketActivity[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showUpdate, setShowUpdate] = useState(false)
  const [newStatus,  setNewStatus]  = useState('')
  const [note,       setNote]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [photos,     setPhotos]     = useState<string[]>([])
  const [uploading,  setUploading]  = useState(false)

  async function load() {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from('tickets')
        .select('id,ticket_no,title,description,type,priority,status,created_at,resolved_at,reporter_name,reporter_phone,sites(id,name,city,state,site_contact,site_phone),elv_systems(id,name,type)')
        .eq('id', id).single(),
      supabase.from('ticket_activities')
        .select('id,ticket_id,action,note,old_value,new_value,created_at')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setTicket(t as unknown as Ticket)
    setActivities((a ?? []) as TicketActivity[])

    // Load photos from storage
    const { data: files } = await supabase.storage.from('ticket-photos').list(`tickets/${id}`)
    if (files) {
      const urls = files.map(f => {
        const { data } = supabase.storage.from('ticket-photos').getPublicUrl(`tickets/${id}/${f.name}`)
        return data.publicUrl
      })
      setPhotos(urls)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleStatusUpdate() {
    if (!newStatus || !ticket) return
    setSaving(true)
    const update: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'in_progress' && !ticket.resolved_at) update.started_at = new Date().toISOString()
    if (newStatus === 'resolved') update.resolved_at = new Date().toISOString()
    if (newStatus === 'closed')   update.closed_at   = new Date().toISOString()

    const { error } = await supabase.from('tickets').update(update).eq('id', id)
    if (error) { Alert.alert('Error', error.message); setSaving(false); return }

    // Log status change
    await supabase.from('ticket_activities').insert({
      ticket_id: id,
      action:    'status_changed',
      old_value: ticket.status,
      new_value: newStatus,
      note:      note.trim() || null,
    })
    // Extra note entry if provided
    if (note.trim()) {
      await supabase.from('ticket_activities').insert({
        ticket_id: id,
        action:    'note_added',
        note:      note.trim(),
      })
    }

    setSaving(false)
    setShowUpdate(false)
    setNote('')
    load()
  }

  async function pickAndUploadPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    setUploading(true)
    const asset = result.assets[0]
    const ext   = asset.uri.split('.').pop() ?? 'jpg'
    const path  = `tickets/${id}/${Date.now()}.${ext}`

    const response = await fetch(asset.uri)
    const blob     = await response.blob()
    const { error } = await supabase.storage.from('ticket-photos').upload(path, blob, { contentType: `image/${ext}` })
    setUploading(false)
    if (error) Alert.alert('Upload failed', error.message)
    else load()
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (result.canceled || !result.assets[0]) return
    setUploading(true)
    const asset = result.assets[0]
    const ext   = asset.uri.split('.').pop() ?? 'jpg'
    const path  = `tickets/${id}/${Date.now()}.${ext}`
    const response = await fetch(asset.uri)
    const blob     = await response.blob()
    const { error } = await supabase.storage.from('ticket-photos').upload(path, blob, { contentType: `image/${ext}` })
    setUploading(false)
    if (error) Alert.alert('Upload failed', error.message)
    else load()
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
  const nextStatuses = NEXT_STATUSES[ticket.status] ?? []

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

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Timeline</Text>
          <Text style={styles.bodyText}>
            Created: {new Date(ticket.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          </Text>
          {ticket.resolved_at && (
            <Text style={styles.bodyText}>
              Resolved: {new Date(ticket.resolved_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' })}
            </Text>
          )}
        </View>

        {/* Update status button */}
        {nextStatuses.length > 0 && (
          <TouchableOpacity
            style={styles.updateBtn}
            onPress={() => { setNewStatus(nextStatuses[0]); setShowUpdate(true) }}
            activeOpacity={0.85}>
            <Text style={styles.updateBtnText}>Update Status</Text>
          </TouchableOpacity>
        )}

        {/* Photos */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Photos ({photos.length})</Text>
            <View style={{ flexDirection:'row', gap: 8 }}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} disabled={uploading}>
                <Text style={styles.photoBtnText}>📷 Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickAndUploadPhoto} disabled={uploading}>
                <Text style={styles.photoBtnText}>🖼 Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
          {uploading && <ActivityIndicator color="#f97316" style={{ marginVertical: 8 }} />}
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.photo} />
              ))}
            </ScrollView>
          )}
        </View>

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

      {/* Status update modal */}
      <Modal visible={showUpdate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Status</Text>

            <Text style={styles.modalLabel}>New Status</Text>
            <View style={styles.statusOptions}>
              {nextStatuses.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, newStatus === s && styles.statusOptionActive]}
                  onPress={() => setNewStatus(s)}>
                  <Text style={[styles.statusOptionText, newStatus === s && { color: '#fff' }]}>
                    {STATUS_LABEL[s] ?? s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Describe what was done..."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowUpdate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
                onPress={handleStatusUpdate}
                disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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

  updateBtn: {
    marginTop: 24, backgroundColor: '#f97316',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  updateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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

  statusOptions:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#292524' },
  statusOptionActive:{ backgroundColor: '#f97316', borderColor: '#f97316' },
  statusOptionText:  { color: '#a8a29e', fontSize: 13, fontWeight: '600' },

  noteInput: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, padding: 12, color: '#fff', fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 4,
  },

  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:{ color: '#a8a29e', fontSize: 15, fontWeight: '600' },
  confirmBtn:    { flex: 2, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
})
