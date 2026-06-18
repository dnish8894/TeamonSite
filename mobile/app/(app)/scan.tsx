import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

type ScanResult = { type: string; data: string }

export default function ScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [resolving, setResolving] = useState(false)
  const cooldown = useRef(false)

  async function handleBarCodeScanned({ data }: ScanResult) {
    if (cooldown.current || scanned) return
    cooldown.current = true
    setScanned(true)
    setResolving(true)

    try {
      // Expected QR formats from web app:
      // "ticket:<id>"     → go to ticket detail
      // "device:<id>"     → show device info + open tickets
      // "site:<id>"       → show site tickets
      // Raw UUID or URL containing these patterns
      let kind: string | null = null
      let targetId: string | null = null

      const trimmed = data.trim()

      if (trimmed.startsWith('ticket:')) {
        kind = 'ticket'; targetId = trimmed.replace('ticket:', '')
      } else if (trimmed.startsWith('device:')) {
        kind = 'device'; targetId = trimmed.replace('device:', '')
      } else if (trimmed.startsWith('site:')) {
        kind = 'site'; targetId = trimmed.replace('site:', '')
      } else {
        // Try to match URL pattern: /scan/device/<id> or /scan/ticket/<id>
        const urlMatch = trimmed.match(/\/(ticket|device|site)\/([0-9a-f-]{36})/i)
        if (urlMatch) { kind = urlMatch[1]; targetId = urlMatch[2] }
      }

      if (!kind || !targetId) {
        Alert.alert('Unknown QR Code', `Could not recognise this QR:\n\n${trimmed}`, [
          { text: 'OK', onPress: () => { setScanned(false); cooldown.current = false } },
        ])
        setResolving(false)
        return
      }

      if (kind === 'ticket') {
        // Verify ticket exists
        const { data: t } = await supabase.from('tickets').select('id,ticket_no').eq('id', targetId).single()
        if (!t) throw new Error('Ticket not found')
        router.push(`/(app)/tickets/${targetId}`)

      } else if (kind === 'device') {
        // Look up open tickets for this device
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id,ticket_no,title,status')
          .eq('device_id', targetId)
          .in('status', ['open','assigned','in_progress','pending_parts','pending_client'])
          .order('created_at', { ascending: false })
          .limit(5)

        if (tickets && tickets.length > 0) {
          const { data: dev } = await supabase.from('devices').select('name,tag_id').eq('id', targetId).single()
          Alert.alert(
            `Device: ${dev?.name ?? targetId}`,
            `${tickets.length} active ticket(s):\n${tickets.map(t => `• ${t.ticket_no} — ${t.title}`).join('\n')}`,
            [
              { text: 'View First Ticket', onPress: () => router.push(`/(app)/tickets/${tickets[0].id}`) },
              { text: 'Cancel', style: 'cancel', onPress: () => { setScanned(false); cooldown.current = false } },
            ]
          )
        } else {
          const { data: dev } = await supabase.from('devices').select('name,tag_id,device_type').eq('id', targetId).single()
          Alert.alert(
            `Device: ${dev?.name ?? 'Unknown'}`,
            `Tag: ${dev?.tag_id ?? '—'}\nType: ${dev?.device_type ?? '—'}\n\nNo active tickets.`,
            [{ text: 'OK', onPress: () => { setScanned(false); cooldown.current = false } }]
          )
        }

      } else if (kind === 'site') {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id,ticket_no,title,status')
          .eq('site_id', targetId)
          .in('status', ['open','assigned','in_progress'])
          .limit(5)

        const { data: site } = await supabase.from('sites').select('name').eq('id', targetId).single()
        Alert.alert(
          `Site: ${site?.name ?? targetId}`,
          tickets && tickets.length > 0
            ? `${tickets.length} open ticket(s):\n${tickets.map(t => `• ${t.ticket_no}`).join('\n')}`
            : 'No open tickets.',
          [
            ...(tickets && tickets.length > 0
              ? [{ text: 'View First Ticket', onPress: () => router.push(`/(app)/tickets/${tickets[0].id}`) }]
              : []),
            { text: 'OK', style: 'cancel', onPress: () => { setScanned(false); cooldown.current = false } },
          ]
        )
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert('Error', msg, [
        { text: 'OK', onPress: () => { setScanned(false); cooldown.current = false } },
      ])
    }
    setResolving(false)
  }

  if (!permission) return <View style={styles.bg} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.bg}>
        <View style={styles.center}>
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permSub}>TeamOnSite needs camera access to scan equipment QR codes.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.bg}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}>

        {/* Overlay */}
        <SafeAreaView style={styles.overlay}>
          <Text style={styles.scanTitle}>Scan QR Code</Text>
          <Text style={styles.scanSub}>Point at a device, ticket or site QR code</Text>

          {/* Viewfinder frame */}
          <View style={styles.frameContainer}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              {resolving && (
                <View style={styles.resolving}>
                  <Text style={styles.resolvingText}>Looking up…</Text>
                </View>
              )}
            </View>
          </View>

          {scanned && !resolving && (
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => { setScanned(false); cooldown.current = false }}>
              <Text style={styles.rescanText}>Tap to scan again</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </CameraView>
    </View>
  )
}

const CORNER = 24
const styles = StyleSheet.create({
  bg:  { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  permTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  permSub:   { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  btn:       { backgroundColor: '#f97316', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },

  overlay:       { flex: 1, alignItems: 'center' },
  scanTitle:     { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20 },
  scanSub:       { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  frameContainer:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  frame: {
    width: 260, height: 260,
    position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: '#f97316', borderWidth: 3,
  },
  tl: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 4 },

  resolving: { backgroundColor: 'rgba(249,115,22,0.9)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  resolvingText: { color: '#fff', fontWeight: '700' },

  rescanBtn: {
    marginBottom: 40, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  rescanText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
