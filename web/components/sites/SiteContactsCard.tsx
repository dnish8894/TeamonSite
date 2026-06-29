'use client'

import { useEffect, useState } from 'react'
import { Plus, Phone, Mail, Star, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface Contact {
  id: string
  name: string
  title: string | null
  phone: string | null
  email: string | null
  is_primary: boolean
}

const emptyForm = { name: '', title: '', phone: '', email: '', is_primary: false }

export default function SiteContactsCard({ siteId }: { siteId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch(`/api/sites/${siteId}/contacts`)
    const data = await res.json()
    setContacts(Array.isArray(data) ? data : [])
  }
  useEffect(() => { load() }, [siteId])

  async function add() {
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const res = await fetch(`/api/sites/${siteId}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error); return }
    setShowAdd(false); setForm(emptyForm); load()
  }

  async function setPrimary(c: Contact) {
    await fetch(`/api/sites/${siteId}/contacts/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_primary: true }),
    })
    load()
  }

  async function remove(c: Contact) {
    if (!confirm(`Remove ${c.name}?`)) return
    await fetch(`/api/sites/${siteId}/contacts/${c.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>People in Charge</h2>
        <button onClick={() => { setShowAdd(v => !v); setForm(emptyForm); setError('') }}
          className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg"
          style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
          <Plus size={12} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border p-3 mb-3 space-y-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>New Contact</span>
            <button onClick={() => setShowAdd(false)} style={{ color: 'var(--text-subtle)' }}><X size={14} /></button>
          </div>
          <Input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Role / Title (e.g. Building Manager)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
            Primary contact
          </label>
          {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <Button onClick={add} loading={saving}>Add Contact</Button>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No contacts added yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{c.name}</span>
                    {c.is_primary && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"
                        style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                        <Star size={9} /> Primary
                      </span>
                    )}
                  </div>
                  {c.title && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{c.title}</p>}
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {c.phone && <a href={`tel:${c.phone}`} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-info)' }}><Phone size={10} /> {c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-info)' }}><Mail size={10} /> {c.email}</a>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!c.is_primary && (
                    <button onClick={() => setPrimary(c)} title="Make primary"
                      className="p-1.5 rounded-lg" style={{ color: 'var(--text-subtle)' }}><Star size={13} /></button>
                  )}
                  <button onClick={() => remove(c)} title="Remove"
                    className="p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
