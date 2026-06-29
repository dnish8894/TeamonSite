'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Field, Select, Textarea, Input } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface UserOption { id: string; full_name: string }

const REQUEST_TYPES = [
  { value: 'warranty', label: 'Under Warranty' },
  { value: 'preventive_maintenance', label: 'Preventive Maintenance' },
  { value: 'quotation', label: 'Need Quotation' },
  { value: 'project', label: 'Project' },
]

interface Item { description: string; model: string; remark: string }
const emptyItem = (): Item => ({ description: '', model: '', remark: '' })

export default function PartRequestModal({
  ticketId, projectId, onClose, onSubmitted,
}: {
  ticketId?: string
  projectId?: string
  onClose: () => void
  onSubmitted?: () => void
}) {
  const isProject = !!projectId

  // Ticket flow: single free-text description (unchanged).
  const [description, setDescription] = useState('')
  // Project flow: multiple equipment line items with model + remark.
  const [items, setItems] = useState<Item[]>([emptyItem()])

  const [requestType, setRequestType] = useState('warranty')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Project requests aren't tied to a single assigned engineer — multiple
  // people can handle the same project, so the requester must be picked explicitly.
  const [users, setUsers] = useState<UserOption[]>([])
  const [requestedBy, setRequestedBy] = useState('')

  useEffect(() => {
    if (!isProject) return
    fetch('/api/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data.filter((u: { is_active?: boolean }) => u.is_active !== false))
    })
  }, [isProject])

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(rows => rows.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function addItem() {
    setItems(rows => [...rows, emptyItem()])
  }
  function removeItem(i: number) {
    setItems(rows => rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows)
  }

  async function submit() {
    setError('')
    let payload: Record<string, unknown>

    if (isProject) {
      const cleanItems = items
        .map(it => ({ description: it.description.trim(), model: it.model.trim(), remark: it.remark.trim() }))
        .filter(it => it.description)
      if (cleanItems.length === 0) return setError('Please describe at least one piece of equipment.')
      if (!requestedBy) return setError('Please select who is requesting this.')
      payload = { project_id: projectId, items: cleanItems, request_type: requestType, requested_by: requestedBy }
    } else {
      if (!description.trim()) return setError('Please describe the equipment.')
      payload = { ticket_id: ticketId, equipment_description: description.trim(), request_type: requestType }
    }

    setSaving(true)
    const res = await fetch('/api/part-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    onSubmitted?.()
    onClose()
  }

  return (
    <Modal title="Request Replacement Part" onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        {isProject ? (
          <div className="space-y-3">
            <Field label="Requested By" required hint="Since this project is handled by multiple people, please confirm who's raising this request.">
              <Select value={requestedBy} onChange={e => setRequestedBy(e.target.value)}>
                <option value="">Select a person...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </Field>

            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Equipment Requested</p>
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Item {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <Field label="Equipment / Description" required>
                  <Textarea rows={2} placeholder="e.g. NVR Channel 4 power supply"
                    value={item.description} onChange={e => updateItem(i, { description: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Model">
                    <Input placeholder="e.g. DS-7608NI-K2" value={item.model} onChange={e => updateItem(i, { model: e.target.value })} />
                  </Field>
                  <Field label="Remark">
                    <Input placeholder="Optional notes" value={item.remark} onChange={e => updateItem(i, { remark: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" onClick={addItem}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border w-full justify-center"
              style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
              <Plus size={14} /> Add Another Item
            </button>
          </div>
        ) : (
          <Field label="Describe the Equipment" required>
            <Textarea rows={3} placeholder="e.g. NVR Channel 4 power supply burnt out, needs replacement..."
              value={description} onChange={e => setDescription(e.target.value)} />
          </Field>
        )}

        <Field label="Request Type">
          <Select value={requestType} onChange={e => setRequestType(e.target.value)}>
            {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Request</Button>
        </div>
      </div>
    </Modal>
  )
}
