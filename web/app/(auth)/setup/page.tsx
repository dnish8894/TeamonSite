'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Field, Input } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Building2, UserCheck, Eye, EyeOff } from 'lucide-react'

export default function SetupPage() {
  const router  = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({
    // Org
    name: '', address: '', phone: '', email: '',
    // Admin account
    admin_name: '', admin_email: '', admin_password: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim())           return setError('Company name is required.')
    if (!form.admin_email.trim())    return setError('Admin email is required.')
    if (!form.admin_password.trim()) return setError('Admin password is required.')
    if (form.admin_password.length < 6) return setError('Password must be at least 6 characters.')

    setSaving(true)
    setError('')

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()

    if (!res.ok) { setError(json.error); setSaving(false); return }
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">
            <span style={{ color: 'var(--text-base)' }}>TeamOn</span>
            <span style={{ color: '#f97316' }}>Site</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            One-time setup — takes less than a minute
          </p>
        </div>

        <form onSubmit={handleSubmit}
          className="rounded-2xl border p-7 space-y-6 shadow-sm"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

          {/* ── Section 1: Company ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
                <Building2 size={15} style={{ color: 'var(--color-info)' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>
                Company Profile
              </p>
            </div>
            <div className="space-y-3">
              <Field label="Company Name" required>
                <Input placeholder="e.g. InfiniteQL Sdn Bhd" value={form.name}
                  onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Address">
                <Input placeholder="No 1, Jalan Example, Kuala Lumpur" value={form.address}
                  onChange={e => set('address', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input placeholder="+60 3-1234 5678" value={form.phone}
                    onChange={e => set('phone', e.target.value)} />
                </Field>
                <Field label="Company Email">
                  <Input type="email" placeholder="info@company.com" value={form.email}
                    onChange={e => set('email', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border)' }} />

          {/* ── Section 2: Admin Account ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg" style={{ background: 'var(--color-success-bg)' }}>
                <UserCheck size={15} style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>
                Admin Account
              </p>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-subtle)' }}>
                Used to log in
              </span>
            </div>
            <div className="space-y-3">
              <Field label="Your Name">
                <Input placeholder="Full name" value={form.admin_name}
                  onChange={e => set('admin_name', e.target.value)} />
              </Field>
              <Field label="Email" required>
                <Input type="email" placeholder="admin@company.com" value={form.admin_email}
                  onChange={e => set('admin_email', e.target.value)} />
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={form.admin_password}
                    onChange={e => set('admin_password', e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-subtle)' }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
              {error}
            </p>
          )}

          <Button type="submit" loading={saving} className="w-full justify-center">
            Create & Go to Login
          </Button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-subtle)' }}>
          This page is only shown once. After setup, all access requires login.
        </p>
      </div>
    </div>
  )
}
