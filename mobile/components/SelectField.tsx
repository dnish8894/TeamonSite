import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet } from 'react-native'

export interface SelectOption { id: string; label: string; sublabel?: string }

export default function SelectField({
  label, placeholder, options, value, onChange, disabled,
}: {
  label: string
  placeholder: string
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = options.find(o => o.id === value)
  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, disabled && { opacity: 0.5 }]}
        disabled={disabled}
        onPress={() => setOpen(true)}>
        <Text style={selected ? styles.valueText : styles.placeholderText}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TextInput
              style={styles.search}
              placeholder="Search..."
              placeholderTextColor="#6b7280"
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filtered}
              keyExtractor={o => o.id}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={styles.emptyText}>No results.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.id === value && styles.optionActive]}
                  onPress={() => { onChange(item.id); setOpen(false); setSearch('') }}>
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.sublabel && <Text style={styles.optionSub}>{item.sublabel}</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setOpen(false); setSearch('') }}>
              <Text style={styles.closeBtnText}>Cancel</Text>
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
  chevron: { color: '#6b7280', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c1917', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 30, maxHeight: '80%',
    borderTopWidth: 1, borderColor: '#292524',
  },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  search: {
    backgroundColor: '#0c0a09', borderWidth: 1, borderColor: '#292524',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14, marginBottom: 10,
  },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  optionActive: { backgroundColor: '#292524' },
  optionText: { color: '#e7e5e4', fontSize: 15, fontWeight: '500' },
  optionSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  closeBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
})
