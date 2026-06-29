import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const WEEKDAYS = ['S','M','T','W','T','F','S']

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DatePickerField({
  label, placeholder, value, onChange,
}: {
  label: string
  placeholder: string
  value: string // 'YYYY-MM-DD'
  onChange: (iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const initial = value ? new Date(value + 'T00:00') : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  function openPicker() {
    const base = value ? new Date(value + 'T00:00') : new Date()
    setViewYear(base.getFullYear()); setViewMonth(base.getMonth())
    setOpen(true)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const displayText = value
    ? new Date(value + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={openPicker}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{displayText || placeholder}</Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={i} style={styles.cell} />
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const selected = iso === value
                const isToday = iso === isoOf(new Date())
                return (
                  <TouchableOpacity key={i} style={styles.cell} onPress={() => { onChange(iso); setOpen(false) }}>
                    <View style={[styles.dayCircle, selected && styles.dayCircleSelected, !selected && isToday && styles.dayCircleToday]}>
                      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.actions}>
              {!!value && (
                <TouchableOpacity onPress={() => { onChange(''); setOpen(false) }}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
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
  sheet: {
    backgroundColor: '#1c1917', borderRadius: 20, padding: 18, width: '100%',
    borderWidth: 1, borderColor: '#292524',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 },
  navBtn: { padding: 6 },
  navArrow: { color: '#f97316', fontSize: 22, fontWeight: '700' },
  monthLabel: { color: '#fff', fontSize: 15, fontWeight: '700', minWidth: 140, textAlign: 'center' },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', color: '#6b7280', fontSize: 11, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: '#f97316' },
  dayCircleToday: { borderWidth: 1, borderColor: '#f97316' },
  dayText: { color: '#e7e5e4', fontSize: 13, fontWeight: '600' },
  dayTextSelected: { color: '#fff' },

  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292524' },
  clearText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
})
