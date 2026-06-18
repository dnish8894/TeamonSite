'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, MapPin, ChevronRight } from 'lucide-react'

interface Site {
  id: string
  name: string
  city: string | null
  state: string | null
  is_active: boolean
  contract_type: 'dlp' | 'maintenance' | null
  contract_end: string | null
  clients: { name: string } | null
}

const CONTRACT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  dlp:         { label: 'DLP',         color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  maintenance: { label: 'Maintenance', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
}

interface Client { id: string; name: string }

const emptyForm = {
  client_id: '', name: '', address: '', postcode: '',
  city: '', state: '', site_contact: '', site_phone: '', access_notes: '',
  contract_type: '', contract_start: '', contract_end: '',
}

const MY_STATES = [
  'Johor','Kedah','Kelantan','Melaka','Negeri Sembilan',
  'Pahang','Perak','Perlis','Pulau Pinang','Sabah',
  'Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya',
]

export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { load() }, [])

  async function load() {
    const [sitesRes, clientsRes] = await Promise.all([
      fetch('/api/sites'),
      fetch('/api/clients'),
    ])
    setSites(await sitesRes.json())
    setClients(await clientsRes.json())
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Site name is required.')
    if (!form.client_id) return setError('Please select a client.')
    setSaving(true); setError('')

    const res = await fetch('/api/sites', {
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Sites</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{sites.length} sites</p>
        </div>
        <Button onClick={() => { setShowModal(true); setError('') }}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Site</span>
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <MapPin size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No sites yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Add your first site after creating a client.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map(s => (
            <div key={s.id}
              className="rounded-xl border p-5 space-y-2 cursor-pointer transition-all"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              onClick={() => router.push(`/sites/${s.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-info)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold" style={{ color: 'var(--text-base)' }}>{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                    Active
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
                </div>
              </div>
              {/* Client link */}
              <button className="text-xs hover:underline text-left"
                style={{ color: 'var(--color-info)' }}
                onClick={e => { e.stopPropagation(); if ((s as Site & { client_id?: string }).client_id) router.push(`/clients/${(s as Site & { clients?: { id?: string } }).clients?.id ?? ''}`) }}>
                {s.clients?.name ?? '—'}
              </button>
              {(s.city || s.state) && (
                <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-subtle)' }}>
                  <MapPin size={11} /> {[s.city, s.state].filter(Boolean).join(', ')}
                </p>
              )}
              {s.contract_type && (() => {
                const cs = CONTRACT_STYLE[s.contract_type]
                const expired = s.contract_end ? new Date(s.contract_end) < new Date() : false
                return (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: cs.bg, color: cs.color }}>
                      {cs.label}
                    </span>
                    {s.contract_end && (
                      <span className="text-xs" style={{ color: expired ? 'var(--color-danger)' : 'var(--text-subtle)' }}>
                        {expired ? '⚠ Expired ' : 'Until '}
                        {new Date(s.contract_end + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Add Site" onClose={() => { setShowModal(false); setError('') }} width="max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Client" required>
              <Select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Site Name" required>
              <Input placeholder="e.g. Menara XYZ — Level 1–10" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label="Address">
              <Input placeholder="Street address" value={form.address}
                onChange={e => set('address', e.target.value)} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Postcode">
                <Input placeholder="50000" value={form.postcode}
                  onChange={e => set('postcode', e.target.value)} />
              </Field>
              <Field label="City">
                <Input placeholder="Kuala Lumpur" value={form.city}
                  onChange={e => set('city', e.target.value)} />
              </Field>
              <Field label="State">
                <Select value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">— State —</option>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Site Contact">
                <Input placeholder="Contact person on site" value={form.site_contact}
                  onChange={e => set('site_contact', e.target.value)} />
              </Field>
              <Field label="Site Phone">
                <Input placeholder="+60 3-1234 5678" value={form.site_phone}
                  onChange={e => set('site_phone', e.target.value)} />
              </Field>
            </div>

            <Field label="Access Notes" hint="Entry procedures, permit requirements, guard contacts">
              <Textarea rows={2} placeholder="e.g. Sign in at guard house, call site manager before arrival"
                value={form.access_notes} onChange={e => set('access_notes', e.target.value)} />
            </Field>

            {/* ── DLP / Maintenance ── */}
            <div className="rounded-lg border p-4 space-y-3"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                Contract / Service Period (optional)
              </p>
              <Field label="Type">
                <Select value={form.contract_type} onChange={e => set('contract_type', e.target.value)}>
                  <option value="">— None —</option>
                  <option value="dlp">DLP (Defects Liability Period)</option>
                  <option value="maintenance">Maintenance</option>
                </Select>
              </Field>
              {form.contract_type && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date">
                    <Input type="date" value={form.contract_start} onChange={e => set('contract_start', e.target.value)} />
                  </Field>
                  <Field label="End Date">
                    <Input type="date" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Site</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
