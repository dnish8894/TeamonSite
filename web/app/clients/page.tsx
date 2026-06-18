'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, Building2, MapPin, FileText, ChevronRight } from 'lucide-react'

interface Client {
  id: string
  name: string
  type: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  sites: { id: string }[]
  contracts: { id: string; is_active: boolean }[]
}

const emptyForm = {
  name: '', type: 'commercial', registration_no: '',
  address: '', contact_name: '', contact_email: '',
  contact_phone: '', notes: '',
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/clients')
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Client name is required.')
    setSaving(true); setError('')

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()

    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowModal(false)
    setForm(emptyForm)
    load()
  }

  const typeColor: Record<string, string> = {
    government: 'var(--color-info)',
    commercial: 'var(--color-success)',
    industrial: 'var(--color-warning)',
    residential: 'var(--text-muted)',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Clients</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{clients.length} clients</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Client</span>
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Building2 size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No clients yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Add your first client to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(c => {
            const siteCount     = c.sites?.length ?? 0
            const contractCount = c.contracts?.filter(ct => ct.is_active).length ?? 0
            return (
              <div key={c.id}
                className="rounded-xl border p-5 cursor-pointer transition-all group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                onClick={() => router.push(`/clients/${c.id}`)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = typeColor[c.type] ?? 'var(--color-info)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>

                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                        style={{ color: typeColor[c.type] ?? 'var(--text-muted)', background: 'var(--bg-base)' }}>
                        {c.type}
                      </span>
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--text-base)' }}>{c.name}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-subtle)', marginTop: 4 }} />
                </div>

                {/* Contact */}
                {c.contact_name && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.contact_name}</p>
                )}
                {c.contact_phone && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{c.contact_phone}</p>
                )}
                {c.contact_email && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-info)' }}>{c.contact_email}</p>
                )}

                {/* Stats */}
                <div className="flex gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    <MapPin size={12} style={{ color: 'var(--color-info)' }} />
                    <span>{siteCount} site{siteCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                    <FileText size={12} style={{ color: 'var(--color-success)' }} />
                    <span>{contractCount} contract{contractCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Client" onClose={() => { setShowModal(false); setError('') }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Client Name" required>
              <Input placeholder="e.g. Jabatan Imigresen Malaysia" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type" required>
                <Select value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="government">Government</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="residential">Residential</option>
                </Select>
              </Field>
              <Field label="SSM / Reg No">
                <Input placeholder="e.g. 202301012345" value={form.registration_no}
                  onChange={e => set('registration_no', e.target.value)} />
              </Field>
            </div>

            <Field label="Address">
              <Input placeholder="Full address" value={form.address}
                onChange={e => set('address', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Person">
                <Input placeholder="Ahmad bin Ali" value={form.contact_name}
                  onChange={e => set('contact_name', e.target.value)} />
              </Field>
              <Field label="Contact Phone">
                <Input placeholder="+60 12-345 6789" value={form.contact_phone}
                  onChange={e => set('contact_phone', e.target.value)} />
              </Field>
            </div>

            <Field label="Contact Email">
              <Input type="email" placeholder="contact@client.com" value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)} />
            </Field>

            <Field label="Notes">
              <Textarea rows={2} placeholder="Any additional notes..." value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </Field>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Client</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
