'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, Phone, Mail, Wrench, CheckCircle, XCircle, BarChart2, Users, Pencil, Trash2 } from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
interface Engineer {
  id: string
  is_available: boolean
  daily_capacity_hr: number
  skills: string[]
  certifications: { brand: string; level: string; expiry: string }[]
  users: { full_name: string; phone: string | null; email: string; is_active: boolean } | null
  active_jobs?: number
  load_pct?: number
}

interface GroupMember {
  engineer_id: string
  engineers: { id: string; users: { full_name: string; email: string } | null } | null
}

interface EngineerGroup {
  id: string
  name: string
  description: string | null
  created_at: string
  engineer_group_members: GroupMember[]
}

/* ── Constants ──────────────────────────────────────── */
const SKILL_OPTIONS = [
  'cctv', 'access_control', 'structured_cabling', 'av', 'pa', 'bms', 'networking', 'electrical',
]
const SKILL_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS', networking: 'Networking', electrical: 'Electrical',
}
const SKILL_COLORS: Record<string, { color: string; bg: string }> = {
  cctv:               { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  access_control:     { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  structured_cabling: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  av:                 { color: '#a78bfa',              bg: 'rgba(167,139,250,0.12)'  },
  pa:                 { color: '#f472b6',              bg: 'rgba(244,114,182,0.12)'  },
  bms:                { color: '#34d399',              bg: 'rgba(52,211,153,0.12)'   },
  networking:         { color: '#fb923c',              bg: 'rgba(251,146,60,0.12)'   },
  electrical:         { color: '#facc15',              bg: 'rgba(250,204,21,0.12)'   },
}

const emptyEngForm = {
  full_name: '', email: '', phone: '', employee_id: '',
  daily_capacity_hr: '8', skills: [] as string[],
}
const emptyGroupForm = { name: '', description: '' }

/* ── Component ──────────────────────────────────────── */
export default function EngineersPage() {
  const [tab, setTab] = useState<'engineers' | 'groups'>('engineers')

  // Engineers state
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [workload, setWorkload]   = useState<Record<string, { active_jobs: number; load_pct: number }>>({})
  const [loading, setLoading]     = useState(true)
  const [showEngModal, setShowEngModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [engForm, setEngForm]     = useState(emptyEngForm)

  // Groups state
  const [groups, setGroups]               = useState<EngineerGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [showGroupModal, setShowGroupModal]   = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [editingGroup, setEditingGroup]   = useState<EngineerGroup | null>(null)
  const [groupForm, setGroupForm]         = useState(emptyGroupForm)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [groupSaving, setGroupSaving]     = useState(false)
  const [groupError, setGroupError]       = useState('')

  const setE  = (k: string, v: string) => setEngForm(f => ({ ...f, [k]: v }))
  const toggleSkill = (skill: string) => setEngForm(f => ({
    ...f,
    skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill],
  }))
  const toggleMember = (id: string) => setSelectedMembers(s =>
    s.includes(id) ? s.filter(x => x !== id) : [...s, id]
  )

  async function loadEngineers() {
    const [engRes, wlRes] = await Promise.all([
      fetch('/api/engineers'),
      fetch('/api/engineers/workload'),
    ])
    const engs = await engRes.json()
    const wl   = await wlRes.json()
    setEngineers(Array.isArray(engs) ? engs : [])
    const wlMap: Record<string, { active_jobs: number; load_pct: number }> = {}
    if (Array.isArray(wl)) wl.forEach((w: { engineer_id: string; active_jobs: number; load_pct: number }) => {
      wlMap[w.engineer_id] = { active_jobs: w.active_jobs, load_pct: w.load_pct }
    })
    setWorkload(wlMap)
    setLoading(false)
  }

  async function loadGroups() {
    setGroupsLoading(true)
    const res = await fetch('/api/engineer-groups')
    const data = await res.json()
    setGroups(Array.isArray(data) ? data : [])
    setGroupsLoading(false)
  }

  useEffect(() => { loadEngineers() }, [])
  useEffect(() => { if (tab === 'groups') loadGroups() }, [tab])

  async function handleAddEngineer(e: React.FormEvent) {
    e.preventDefault()
    if (!engForm.full_name.trim()) return setError('Name is required.')
    if (!engForm.email.trim())     return setError('Email is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/engineers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:         engForm.full_name.trim(),
        email:             engForm.email.trim(),
        phone:             engForm.phone || null,
        employee_id:       engForm.employee_id || null,
        daily_capacity_hr: parseInt(engForm.daily_capacity_hr) || 8,
        skills:            engForm.skills,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowEngModal(false); setEngForm(emptyEngForm); loadEngineers()
    setSaving(false)
  }

  async function toggleAvailability(id: string, current: boolean) {
    await fetch(`/api/engineers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !current }),
    })
    loadEngineers()
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!groupForm.name.trim()) return setGroupError('Group name is required.')
    setGroupSaving(true); setGroupError('')
    const res = await fetch('/api/engineer-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupForm.name.trim(), description: groupForm.description || null }),
    })
    const json = await res.json()
    if (!res.ok) { setGroupError(json.error); setGroupSaving(false); return }
    setShowGroupModal(false); setGroupForm(emptyGroupForm); loadGroups()
    setGroupSaving(false)
  }

  async function handleSaveMembers() {
    if (!editingGroup) return
    setGroupSaving(true); setGroupError('')
    const res = await fetch(`/api/engineer-groups/${editingGroup.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineer_ids: selectedMembers }),
    })
    const json = await res.json()
    if (!res.ok) { setGroupError(json.error); setGroupSaving(false); return }
    setShowMembersModal(false); setEditingGroup(null); loadGroups()
    setGroupSaving(false)
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm('Delete this group? This cannot be undone.')) return
    await fetch(`/api/engineer-groups/${id}`, { method: 'DELETE' })
    loadGroups()
  }

  function openMembersModal(group: EngineerGroup) {
    setEditingGroup(group)
    setSelectedMembers(group.engineer_group_members.map(m => m.engineer_id))
    setGroupError('')
    setShowMembersModal(true)
  }

  const available   = engineers.filter(e => e.is_available)
  const unavailable = engineers.filter(e => !e.is_available)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Engineers</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {available.length} available · {unavailable.length} unavailable · {engineers.length} total
          </p>
        </div>
        {tab === 'engineers' && (
          <Button onClick={() => { setShowEngModal(true); setError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Add Engineer</span>
          </Button>
        )}
        {tab === 'groups' && (
          <Button onClick={() => { setShowGroupModal(true); setGroupError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Create Group</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'engineers', label: 'Engineers' },
          { key: 'groups',    label: 'Groups'    },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{ color: tab === t.key ? 'var(--color-info)' : 'var(--text-muted)' }}>
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: 'var(--color-info)' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── ENGINEERS TAB ── */}
      {tab === 'engineers' && (
        <>
          {engineers.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Engineers', value: engineers.length,   color: 'var(--color-info)'    },
                { label: 'Available Today', value: available.length,   color: 'var(--color-success)' },
                { label: 'On Job / Busy',   value: unavailable.length, color: 'var(--color-danger)'  },
              ].map(s => (
                <div key={s.label} className="rounded-xl border p-4 flex items-center gap-3"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
          ) : engineers.length === 0 ? (
            <div className="rounded-xl border p-12 text-center"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <Wrench size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>No engineers yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {engineers.map(eng => {
                const wl = workload[eng.id]
                const loadPct   = wl?.load_pct ?? 0
                const activeJobs = wl?.active_jobs ?? 0
                const loadColor = loadPct >= 90 ? 'var(--color-danger)'
                  : loadPct >= 60 ? 'var(--color-warning)'
                  : 'var(--color-success)'

                return (
                  <div key={eng.id} className="rounded-xl border p-5 space-y-4"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-base)' }}>
                          {eng.users?.full_name ?? 'Unknown'}
                        </p>
                        {eng.users?.email && (
                          <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                            <Mail size={10} /> {eng.users.email}
                          </p>
                        )}
                        {eng.users?.phone && (
                          <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                            <Phone size={10} /> {eng.users.phone}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleAvailability(eng.id, eng.is_available)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                        style={eng.is_available
                          ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                          : { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                        {eng.is_available
                          ? <><CheckCircle size={12} /> Available</>
                          : <><XCircle size={12} /> Unavailable</>}
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>
                        <span className="flex items-center gap-1"><BarChart2 size={11} /> Workload today</span>
                        <span style={{ color: loadColor }}>{activeJobs} job{activeJobs !== 1 ? 's' : ''} · {Math.round(loadPct)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(loadPct, 100)}%`, background: loadColor }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                        Capacity: {eng.daily_capacity_hr} hrs/day
                      </p>
                    </div>

                    {eng.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {eng.skills.map((s: string) => {
                          const c = SKILL_COLORS[s] ?? { color: 'var(--text-muted)', bg: 'var(--border)' }
                          return (
                            <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: c.bg, color: c.color }}>
                              {SKILL_LABELS[s] ?? s}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── GROUPS TAB ── */}
      {tab === 'groups' && (
        <>
          {groupsLoading ? (
            <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border p-12 text-center"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <Users size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>No groups yet.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                Create groups to assign tickets to teams of engineers.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(group => {
                const members = group.engineer_group_members ?? []
                return (
                  <div key={group.id} className="rounded-xl border p-5 space-y-3"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-base)' }}>{group.name}</p>
                        {group.description && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{group.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openMembersModal(group)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--color-info)' }}
                          title="Manage members">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete group">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users size={13} style={{ color: 'var(--text-subtle)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {members.length} member{members.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {members.length > 0 && (
                      <div className="space-y-1">
                        {members.map(m => (
                          <div key={m.engineer_id} className="text-xs px-2 py-1 rounded-lg"
                            style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                            {m.engineers?.users?.full_name ?? 'Unknown'}
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={() => openMembersModal(group)}
                      className="w-full text-xs py-1.5 rounded-lg border border-dashed transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
                      + Manage Members
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Add Engineer Modal ── */}
      {showEngModal && (
        <Modal title="Add Engineer" onClose={() => { setShowEngModal(false); setError('') }} width="max-w-lg">
          <form onSubmit={handleAddEngineer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <Input placeholder="Ahmad bin Ali" value={engForm.full_name}
                  onChange={e => setE('full_name', e.target.value)} />
              </Field>
              <Field label="Employee ID">
                <Input placeholder="EMP-001" value={engForm.employee_id}
                  onChange={e => setE('employee_id', e.target.value)} />
              </Field>
            </div>
            <Field label="Email" required>
              <Input type="email" placeholder="ahmad@yourcompany.com" value={engForm.email}
                onChange={e => setE('email', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <Input placeholder="+60 12-345 6789" value={engForm.phone}
                  onChange={e => setE('phone', e.target.value)} />
              </Field>
              <Field label="Daily Capacity (hrs)">
                <Select value={engForm.daily_capacity_hr} onChange={e => setE('daily_capacity_hr', e.target.value)}>
                  {[4,6,8,10,12].map(h => <option key={h} value={h}>{h} hours</option>)}
                </Select>
              </Field>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map(skill => {
                  const selected = engForm.skills.includes(skill)
                  const c = SKILL_COLORS[skill] ?? { color: 'var(--text-muted)', bg: 'var(--border)' }
                  return (
                    <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={selected
                        ? { background: c.bg, color: c.color, borderColor: c.color }
                        : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                      {SKILL_LABELS[skill]}
                    </button>
                  )
                })}
              </div>
            </div>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowEngModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Engineer</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Create Group Modal ── */}
      {showGroupModal && (
        <Modal title="Create Group" onClose={() => { setShowGroupModal(false); setGroupError('') }} width="max-w-md">
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Field label="Group Name" required>
              <Input placeholder="e.g. CCTV Team A" value={groupForm.name}
                onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Description">
              <Input placeholder="Optional description" value={groupForm.description}
                onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            {groupError && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{groupError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowGroupModal(false)}>Cancel</Button>
              <Button type="submit" loading={groupSaving}>Create Group</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Manage Members Modal ── */}
      {showMembersModal && editingGroup && (
        <Modal title={`Members — ${editingGroup.name}`} onClose={() => { setShowMembersModal(false); setEditingGroup(null) }} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select engineers to add to this group. Engineers can belong to multiple groups.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {engineers.map(eng => {
                const selected = selectedMembers.includes(eng.id)
                return (
                  <button key={eng.id} type="button" onClick={() => toggleMember(eng.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all"
                    style={selected
                      ? { borderColor: 'var(--color-info)', background: 'var(--color-info-bg)' }
                      : { borderColor: 'var(--border)', background: 'transparent' }}>
                    <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                      style={selected
                        ? { borderColor: 'var(--color-info)', background: 'var(--color-info)' }
                        : { borderColor: 'var(--border)' }}>
                      {selected && <CheckCircle size={10} color="white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                        {eng.users?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{eng.users?.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {groupError && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{groupError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowMembersModal(false)}>Cancel</Button>
              <Button loading={groupSaving} onClick={handleSaveMembers}>Save Members</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
