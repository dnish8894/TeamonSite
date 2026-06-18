'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import {
  Plus, CalendarDays, MapPin, Users, RefreshCw,
  ClipboardList, Repeat2, Edit2, Trash2, ChevronDown, ChevronUp,
  FileText, FileDown, Sheet,
} from 'lucide-react'
import { exportMinutesPdf, exportMinutesExcel } from '@/lib/exportProject'

interface Minute {
  id: string
  project_id: string
  title: string
  meeting_date: string
  location: string | null
  attendees: string | null
  agenda: string | null
  minutes: string | null
  action_items: string | null
  next_meeting_date: string | null
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  prepared_by: string | null
  created_at: string
}

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'One-off',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const RECURRENCE_COLORS: Record<string, string> = {
  none:    'var(--text-subtle)',
  daily:   '#f97316',
  weekly:  '#60a5fa',
  monthly: '#a78bfa',
}

const emptyForm = {
  title: '', meeting_date: new Date().toISOString().slice(0, 10),
  location: '', attendees: '', agenda: '', minutes: '',
  action_items: '', next_meeting_date: '', recurrence: 'none', prepared_by: '',
}

export default function MinutesTab({ projectId, projectName = 'Project' }: { projectId: string; projectName?: string }) {
  const [records, setRecords]       = useState<Minute[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editRecord, setEditRecord] = useState<Minute | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [form, setForm]             = useState(emptyForm)
  const [expanded, setExpanded]     = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/minutes`)
    setRecords(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [projectId])

  function openAdd() {
    setEditRecord(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(r: Minute) {
    setEditRecord(r)
    setForm({
      title:            r.title,
      meeting_date:     r.meeting_date,
      location:         r.location          ?? '',
      attendees:        r.attendees         ?? '',
      agenda:           r.agenda            ?? '',
      minutes:          r.minutes           ?? '',
      action_items:     r.action_items      ?? '',
      next_meeting_date: r.next_meeting_date ?? '',
      recurrence:       r.recurrence,
      prepared_by:      r.prepared_by       ?? '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim())    return setError('Title is required.')
    if (!form.meeting_date)    return setError('Meeting date is required.')
    setSaving(true); setError('')

    const url = editRecord
      ? `/api/projects/${projectId}/minutes/${editRecord.id}`
      : `/api/projects/${projectId}/minutes`
    const method = editRecord ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) return setError(json.error)
    setShowForm(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this meeting record?')) return
    await fetch(`/api/projects/${projectId}/minutes/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Badge ───────────────────────────────────────────────────────────────
  function RecurrenceBadge({ r }: { r: Minute['recurrence'] }) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{
          color: RECURRENCE_COLORS[r],
          background: RECURRENCE_COLORS[r] + '20',
        }}>
        {r !== 'none' && <Repeat2 size={10} />}
        {RECURRENCE_LABELS[r]}
      </span>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Meeting Minutes</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            {records.length} record{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (<>
            <button onClick={() => exportMinutesExcel(records, projectName)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
              style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
              <Sheet size={13} /> Excel
            </button>
            <button onClick={() => exportMinutesPdf(records, projectName)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
              style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
              <FileDown size={13} /> PDF
            </button>
          </>)}
          <Button onClick={openAdd}>
            <span className="flex items-center gap-2"><Plus size={15} /> New Minutes</span>
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Loading…</p>
      ) : records.length === 0 ? (
        <div className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <FileText size={28} style={{ color: 'var(--text-subtle)', margin: '0 auto 10px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No meeting minutes yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Record discussions, decisions and action items.
          </p>
          <button onClick={openAdd} className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'var(--bg-base)' }}>
            <Plus size={14} /> Add Meeting Minutes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const isOpen = expanded === r.id
            return (
              <div key={r.id} className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

                {/* Card header — always visible */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>

                  {/* Date badge */}
                  <div className="flex-shrink-0 w-12 text-center rounded-lg py-1"
                    style={{ background: 'rgba(249,115,22,0.12)' }}>
                    <p className="text-xs font-bold" style={{ color: '#f97316' }}>
                      {new Date(r.meeting_date + 'T00:00').toLocaleDateString('en-MY', { day: '2-digit' })}
                    </p>
                    <p className="text-xs" style={{ color: '#f97316' }}>
                      {new Date(r.meeting_date + 'T00:00').toLocaleDateString('en-MY', { month: 'short' })}
                    </p>
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-base)' }}>
                        {r.title}
                      </p>
                      <RecurrenceBadge r={r.recurrence} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {r.location && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                          <MapPin size={10} /> {r.location}
                        </span>
                      )}
                      {r.prepared_by && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                          <Users size={10} /> Prepared by: {r.prepared_by}
                        </span>
                      )}
                      {r.next_meeting_date && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                          <CalendarDays size={10} /> Next: {new Date(r.next_meeting_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-success)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                      title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                      title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Expand chevron */}
                  <div style={{ color: 'var(--text-subtle)' }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expandable content */}
                {isOpen && (
                  <div className="px-5 py-4 space-y-4 text-sm">
                    {r.attendees && (
                      <Section icon={<Users size={14} />} label="Attendees">
                        <pre className="whitespace-pre-wrap font-sans" style={{ color: 'var(--text-muted)' }}>{r.attendees}</pre>
                      </Section>
                    )}
                    {r.agenda && (
                      <Section icon={<ClipboardList size={14} />} label="Agenda">
                        <pre className="whitespace-pre-wrap font-sans" style={{ color: 'var(--text-muted)' }}>{r.agenda}</pre>
                      </Section>
                    )}
                    {r.minutes && (
                      <Section icon={<FileText size={14} />} label="Minutes / Discussion">
                        <pre className="whitespace-pre-wrap font-sans" style={{ color: 'var(--text-muted)' }}>{r.minutes}</pre>
                      </Section>
                    )}
                    {r.action_items && (
                      <Section icon={<RefreshCw size={14} />} label="Action Items">
                        <pre className="whitespace-pre-wrap font-sans" style={{ color: 'var(--text-muted)' }}>{r.action_items}</pre>
                      </Section>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <Modal
          title={editRecord ? 'Edit Meeting Minutes' : 'New Meeting Minutes'}
          onClose={() => setShowForm(false)}
          width="max-w-2xl"
        >
          <form onSubmit={handleSave} className="space-y-4">

            {/* Row 1: Title + Date */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Meeting Title" required>
                <Input placeholder="e.g. Weekly Progress Meeting" value={form.title} onChange={e => set('title', e.target.value)} />
              </Field>
              <Field label="Meeting Date" required>
                <Input type="date" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} />
              </Field>
            </div>

            {/* Row 2: Location + Recurrence */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Location / Venue">
                <Input placeholder="e.g. Site Office / Teams" value={form.location} onChange={e => set('location', e.target.value)} />
              </Field>
              <Field label="Recurrence">
                <Select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                  <option value="none">One-off (no recurrence)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
            </div>

            {/* Row 3: Prepared by + Next meeting */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prepared By">
                <Input placeholder="e.g. Ahmad bin Ali" value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} />
              </Field>
              <Field label="Next Meeting Date">
                <Input type="date" value={form.next_meeting_date} onChange={e => set('next_meeting_date', e.target.value)} />
              </Field>
            </div>

            {/* Attendees */}
            <Field label="Attendees" hint="One name per line or comma-separated">
              <Textarea
                rows={3}
                placeholder={'Ahmad bin Ali (PM)\nSiti Norhaiza (Engineer)\nJohn Lim (Client Rep)'}
                value={form.attendees}
                onChange={e => set('attendees', e.target.value)}
              />
            </Field>

            {/* Agenda */}
            <Field label="Agenda">
              <Textarea
                rows={3}
                placeholder={'1. Progress update\n2. Issues & defects\n3. Material delivery status'}
                value={form.agenda}
                onChange={e => set('agenda', e.target.value)}
              />
            </Field>

            {/* Minutes / Discussion */}
            <Field label="Minutes / Discussion">
              <Textarea
                rows={5}
                placeholder="Record discussion points, decisions made, items raised..."
                value={form.minutes}
                onChange={e => set('minutes', e.target.value)}
              />
            </Field>

            {/* Action Items */}
            <Field label="Action Items" hint="Who does what by when">
              <Textarea
                rows={4}
                placeholder={'1. Ahmad to submit material list by 15 Jan\n2. John to get client approval by 18 Jan\n3. Engineer to complete cable tray by 20 Jan'}
                value={form.action_items}
                onChange={e => set('action_items', e.target.value)}
              />
            </Field>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>
                {editRecord ? 'Save Changes' : 'Add Minutes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: '#f97316' }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  )
}
