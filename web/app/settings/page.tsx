'use client'

import { useEffect, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import {
  Building2, Users, Info, CheckCircle, Plus,
  Edit2, ToggleLeft, ToggleRight, Shield, Mail, Phone,
  FileText, Palette, Eye, EyeOff, Tag, Trash2, Type, Clock, MapPin, PenTool, ListPlus,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Org {
  id: string; name: string; address: string | null
  phone: string | null; email: string | null
  timezone: string; currency: string; logo_url: string | null
  report_settings: ReportSettings | null
}
interface User {
  id: string; full_name: string; email: string
  phone: string | null; role: string; is_active: boolean
  last_login_at: string | null; created_at: string
}
interface ReportSettings {
  report_title?: string
  color_theme?: string
  section_labels?: {
    breakdown_box?: string; problem?: string; inspection?: string
    root_cause?: string; action_taken?: string; recommendations?: string
    parts?: string; photos?: string; ack?: string
  }
  ack_labels?: { engineer?: string; client?: string }
  show_recommendations?: boolean
  show_parts?: boolean
  show_photos?: boolean
  extra_fields?: ExtraField[]
  extra_field_site_ids?: string[]
}
interface ExtraField {
  id: string
  label: string
  field_type: 'text' | 'time' | 'location' | 'yes_no' | 'signature'
}
interface SiteOption { id: string; name: string; clients: { name: string } | null }

/* ── Constants ──────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', engineer: 'Engineer', client: 'Client',
}
const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  manager:  { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  engineer: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  client:   { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
}

const COLOR_THEMES = [
  { key: 'navy',   label: 'Navy Blue',   swatch: ['#1e2130', '#2563eb'] },
  { key: 'green',  label: 'Dark Green',  swatch: ['#15803d', '#16a34a'] },
  { key: 'red',    label: 'Dark Red',    swatch: ['#991b1b', '#dc2626'] },
  { key: 'slate',  label: 'Slate Grey',  swatch: ['#334155', '#64748b'] },
  { key: 'purple', label: 'Purple',      swatch: ['#581c87', '#9333ea'] },
]

const SECTION_LABEL_FIELDS: Array<{ key: keyof NonNullable<ReportSettings['section_labels']>; default: string; hint?: string }> = [
  { key: 'breakdown_box',   default: 'Breakdown Details',                              hint: 'The box title at the top of the report' },
  { key: 'problem',         default: 'Description of Problem'                                                                          },
  { key: 'inspection',      default: 'Inspection / Observation'                                                                        },
  { key: 'root_cause',      default: 'Root Cause Analysis'                                                                             },
  { key: 'action_taken',    default: 'Action Taken / Analysis'                                                                         },
  { key: 'recommendations', default: 'Offsite Repair Actions / Recommendations (if any)'                                              },
  { key: 'parts',           default: 'Details of Part(s) Replacement'                                                                  },
  { key: 'photos',          default: 'Photo Records'                                                                                   },
  { key: 'ack',             default: 'Acknowledgement'                                                                                 },
]

const TABS = [
  { key: 'company', label: 'Company Profile', icon: Building2 },
  { key: 'users',   label: 'Users',            icon: Users     },
  { key: 'fsr',     label: 'FSR & Reports',    icon: FileText  },
  { key: 'about',   label: 'About',            icon: Info      },
]

const emptyUserForm = { full_name: '', email: '', phone: '', role: 'engineer', password: '' }

const defaultReportSettings: Required<ReportSettings> = {
  report_title: 'FIELD SERVICE REPORT',
  color_theme: 'navy',
  section_labels: {
    breakdown_box: '', problem: '', inspection: '', root_cause: '',
    action_taken: '', recommendations: '', parts: '', photos: '', ack: '',
  },
  ack_labels: { engineer: '', client: '' },
  show_recommendations: true,
  show_parts: true,
  show_photos: true,
  extra_fields: [],
  extra_field_site_ids: [],
}

const EXTRA_FIELD_TYPES: { value: ExtraField['field_type']; label: string; icon: React.ReactNode }[] = [
  { value: 'text',      label: 'Text',                  icon: <Type size={14} /> },
  { value: 'time',      label: 'Time',                  icon: <Clock size={14} /> },
  { value: 'location',  label: 'Location (Geolocation)', icon: <MapPin size={14} /> },
  { value: 'yes_no',    label: 'Yes / No',               icon: <ToggleLeft size={14} /> },
  { value: 'signature', label: 'Signature',              icon: <PenTool size={14} /> },
]

/* ── Component ──────────────────────────────────────── */
export default function SettingsPage() {
  const [tab, setTab]       = useState('company')
  const [org, setOrg]       = useState<Org | null>(null)
  const [users, setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState(emptyUserForm)

  const [orgForm, setOrgForm] = useState({
    name: '', address: '', phone: '', email: '', timezone: 'Asia/Kuala_Lumpur', currency: 'MYR',
  })
  const [rs, setRs] = useState<Required<ReportSettings>>(defaultReportSettings)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<ExtraField['field_type']>('text')

  const setU  = (k: string, v: string) => setUserForm(f => ({ ...f, [k]: v }))
  const setO  = (k: string, v: string) => setOrgForm(f => ({ ...f, [k]: v }))
  const setRL = (k: keyof NonNullable<ReportSettings['section_labels']>, v: string) =>
    setRs(f => ({ ...f, section_labels: { ...f.section_labels, [k]: v } }))
  const setAL = (k: 'engineer' | 'client', v: string) =>
    setRs(f => ({ ...f, ack_labels: { ...f.ack_labels, [k]: v } }))

  function addExtraField() {
    if (!newFieldLabel.trim()) return
    setRs(f => ({
      ...f,
      extra_fields: [...f.extra_fields, { id: crypto.randomUUID(), label: newFieldLabel.trim(), field_type: newFieldType }],
    }))
    setNewFieldLabel(''); setNewFieldType('text')
  }
  function removeExtraField(id: string) {
    setRs(f => ({ ...f, extra_fields: f.extra_fields.filter(ef => ef.id !== id) }))
  }
  function toggleSiteAssignment(siteId: string) {
    setRs(f => ({
      ...f,
      extra_field_site_ids: f.extra_field_site_ids.includes(siteId)
        ? f.extra_field_site_ids.filter(id => id !== siteId)
        : [...f.extra_field_site_ids, siteId],
    }))
  }

  async function load() {
    const [orgRes, usersRes, sitesRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/users'),
      fetch('/api/sites'),
    ])
    const orgData: Org = await orgRes.json()
    if (orgData) {
      setOrg(orgData)
      setOrgForm({
        name:     orgData.name     ?? '',
        address:  orgData.address  ?? '',
        phone:    orgData.phone    ?? '',
        email:    orgData.email    ?? '',
        timezone: orgData.timezone ?? 'Asia/Kuala_Lumpur',
        currency: orgData.currency ?? 'MYR',
      })
      const saved_rs = orgData.report_settings ?? {}
      setRs({
        report_title:       saved_rs.report_title       ?? defaultReportSettings.report_title,
        color_theme:        saved_rs.color_theme        ?? defaultReportSettings.color_theme,
        section_labels:     { ...defaultReportSettings.section_labels, ...(saved_rs.section_labels ?? {}) },
        ack_labels:         { ...defaultReportSettings.ack_labels,     ...(saved_rs.ack_labels ?? {}) },
        show_recommendations: saved_rs.show_recommendations ?? true,
        show_parts:           saved_rs.show_parts           ?? true,
        show_photos:          saved_rs.show_photos           ?? true,
        extra_fields:         saved_rs.extra_fields          ?? [],
        extra_field_site_ids: saved_rs.extra_field_site_ids  ?? [],
      })
    }
    const usersData = await usersRes.json()
    setUsers(Array.isArray(usersData) ? usersData : [])
    const sitesData = await sitesRes.json()
    setSites(Array.isArray(sitesData) ? sitesData : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgForm.name.trim()) return setError('Company name is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgForm),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function saveFsr(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_settings: rs }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!userForm.full_name.trim()) return setError('Name is required.')
    if (!userForm.email.trim())     return setError('Email is required.')
    setSaving(true); setError('')
    if (editUser) {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setSaving(false); return }
    } else {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setSaving(false); return }
    }
    setSaving(false); setShowUserModal(false); setEditUser(null)
    setUserForm(emptyUserForm); load()
  }

  async function toggleUserActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    load()
  }

  function openEditUser(u: User) {
    setEditUser(u)
    setUserForm({ full_name: u.full_name, email: u.email, phone: u.phone ?? '', role: u.role, password: '' })
    setError(''); setShowUserModal(true)
  }

  const activeUsers   = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Manage your company profile, users and report customisation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(''); setSaved(false) }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{ color: tab === t.key ? 'var(--color-info)' : 'var(--text-muted)' }}>
            <t.icon size={15} />
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: 'var(--color-info)' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Company Profile ──────────────────────────────── */}
      {tab === 'company' && (
        <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="font-semibold mb-5" style={{ color: 'var(--text-base)' }}>Company Profile</h2>
          {loading ? <p style={{ color: 'var(--text-subtle)' }}>Loading...</p> : (
            <form onSubmit={saveOrg} className="space-y-4">
              <Field label="Company Name" required>
                <Input placeholder="Your company name" value={orgForm.name}
                  onChange={e => setO('name', e.target.value)} />
              </Field>
              <Field label="Address">
                <Input placeholder="Full address" value={orgForm.address}
                  onChange={e => setO('address', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <Input placeholder="+60 3-1234 5678" value={orgForm.phone}
                    onChange={e => setO('phone', e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" placeholder="info@company.com" value={orgForm.email}
                    onChange={e => setO('email', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Timezone">
                  <Select value={orgForm.timezone} onChange={e => setO('timezone', e.target.value)}>
                    <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                    <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                    <option value="UTC">UTC</option>
                  </Select>
                </Field>
                <Field label="Currency">
                  <Select value={orgForm.currency} onChange={e => setO('currency', e.target.value)}>
                    <option value="MYR">MYR — Malaysian Ringgit</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                    <option value="USD">USD — US Dollar</option>
                  </Select>
                </Field>
              </div>
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg"
                  style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
              )}
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saving}>
                  {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Users ────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Users</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {activeUsers.length} active · {inactiveUsers.length} inactive
              </p>
            </div>
            <Button onClick={() => { setShowUserModal(true); setEditUser(null); setUserForm(emptyUserForm); setError('') }}>
              <span className="flex items-center gap-2"><Plus size={16} /> Add User</span>
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([k, v]) => {
              const c = ROLE_COLORS[k]
              return (
                <span key={k} className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: c.bg, color: c.color }}>{v}</span>
              )
            })}
          </div>

          <div className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Contact', 'Role', 'Status', 'Last Login', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>No users yet.</td></tr>
                ) : users.map(u => {
                  const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.engineer
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.is_active ? 1 : 0.5 }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-base)' }}>{u.full_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Mail size={10} /> {u.email}
                        </p>
                        {u.phone && (
                          <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                            <Phone size={10} /> {u.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: rc.bg, color: rc.color }}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={u.is_active
                            ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                            : { background: 'var(--border)', color: 'var(--text-subtle)' }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditUser(u)}
                            className="p-1.5 rounded-lg" style={{ color: 'var(--text-subtle)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-info)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => toggleUserActive(u)}
                            className="p-1.5 rounded-lg"
                            style={{ color: u.is_active ? 'var(--color-success)' : 'var(--text-subtle)' }}
                            title={u.is_active ? 'Deactivate' : 'Activate'}>
                            {u.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FSR & Reports ────────────────────────────────── */}
      {tab === 'fsr' && (
        <form onSubmit={saveFsr} className="space-y-6">

          {/* ── Branding ──────────────────────────── */}
          <SettingsCard title="Report Branding" icon={<Palette size={16} />}>
            <Field label="Report Title" hint='Printed as the main title on the PDF — e.g. "FIELD SERVICE REPORT"'>
              <Input
                placeholder="FIELD SERVICE REPORT"
                value={rs.report_title}
                onChange={e => setRs(f => ({ ...f, report_title: e.target.value }))}
              />
            </Field>

            <div className="mt-4">
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Header Colour Theme</p>
              <div className="flex gap-3 flex-wrap">
                {COLOR_THEMES.map(t => (
                  <button key={t.key} type="button"
                    onClick={() => setRs(f => ({ ...f, color_theme: t.key }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
                    style={{
                      borderColor: rs.color_theme === t.key ? 'var(--color-info)' : 'var(--border)',
                      background:  rs.color_theme === t.key ? 'var(--color-info-bg)' : 'var(--bg-base)',
                      color: 'var(--text-base)',
                    }}>
                    {/* Two colour swatches */}
                    <span className="flex rounded overflow-hidden" style={{ width: 24, height: 16 }}>
                      <span style={{ flex: 1, background: t.swatch[0] }} />
                      <span style={{ flex: 1, background: t.swatch[1] }} />
                    </span>
                    {t.label}
                    {rs.color_theme === t.key && <CheckCircle size={13} style={{ color: 'var(--color-info)' }} />}
                  </button>
                ))}
              </div>
            </div>
          </SettingsCard>

          {/* ── Section Labels ────────────────────── */}
          <SettingsCard title="Section Labels" icon={<Tag size={16} />}
            subtitle="Leave blank to use the default label">
            <div className="grid grid-cols-1 gap-3">
              {SECTION_LABEL_FIELDS.map(f => (
                <Field key={f.key} label={f.default} hint={f.hint}>
                  <Input
                    placeholder={`Default: "${f.default}"`}
                    value={rs.section_labels[f.key] ?? ''}
                    onChange={e => setRL(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </SettingsCard>

          {/* ── Acknowledgement Labels ────────────── */}
          <SettingsCard title="Acknowledgement Labels" icon={<Edit2 size={16} />}
            subtitle="The role labels shown in the sign-off box at the bottom of the PDF">
            <div className="grid grid-cols-2 gap-4">
              <Field label='Left Side (Engineer)' hint='Default: "Tech / Engineer"'>
                <Input
                  placeholder='Tech / Engineer'
                  value={rs.ack_labels.engineer ?? ''}
                  onChange={e => setAL('engineer', e.target.value)}
                />
              </Field>
              <Field label='Right Side (Client)' hint='Default: "Client Representative"'>
                <Input
                  placeholder='Client Representative'
                  value={rs.ack_labels.client ?? ''}
                  onChange={e => setAL('client', e.target.value)}
                />
              </Field>
            </div>
          </SettingsCard>

          {/* ── Show / Hide Sections ──────────────── */}
          <SettingsCard title="Show / Hide PDF Sections" icon={<Eye size={16} />}
            subtitle="Toggle which sections appear in the generated PDF">
            <div className="space-y-3">
              {([
                { key: 'show_recommendations' as const, label: 'Recommendations section',        desc: 'Offsite repair actions / follow-up items' },
                { key: 'show_parts'           as const, label: 'Parts replacement table',        desc: 'Table listing parts used during repair' },
                { key: 'show_photos'          as const, label: 'Photo records',                  desc: 'Before / after photo page in the PDF' },
              ] as const).map(item => (
                <div key={item.key}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{item.desc}</p>
                  </div>
                  <button type="button"
                    onClick={() => setRs(f => ({ ...f, [item.key]: !f[item.key] }))}
                    style={{ color: rs[item.key] ? 'var(--color-success)' : 'var(--text-subtle)' }}>
                    {rs[item.key]
                      ? <span className="flex items-center gap-1.5 text-sm font-medium"><Eye size={16} /> Visible</span>
                      : <span className="flex items-center gap-1.5 text-sm"><EyeOff size={16} /> Hidden</span>}
                  </button>
                </div>
              ))}
            </div>
          </SettingsCard>

          {/* ── Extra Fields (assignable to specific sites) ──── */}
          <SettingsCard title="Extra Fields" icon={<ListPlus size={16} />}
            subtitle="Add custom fields to the Field Service Report, then choose which sites this template applies to">
            <div className="space-y-2">
              {rs.extra_fields.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No extra fields yet.</p>
              ) : rs.extra_fields.map(ef => {
                const t = EXTRA_FIELD_TYPES.find(t => t.value === ef.field_type)
                return (
                  <div key={ef.id} className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                    <span style={{ color: 'var(--color-info)' }}>{t?.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{ef.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t?.label ?? ef.field_type}</p>
                    </div>
                    <button type="button" onClick={() => removeExtraField(ef.id)} style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mt-4 items-end">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Field Name</label>
                <Input placeholder="e.g. Roof Access Required" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
                <Select value={newFieldType} onChange={e => setNewFieldType(e.target.value as ExtraField['field_type'])}>
                  {EXTRA_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <button type="button" onClick={addExtraField}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Apply this template to sites
              </p>
              {sites.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No sites yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sites.map(s => {
                    const selected = rs.extra_field_site_ids.includes(s.id)
                    return (
                      <button key={s.id} type="button" onClick={() => toggleSiteAssignment(s.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                        style={selected
                          ? { background: 'var(--color-success-bg)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }
                          : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                        {s.name}{s.clients ? ` (${s.clients.name})` : ''}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </SettingsCard>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Report Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* ── About ────────────────────────────────────────── */}
      {tab === 'about' && (
        <div className="rounded-xl border p-6 space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-info-bg)' }}>
              <Shield size={28} style={{ color: 'var(--color-info)' }} />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-base)' }}>TeamOnSite</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Field Service Management Platform</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {[
              { label: 'Version',       value: '0.1.0 — Local Development' },
              { label: 'Database',      value: 'Supabase (PostgreSQL) — Local' },
              { label: 'Frontend',      value: 'Next.js 16 + Tailwind CSS' },
              { label: 'Modules',       value: 'Tickets, Projects, PM, Inventory, QR, Reports' },
              { label: 'Company',       value: org?.name ?? '—' },
              { label: 'Data Location', value: 'http://127.0.0.1:54321 (local only)' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 text-sm border-b"
                style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-subtle)' }}>{label}</span>
                <span className="font-medium" style={{ color: 'var(--text-base)' }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4 mt-2" style={{ background: 'var(--bg-base)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>Going Live Checklist</p>
            <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-muted)' }}>
              {[
                ['✅', 'Database schema complete'],
                ['✅', 'Tickets & FSR with PDF export'],
                ['✅', 'Projects — Survey, TNC, UAT'],
                ['✅', 'QR Code generation & scanning'],
                ['✅', 'PM Schedules & auto ticket generation'],
                ['✅', 'Parts & Inventory tracking'],
                ['✅', 'FSR & Report customisation'],
                ['⬜', 'Authentication (login / user roles)'],
                ['⬜', 'Deploy to cloud (Supabase + Vercel)'],
                ['⬜', 'Mobile app (Expo)'],
                ['⬜', 'Custom domain'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span style={{ color: icon === '✅' ? 'var(--color-success)' : 'var(--text-muted)' }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showUserModal && (
        <Modal
          title={editUser ? `Edit — ${editUser.full_name}` : 'Add User'}
          onClose={() => { setShowUserModal(false); setEditUser(null); setError('') }}
          width="max-w-md">
          <form onSubmit={saveUser} className="space-y-4">
            <Field label="Full Name" required>
              <Input placeholder="Ahmad bin Ali" value={userForm.full_name}
                onChange={e => setU('full_name', e.target.value)} />
            </Field>
            <Field label="Email" required>
              <Input type="email" placeholder="ahmad@company.com" value={userForm.email}
                onChange={e => setU('email', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <Input placeholder="+60 12-345 6789" value={userForm.phone}
                  onChange={e => setU('phone', e.target.value)} />
              </Field>
              <Field label="Role">
                <Select value={userForm.role} onChange={e => setU('role', e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="engineer">Engineer</option>
                  <option value="client">Client</option>
                </Select>
              </Field>
            </div>
            {!editUser && (
              <Field label="Password" required hint="Min 6 characters — used to log in">
                <Input type="password" placeholder="••••••••" value={userForm.password}
                  onChange={e => setU('password', e.target.value)} />
              </Field>
            )}
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setShowUserModal(false); setEditUser(null) }}>Cancel</Button>
              <Button type="submit" loading={saving}>{editUser ? 'Save Changes' : 'Add User'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ── SettingsCard sub-component ──────────────────────── */
function SettingsCard({
  title, subtitle, icon, children
}: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        {icon && <span style={{ color: 'var(--color-info)' }}>{icon}</span>}
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
