'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, X, ChevronDown } from 'lucide-react'
import { Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import SiteSurveyTab from '@/components/projects/SiteSurveyTab'
import TncTab from '@/components/projects/TncTab'
import UatTab from '@/components/projects/UatTab'
import MinutesTab from '@/components/projects/MinutesTab'
import ProgressTab from '@/components/projects/ProgressTab'

interface Project {
  id: string; project_no: string; name: string; status: string
  description: string | null; value: number | null
  start_date: string | null; end_date: string | null
  clients: { name: string; type: string } | null
  sites: { name: string } | null
}

interface Assignment {
  id: string
  member_role: 'lead' | 'member' | 'viewer'
  assigned_at: string
  users: { id: string; full_name: string; email: string; role: string; phone: string | null }
}

interface AppUser { id: string; full_name: string; email: string; role: string }

const MEMBER_ROLE_COLOR: Record<string, string> = {
  lead: '#f97316', member: '#60a5fa', viewer: '#a78bfa',
}
const ROLE_COLOR: Record<string, string> = {
  admin: '#f97316', manager: '#60a5fa', engineer: '#34d399', client: '#a78bfa',
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  planning:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Planning'      },
  survey:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Site Survey'   },
  installation: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  label: 'Installation'  },
  testing:      { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  label: 'Testing / UAT' },
  handover:     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Handover'      },
  completed:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Completed' },
  on_hold:      { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  label: 'On Hold'   },
}

const TABS = [
  { key: 'overview', label: 'Overview'    },
  { key: 'survey',   label: 'Site Survey' },
  { key: 'tnc',      label: 'TNC'         },
  { key: 'uat',      label: 'UAT'         },
  { key: 'minutes',  label: 'Minutes'     },
  { key: 'progress', label: 'Progress'    },
]

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [project, setProject]       = useState<Project | null>(null)
  const [tab, setTab]               = useState('overview')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [newStatus, setNewStatus]   = useState('')

  // Team assignments
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [allUsers, setAllUsers]       = useState<AppUser[]>([])
  const [addUserId, setAddUserId]     = useState('')
  const [addRole, setAddRole]         = useState<'lead'|'member'|'viewer'>('member')
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [teamSaving, setTeamSaving]   = useState(false)

  async function load() {
    const res = await fetch(`/api/projects/${id}`)
    const data = await res.json()
    setProject(data)
    setNewStatus(data?.status ?? 'planning')
    setLoading(false)
  }

  async function loadAssignments() {
    const [aRes, uRes] = await Promise.all([
      fetch(`/api/projects/${id}/assignments`),
      fetch('/api/users'),
    ])
    const a = await aRes.json()
    const u = await uRes.json()
    setAssignments(Array.isArray(a) ? a : [])
    setAllUsers(Array.isArray(u) ? u : [])
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { if (tab === 'overview') loadAssignments() }, [tab, id])

  async function saveStatus() {
    setSaving(true)
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSaving(false)
    load()
  }

  async function handleAssign() {
    if (!addUserId) return
    setTeamSaving(true)
    await fetch(`/api/projects/${id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: addUserId, member_role: addRole }),
    })
    setTeamSaving(false)
    setShowAddTeam(false)
    setAddUserId('')
    loadAssignments()
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this person from the project?')) return
    await fetch(`/api/projects/${id}/assignments/${userId}`, { method: 'DELETE' })
    loadAssignments()
  }

  async function handleRoleChange(userId: string, role: string) {
    await fetch(`/api/projects/${id}/assignments/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_role: role }),
    })
    loadAssignments()
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading...</div>
  if (!project) return <div className="p-8" style={{ color: 'var(--color-danger)' }}>Project not found.</div>

  const st = STATUS_STYLE[project.status] ?? STATUS_STYLE.planning

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/projects')}
        className="flex items-center gap-2 text-sm mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-base)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{project.project_no}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{project.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {project.clients?.name}{project.sites?.name ? ` · ${project.sites.name}` : ''}
          </p>
          {project.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>{project.description}</p>
          )}
        </div>
        {/* Status updater */}
        <div className="flex items-center gap-2">
          <Select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            style={{ minWidth: 140 }}>
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <Button loading={saving} onClick={saveStatus}>Update</Button>
        </div>
      </div>

      {/* Project meta row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Contract Value', value: project.value ? `RM ${Number(project.value).toLocaleString()}` : '—', color: 'var(--color-success)' },
          { label: 'Start Date',     value: project.start_date ? new Date(project.start_date).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' }) : '—', color: 'var(--text-base)' },
          { label: 'End Date',       value: project.end_date   ? new Date(project.end_date).toLocaleDateString('en-MY',   { day:'numeric', month:'short', year:'numeric' }) : 'TBD', color: 'var(--text-base)' },
          { label: 'Client Type',    value: project.clients?.type ?? '—', color: 'var(--text-base)' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border p-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{m.label}</p>
            <p className="font-semibold mt-0.5 capitalize" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{ color: tab === t.key ? st.color : 'var(--text-muted)' }}>
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: st.color }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Project details card */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-base)' }}>Project Details</h2>
            <div className="space-y-3">
              {[
                ['Project Number', project.project_no],
                ['Client',         project.clients?.name ?? '—'],
                ['Site',           project.sites?.name ?? '—'],
                ['Status',         st.label],
                ['Contract Value', project.value ? `RM ${Number(project.value).toLocaleString()}` : '—'],
                ['Start Date',     project.start_date ?? '—'],
                ['End Date',       project.end_date ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm py-2 border-b"
                  style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-subtle)' }}>{label}</span>
                  <span className="font-medium" style={{ color: 'var(--text-base)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Team card */}
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Assigned Team</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned
                </p>
              </div>
              <button
                onClick={() => { setShowAddTeam(v => !v); setAddUserId(''); setAddRole('member') }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#f97316', color: '#fff' }}>
                <UserPlus size={14} /> Add Member
              </button>
            </div>

            {/* Add member form */}
            {showAddTeam && (
              <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid #f97316' }}>
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Person</label>
                    <select className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                      value={addUserId} onChange={e => setAddUserId(e.target.value)}>
                      <option value="">— Select person —</option>
                      {allUsers
                        .filter(u => !assignments.some(a => a.users.id === u.id))
                        .map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Project Role</label>
                    <select className="rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-base)' }}
                      value={addRole} onChange={e => setAddRole(e.target.value as 'lead'|'member'|'viewer')}>
                      <option value="lead">Lead</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button onClick={handleAssign} disabled={!addUserId || teamSaving}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#f97316', color: '#fff', opacity: (!addUserId || teamSaving) ? 0.5 : 1 }}>
                    {teamSaving ? 'Saving…' : 'Assign'}
                  </button>
                  <button onClick={() => setShowAddTeam(false)}
                    className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Team list */}
            {assignments.length === 0 ? (
              <div className="text-center py-6" style={{ color: 'var(--text-subtle)' }}>
                <p className="text-sm">No team members assigned yet.</p>
                <p className="text-xs mt-1">Add members so they can access this project.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map(a => {
                  const rc  = ROLE_COLOR[a.users.role]    ?? 'var(--text-muted)'
                  const mrc = MEMBER_ROLE_COLOR[a.member_role] ?? '#6b7280'
                  const initials = a.users.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: rc + '25', color: rc }}>
                        {initials}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-base)' }}>
                            {a.users.full_name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                            style={{ background: rc + '20', color: rc }}>{a.users.role}</span>
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-subtle)' }}>
                          {a.users.email}
                        </p>
                      </div>
                      {/* Project role selector */}
                      <select
                        className="text-xs px-2 py-1 rounded-lg font-medium border-0 outline-none"
                        style={{ background: mrc + '20', color: mrc, cursor: 'pointer' }}
                        value={a.member_role}
                        onChange={e => handleRoleChange(a.users.id, e.target.value)}>
                        <option value="lead">Lead</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      {/* Remove */}
                      <button onClick={() => handleRemove(a.users.id)}
                        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: 'var(--text-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Next steps hint */}
          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Next Steps</p>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-subtle)' }}>
              <li>→ Complete <strong>Site Survey</strong> tab to record site conditions</li>
              <li>→ Complete <strong>TNC</strong> tab for scope of work and terms</li>
              <li>→ Complete <strong>UAT</strong> tab after installation to test all systems</li>
              <li>→ Use <strong>Minutes</strong> tab to log all meeting discussions &amp; action items</li>
            </ul>
          </div>
        </div>
      )}
      {tab === 'survey'  && <SiteSurveyTab projectId={id} projectName={project.name} />}
      {tab === 'tnc'     && <TncTab        projectId={id} projectName={project.name} />}
      {tab === 'uat'     && <UatTab        projectId={id} projectName={project.name} />}
      {tab === 'minutes'  && <MinutesTab    projectId={id} projectName={project.name} />}
      {tab === 'progress' && <ProgressTab   projectId={id} projectName={project.name} />}
    </div>
  )
}
