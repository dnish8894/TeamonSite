import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function TimePickerField({
  label, value, onChange,
}: {
  label: string
  value: string // 'HH:MM'
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [h, m] = value ? value.split(':') : ['', '']

  function pick(hour: string, min: string) {
    onChange(`${hour}:${min}`)
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value || 'Select time'}</Text>
        <Text style={styles.icon}>🕐</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.cols}>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {HOURS.map(hr => (
                  <TouchableOpacity key={hr} style={[styles.cell, h === hr && styles.cellActive]} onPress={() => pick(hr, m || '00')}>
                    <Text style={[styles.cellText, h === hr && styles.cellTextActive]}>{hr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.colon}>:</Text>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {MINUTES.map(min => (
                  <TouchableOpacity key={min} style={[styles.cell, m === min && styles.cellActive]} onPress={() => pick(h || '00', min)}>
                    <Text style={[styles.cellText, m === min && styles.cellTextActive]}>{min}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: '#a8a29e', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#292524',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  valueText: { color: '#fff', fontSize: 15 },
  placeholderText: { color: '#6b7280', fontSize: 15 },
  icon: { fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { backgroundColor: '#1c1917', borderRadius: 20, padding: 18, width: '100%', borderWidth: 1, borderColor: '#292524' },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  cols: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 200 },
  col: { width: 70 },
  colon: { color: '#fff', fontSize: 22, fontWeight: '700', marginHorizontal: 8 },
  cell: { paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  cellActive: { backgroundColor: '#f97316' },
  cellText: { color: '#e7e5e4', fontSize: 16, fontWeight: '600' },
  cellTextActive: { color: '#fff' },
  doneBtn: { marginTop: 14, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
