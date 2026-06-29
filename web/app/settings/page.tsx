'use client'

import { useEffect, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import IntakeQuestionsTab, { IntakeQuestions } from '@/components/settings/IntakeQuestionsTab'
import {
  Building2, Users, Info, CheckCircle, Plus,
  Edit2, ToggleLeft, ToggleRight, Shield, Mail, Phone,
  FileText, Palette, Eye, EyeOff, Tag, Trash2, Type, Clock, MapPin, PenTool, ListPlus,
  Bell, Image as ImageIcon, Upload, Timer, History,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Org {
  id: string; name: string; address: string | null
  phone: string | null; email: string | null
  timezone: string; currency: string; logo_url: string | null
  report_settings: ReportSettings | null
  procurement_email: string | null; sales_email: string | null
  hr_email: string | null; hod_email: string | null
  attendance_photo_required: boolean
  attendance_break_minutes: number
  brand_color: string
  notification_prefs: NotificationPrefs
  default_sla: DefaultSla
}
interface NotificationPrefs {
  procurement?: { push?: boolean; email?: boolean }
  sales?: { push?: boolean; email?: boolean }
  hr?: { push?: boolean; email?: boolean }
  hod?: { push?: boolean; email?: boolean }
  ceo?: { push?: boolean; email?: boolean }
  management?: { push?: boolean; email?: boolean }
}
type DefaultSla = Record<'P1' | 'P2' | 'P3' | 'P4', { response: number; resolve: number }>
interface User {
  id: string; full_name: string; email: string
  phone: string | null; role: string; is_active: boolean
  last_login_at: string | null; created_at: string
  teams?: string[]
}

const NOTIF_TEAMS: { key: string; label: string }[] = [
  { key: 'procurement', label: 'Procurement' }, { key: 'sales', label: 'Sales' },
  { key: 'hr', label: 'HR' }, { key: 'hod', label: 'HOD' },
  { key: 'ceo', label: 'CEO' }, { key: 'management', label: 'Management' },
]
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
interface AuditEntry {
  id: string
  changes: Record<string, { from: unknown; to: unknown }>
  created_at: string
  users: { full_name: string } | null
}

/* ── Constants ──────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', engineer: 'Engineer', client: 'Client',
  procurement: 'Procurement', hr: 'HR', sales: 'Sales', project: 'Project Team',
}
const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin:       { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  manager:     { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  engineer:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  client:      { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  procurement: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  hr:          { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  sales:       { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  project:     { color: 'var(--brand-accent, #f97316)', bg: 'rgba(249,115,22,0.12)' },
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

function summarizeValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v).slice(0, 80)
}

// hr: true = visible to HR. Admin/Manager see every tab.
const TABS = [
  { key: 'company',       label: 'Company Profile', icon: Building2, hr: false },
  { key: 'users',         label: 'Users',           icon: Users,     hr: true  },
  { key: 'fsr',           label: 'Reports',         icon: FileText,  hr: false },
  { key: 'tickets',       label: 'Tickets',         icon: Timer,     hr: false },
  { key: 'attendance',    label: 'Attendance',      icon: Clock,     hr: true  },
  { key: 'notifications', label: 'Notifications',   icon: Bell,      hr: true  },
  { key: 'audit',         label: 'Change Log',      icon: History,   hr: false },
  { key: 'about',         label: 'About',           icon: Info,      hr: true  },
]

const emptyUserForm = { full_name: '', email: '', phone: '', role: 'manager', password: '', teams: [] as string[] }

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
  const [meRole, setMeRole] = useState<string>('')
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
    procurement_email: '', sales_email: '', hr_email: '', hod_email: '', brand_color: '#f97316',
  })
  const [rs, setRs] = useState<Required<ReportSettings>>(defaultReportSettings)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<ExtraField['field_type']>('text')
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    procurement: { push: true, email: true },
    sales: { push: true, email: true },
    hr: { push: true, email: false },
  })
  const [defaultSla, setDefaultSla] = useState<DefaultSla>({
    P1: { response: 1, resolve: 4 }, P2: { response: 2, resolve: 8 },
    P3: { response: 4, resolve: 24 }, P4: { response: 8, resolve: 48 },
  })
  const [logoUploading, setLogoUploading] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)
  const [smtp, setSmtp] = useState({ smtp_host: '', smtp_port: '587', smtp_secure: false, smtp_user: '', smtp_from: '', smtp_pass: '', smtp_pass_set: false })
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpSaved, setSmtpSaved] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pushTesting, setPushTesting] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [pmChecks, setPmChecks] = useState<{ key: string; label: string }[]>([])
  const [newCheckLabel, setNewCheckLabel] = useState('')
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestions>({})
  const [intakeSaving, setIntakeSaving] = useState(false)
  const [intakeSaved, setIntakeSaved] = useState(false)
  const [attendancePhoto, setAttendancePhoto] = useState(true)
  const [attendanceBreak, setAttendanceBreak] = useState('60')

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
    const [orgRes, usersRes, sitesRes, auditRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/users'),
      fetch('/api/sites'),
      fetch('/api/settings/audit-log'),
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
        procurement_email: orgData.procurement_email ?? '',
        sales_email:       orgData.sales_email        ?? '',
        hr_email:          orgData.hr_email           ?? '',
        hod_email:         orgData.hod_email          ?? '',
        brand_color:       orgData.brand_color        ?? '#f97316',
      })
      if (orgData.notification_prefs && Object.keys(orgData.notification_prefs).length > 0) {
        setNotifPrefs(p => ({ ...p, ...orgData.notification_prefs }))
      }
      if (orgData.default_sla && Object.keys(orgData.default_sla).length > 0) {
        setDefaultSla(orgData.default_sla)
      }
      const pmci = (orgData as { pm_check_items?: { key: string; label: string }[] }).pm_check_items
      if (Array.isArray(pmci)) setPmChecks(pmci)
      const o = orgData as unknown as Record<string, unknown>
      setSmtp({
        smtp_host: (o.smtp_host as string) ?? '',
        smtp_port: o.smtp_port != null ? String(o.smtp_port) : '587',
        smtp_secure: !!o.smtp_secure,
        smtp_user: (o.smtp_user as string) ?? '',
        smtp_from: (o.smtp_from as string) ?? '',
        smtp_pass: '',
        smtp_pass_set: !!o.smtp_pass_set,
      })
      if ((orgData as { intake_questions?: IntakeQuestions }).intake_questions) {
        setIntakeQuestions((orgData as { intake_questions?: IntakeQuestions }).intake_questions ?? {})
      }
      setAttendancePhoto(orgData.attendance_photo_required !== false)
      setAttendanceBreak(String(orgData.attendance_break_minutes ?? 60))
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
    const auditData = await auditRes.json()
    setAuditLog(Array.isArray(auditData) ? auditData : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => setMeRole(d?.role ?? ''))
  }, [])

  // HR sees only HR-relevant tabs; admin/manager see everything.
  const visibleTabs = TABS.filter(t => meRole === 'hr' ? t.hr : true)
  // If the active tab isn't visible to this role, fall back to the first visible one.
  useEffect(() => {
    if (meRole && !visibleTabs.some(t => t.key === tab)) setTab(visibleTabs[0]?.key ?? 'users')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meRole])

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!orgForm.name.trim()) return setError('Company name is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orgForm }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function saveAttendance() {
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendance_photo_required: attendancePhoto, attendance_break_minutes: parseInt(attendanceBreak) || 0 }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function sendTestPush() {
    setPushTesting(true); setPushResult(null)
    const res = await fetch('/api/push/test', { method: 'POST' })
    const json = await res.json()
    setPushTesting(false)
    setPushResult(res.ok
      ? { ok: true, msg: `Sent to ${json.devices} device(s) — check your notifications.` }
      : { ok: false, msg: json.error ?? 'Failed.' })
  }

  async function saveSmtp() {
    setSmtpSaving(true); setError('')
    const payload: Record<string, unknown> = {
      smtp_host: smtp.smtp_host || null,
      smtp_port: smtp.smtp_port ? parseInt(smtp.smtp_port) : null,
      smtp_secure: smtp.smtp_secure,
      smtp_user: smtp.smtp_user || null,
      smtp_from: smtp.smtp_from || null,
    }
    if (smtp.smtp_pass) payload.smtp_pass = smtp.smtp_pass
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSmtpSaving(false)
    if (!res.ok) { setError(json.error); return }
    setSmtp(s => ({ ...s, smtp_pass: '', smtp_pass_set: s.smtp_pass_set || !!smtp.smtp_pass }))
    setSmtpSaved(true); setTimeout(() => setSmtpSaved(false), 3000)
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) { setTestResult({ ok: false, msg: 'Enter a recipient first.' }); return }
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/settings/test-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: testEmail.trim() }),
    })
    const json = await res.json()
    setTesting(false)
    setTestResult(res.ok ? { ok: true, msg: 'Sent! Check the inbox.' } : { ok: false, msg: json.error ?? 'Failed.' })
  }

  async function saveSla() {
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_sla: defaultSla }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
    const json = await res.json()
    setLogoUploading(false)
    if (!res.ok) { setError(json.error); return }
    load()
  }

  async function saveNotifications() {
    setNotifSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_prefs: notifPrefs }),
    })
    const json = await res.json()
    setNotifSaving(false)
    if (!res.ok) { setError(json.error); return }
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 3000)
    load()
  }

  async function saveIntake() {
    setIntakeSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_questions: intakeQuestions }),
    })
    const json = await res.json()
    setIntakeSaving(false)
    if (!res.ok) { setError(json.error); return }
    setIntakeSaved(true); setTimeout(() => setIntakeSaved(false), 3000)
  }

  async function saveFsr(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_settings: rs, pm_check_items: pmChecks }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    load()
  }

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || `item_${Date.now()}`
  }
  function addPmCheck() {
    const label = newCheckLabel.trim()
    if (!label) return
    let key = slugify(label)
    if (pmChecks.some(c => c.key === key)) key = `${key}_${pmChecks.length}`
    setPmChecks([...pmChecks, { key, label }])
    setNewCheckLabel('')
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!userForm.full_name.trim()) return setError('Name is required.')
    if (!userForm.email.trim())     return setError('Email is required.')
    if (userForm.password && userForm.password.length < 6) return setError('Password must be at least 6 characters.')
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
    setUserForm({ full_name: u.full_name, email: u.email, phone: u.phone ?? '', role: u.role, password: '', teams: u.teams ?? [] })
    setError(''); setShowUserModal(true)
  }

  const activeUsers   = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>Settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Manage your company profile, users and report customisation</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Section nav */}
        <nav className="w-full md:w-56 flex-shrink-0 md:sticky md:top-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-1">
          {visibleTabs.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setError(''); setSaved(false) }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                style={active
                  ? { background: 'var(--color-info-bg)', color: 'var(--color-info)' }
                  : { color: 'var(--text-muted)', background: 'transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <t.icon size={16} style={{ flexShrink: 0 }} />
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 w-full space-y-6">

      {/* ── Company Profile ──────────────────────────────── */}
      {tab === 'company' && (
        <SettingsCard title="Company Profile" subtitle="Your organisation details shown on reports and invoices" icon={<Building2 size={16} />}>
          {loading ? <p style={{ color: 'var(--text-subtle)' }}>Loading...</p> : (
            <form onSubmit={saveOrg} className="space-y-4">
              {/* Logo + Brand Color */}
              <div className="flex items-center gap-6 pb-4 mb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                    {org?.logo_url
                      ? <img src={org.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      : <ImageIcon size={24} style={{ color: 'var(--text-subtle)' }} />}
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                      style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                      <Upload size={12} /> {logoUploading ? 'Uploading...' : 'Upload Logo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                    </label>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>PNG/JPG, up to 2MB. Shown on PDF/DOCX reports.</p>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Brand Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={orgForm.brand_color} onChange={e => setO('brand_color', e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--border)' }} />
                    <Input value={orgForm.brand_color} onChange={e => setO('brand_color', e.target.value)} style={{ maxWidth: 120 }} />
                    <button type="button" onClick={() => setO('brand_color', '#f97316')}
                      className="px-3 py-2 rounded-lg text-xs font-medium border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

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
              <Field label="Timezone">
                <Select value={orgForm.timezone} onChange={e => setO('timezone', e.target.value)}>
                  <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
                  <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                  <option value="UTC">UTC</option>
                </Select>
              </Field>
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
        </SettingsCard>
      )}

      {/* ── Users ────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Users</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {activeUsers.length} active · {inactiveUsers.length} inactive · Engineer accounts are created on the{' '}
                <a href="/engineers" style={{ color: 'var(--color-info)' }}>Engineers</a> tab
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
                        {(u.teams ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(u.teams ?? []).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)' }}>
                                {NOTIF_TEAMS.find(n => n.key === t)?.label ?? t}
                              </span>
                            ))}
                          </div>
                        )}
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

          {/* ── PM Report Checklist Items ───────────── */}
          <SettingsCard title="PM Report Checklist Items" icon={<ListPlus size={16} />}>
            <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
              Tick boxes shown for every device on a PM report (e.g. Device Cleaned, Power Supply OK).
            </p>
            <div className="space-y-2">
              {pmChecks.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No items yet — add one below.</p>
              ) : pmChecks.map((c, i) => (
                <div key={c.key} className="flex items-center gap-2">
                  <Input value={c.label}
                    onChange={e => setPmChecks(pmChecks.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <button type="button" onClick={() => setPmChecks(pmChecks.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg" style={{ color: 'var(--text-subtle)' }} title="Remove item">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Input placeholder="New checklist item — e.g. Lens / Glass Clean" value={newCheckLabel}
                onChange={e => setNewCheckLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPmCheck() } }} />
              <Button type="button" variant="secondary" onClick={addPmCheck}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Add</span>
              </Button>
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

      {/* ── Notifications ───────────────────────────────────── */}
      {tab === 'notifications' && (
        <div className="space-y-6">
          <SettingsCard title="Notification Preferences" icon={<Bell size={16} />}
            subtitle="Choose which channel fires for each role-based event">
            <div className="space-y-3">
              {([
                { key: 'procurement' as const, label: 'Procurement', desc: 'Part requests raised from tickets or projects' },
                { key: 'sales'       as const, label: 'Sales',       desc: 'Quotation-type part requests' },
                { key: 'hr'          as const, label: 'HR',          desc: 'Leave, claims & attendance check-ins' },
                { key: 'hod'         as const, label: 'HOD',         desc: 'Leave & claim approvals' },
                { key: 'management'  as const, label: 'Management',  desc: 'PM report completed / overdue alerts' },
                { key: 'ceo'         as const, label: 'CEO',         desc: 'Reserved for executive alerts' },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox"
                        checked={notifPrefs[item.key]?.push ?? true}
                        onChange={e => setNotifPrefs(p => ({ ...p, [item.key]: { ...p[item.key], push: e.target.checked } }))} />
                      Push
                    </label>
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox"
                        checked={notifPrefs[item.key]?.email ?? true}
                        onChange={e => setNotifPrefs(p => ({ ...p, [item.key]: { ...p[item.key], email: e.target.checked } }))} />
                      Email
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Test push to self */}
            <div className="mt-4 pt-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Test push notification</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                  Enable notifications in the sidebar first, then send a test to your own device.
                </p>
                {pushResult && (
                  <p className="text-sm mt-1.5" style={{ color: pushResult.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{pushResult.msg}</p>
                )}
              </div>
              <Button variant="secondary" onClick={sendTestPush} loading={pushTesting}>Send Test Push</Button>
            </div>
          </SettingsCard>

          <div className="flex justify-end">
            <Button onClick={saveNotifications} loading={notifSaving}>
              {notifSaved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Notification Settings'}
            </Button>
          </div>

          {/* ── Email (SMTP) ── */}
          <SettingsCard title="Email (SMTP)" icon={<Mail size={16} />}
            subtitle="Outgoing email provider for notifications. Leave blank to use the system default.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP Host" hint="e.g. smtp.resend.com">
                <Input value={smtp.smtp_host} onChange={e => setSmtp(s => ({ ...s, smtp_host: e.target.value }))} placeholder="smtp.provider.com" />
              </Field>
              <Field label="Port" hint="587 (TLS) or 465 (SSL)">
                <Input type="number" value={smtp.smtp_port} onChange={e => setSmtp(s => ({ ...s, smtp_port: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Username">
                <Input value={smtp.smtp_user} onChange={e => setSmtp(s => ({ ...s, smtp_user: e.target.value }))} placeholder="apikey / login" />
              </Field>
              <Field label="Password" hint={smtp.smtp_pass_set ? 'Saved — leave blank to keep' : 'API key or password'}>
                <Input type="password" value={smtp.smtp_pass} onChange={e => setSmtp(s => ({ ...s, smtp_pass: e.target.value }))}
                  placeholder={smtp.smtp_pass_set ? '••••••••' : ''} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="From Address" hint='e.g. "TeamOnSite &lt;no-reply@yourco.com&gt;"'>
                <Input value={smtp.smtp_from} onChange={e => setSmtp(s => ({ ...s, smtp_from: e.target.value }))} placeholder="no-reply@yourcompany.com" />
              </Field>
              <Field label="Use SSL/TLS">
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={smtp.smtp_secure} onChange={e => setSmtp(s => ({ ...s, smtp_secure: e.target.checked }))} />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Secure connection (port 465)</span>
                </label>
              </Field>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={saveSmtp} loading={smtpSaving}>
                {smtpSaved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Email Settings'}
              </Button>
            </div>

            {/* Test */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Send a test email</p>
              <div className="flex items-center gap-2">
                <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com" />
                <Button variant="secondary" onClick={sendTestEmail} loading={testing}>Send Test</Button>
              </div>
              {testResult && (
                <p className="text-sm mt-2 px-3 py-2 rounded-lg" style={testResult.ok
                  ? { color: 'var(--color-success)', background: 'var(--color-success-bg)' }
                  : { color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{testResult.msg}</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>Tip: save your settings first, then send a test.</p>
            </div>
          </SettingsCard>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
          )}
        </div>
      )}

      {/* ── Tickets (SLA + QR Intake) ────────────────────── */}
      {tab === 'tickets' && (
        <div className="space-y-6">
          <SettingsCard title="Default SLA Hours" icon={<Timer size={16} />}
            subtitle="Used when a ticket has no contract assigned — response and resolve targets by priority">
            <div className="grid grid-cols-1 gap-3">
              {(['P1', 'P2', 'P3', 'P4'] as const).map(p => (
                <div key={p} className="flex items-center gap-4">
                  <span className="text-sm font-semibold w-8" style={{ color: 'var(--text-base)' }}>{p}</span>
                  <div className="flex-1">
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-subtle)' }}>Response (hrs)</label>
                    <Input type="number" min="1" value={defaultSla[p].response}
                      onChange={e => setDefaultSla(s => ({ ...s, [p]: { ...s[p], response: parseInt(e.target.value) || 1 } }))} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-subtle)' }}>Resolve (hrs)</label>
                    <Input type="number" min="1" value={defaultSla[p].resolve}
                      onChange={e => setDefaultSla(s => ({ ...s, [p]: { ...s[p], resolve: parseInt(e.target.value) || 1 } }))} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={saveSla} loading={saving}>
                {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save SLA'}
              </Button>
            </div>
          </SettingsCard>

          <IntakeQuestionsTab
            value={intakeQuestions}
            onChange={setIntakeQuestions}
            onSave={saveIntake}
            saving={intakeSaving}
            saved={intakeSaved}
          />
        </div>
      )}

      {/* ── Attendance ───────────────────────────────────── */}
      {tab === 'attendance' && (
        <SettingsCard title="Attendance" subtitle="Check-in/out photo and break-deduction policy" icon={<Clock size={16} />}>
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Require photo on attendance check-in/out</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>When on, engineers must take a photo (front camera) when they check in or out. HR can switch this off.</p>
              </div>
              <input type="checkbox" checked={attendancePhoto} onChange={e => setAttendancePhoto(e.target.checked)} />
            </label>
            <Field label="Auto Lunch/Dinner Break Deduction (minutes)" hint="Deducted from worked hours on shifts over 5 hours. Set 0 to disable.">
              <Input type="number" value={attendanceBreak} onChange={e => setAttendanceBreak(e.target.value)} style={{ maxWidth: 160 }} />
            </Field>
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={saveAttendance} loading={saving}>
                {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Attendance Settings'}
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ── Change Log ───────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="font-semibold mb-1" style={{ color: 'var(--text-base)' }}>Settings Change Log</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Every change made to company settings, with who made it and when.</p>

          {auditLog.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No changes recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLog.map(entry => (
                <div key={entry.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
                      {entry.users?.full_name ?? 'Unknown user'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {new Date(entry.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {new Date(entry.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <ul className="text-xs space-y-1">
                    {Object.entries(entry.changes).map(([field, { from, to }]) => (
                      <li key={field} style={{ color: 'var(--text-muted)' }}>
                        <span className="font-medium capitalize" style={{ color: 'var(--text-base)' }}>{field.replace(/_/g, ' ')}</span>
                        {': '}
                        <span className="line-through" style={{ color: 'var(--text-subtle)' }}>{summarizeValue(from)}</span>
                        {' → '}
                        <span>{summarizeValue(to)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

        </div>{/* /content */}
      </div>{/* /layout */}

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
                  <option value="engineer" disabled>Engineer (add via Engineers tab)</option>
                  <option value="client">Client</option>
                  <option value="procurement">Procurement</option>
                  <option value="hr">HR</option>
                  <option value="sales">Sales</option>
                </Select>
              </Field>
            </div>
            <Field label="Password" required={!editUser}
              hint={editUser ? 'Leave blank to keep their current password' : 'Min 6 characters — used to log in'}>
              <Input type="password" placeholder="••••••••" value={userForm.password}
                onChange={e => setU('password', e.target.value)} />
            </Field>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Notification Teams</label>
              <p className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>Which alerts this person receives (part requests, quotations, leave, claims).</p>
              <div className="flex flex-wrap gap-2">
                {NOTIF_TEAMS.map(t => {
                  const on = userForm.teams.includes(t.key)
                  return (
                    <button key={t.key} type="button"
                      onClick={() => setUserForm(f => ({ ...f, teams: on ? f.teams.filter(x => x !== t.key) : [...f.teams, t.key] }))}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={on ? { background: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info)' }
                        : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
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
