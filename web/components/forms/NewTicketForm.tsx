'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Props { onClose: () => void; onSaved: () => void }
interface Site { id: string; name: string; client_name: string }
interface Device { id: string; name: string; tag_id: string | null }

const emptyForm = {
  site_id: '', device_id: '', type: 'breakdown', priority: 'P3',
  title: '', description: '', reporter_name: '', reporter_phone: '',
}

export default function NewTicketForm({ onClose, onSaved }: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/sites')
      const data = await res.json()
      const rows = Array.isArray(data) ? data : []
      setSites(
        rows.map((x: { id: string; name: string; clients: { name: string } | null }) => ({
          id: x.id,
          name: x.name,
          client_name: x.clients?.name ?? '',
        }))
      )
    }
    load()
  }, [])

  useEffect(() => {
    if (!form.site_id) { setDevices([]); return }
    fetch(`/api/devices?site_id=${form.site_id}`)
      .then(r => r.json())
      .then(data => setDevices(Array.isArray(data) ? data : []))
  }, [form.site_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required.')
    if (!form.site_id) return setError('Please select a site.')
    setSaving(true); setError('')

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: form.site_id,
        device_id: form.device_id || null,
        type: form.type,
        priority: form.priority,
        title: form.title.trim(),
        description: form.description || null,
        reporter_name: form.reporter_name || null,
        reporter_phone: form.reporter_phone || null,
      }),
    })
    const json = await res.json()

    if (!res.ok) { setError(json.error); setSaving(false); return }
    onSaved()
    onClose()
  }

  return (
    <Modal title="New Ticket" onClose={onClose} width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" required>
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="breakdown">Breakdown</option>
              <option value="preventive_maintenance">Preventive Maintenance</option>
              <option value="installation">Installation</option>
              <option value="inspection">Inspection</option>
              <option value="upgrade">Upgrade</option>
              <option value="relocation">Relocation</option>
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="P1">P1 — Critical</option>
              <option value="P2">P2 — High</option>
              <option value="P3">P3 — Medium</option>
              <option value="P4">P4 — Low</option>
            </Select>
          </Field>
        </div>

        <Field label="Title" required>
          <Input placeholder="e.g. CCTV camera offline at main entrance" value={form.title}
            onChange={e => set('title', e.target.value)} />
        </Field>

        <Field label="Site" required>
          <Select value={form.site_id} onChange={e => set('site_id', e.target.value)}>
            <option value="">— Select site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.client_name})</option>
            ))}
          </Select>
        </Field>

        {devices.length > 0 && (
          <Field label="Device" hint="Optional — link to a specific device">
            <Select value={form.device_id} onChange={e => set('device_id', e.target.value)}>
              <option value="">— No specific device —</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.tag_id ? ` (${d.tag_id})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Description">
          <Textarea rows={3} placeholder="Describe the issue in detail..."
            value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reported By">
            <Input placeholder="Client contact name" value={form.reporter_name}
              onChange={e => set('reporter_name', e.target.value)} />
          </Field>
          <Field label="Reporter Phone">
            <Input placeholder="+60 12-345 6789" value={form.reporter_phone}
              onChange={e => set('reporter_phone', e.target.value)} />
          </Field>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg"
            style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Ticket</Button>
        </div>
      </form>
    </Modal>
  )
}
