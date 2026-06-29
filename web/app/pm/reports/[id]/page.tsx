'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { Field, Input } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { ArrowLeft, FileDown, RotateCcw, Trash2 } from 'lucide-react'
import { generatePmReportPdf } from '@/lib/generatePmReportPdf'

const SYS_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control',
  structured_cabling: 'Structured Cabling', av: 'AV', pa: 'PA', bms: 'BMS',
}

interface DeviceLine {
  device_id: string; name: string | null; tag_id: string | null
  checks: Record<string, boolean>; notes: string
}
interface CheckItem { key: string; label: string }
const DEFAULT_CHECK_ITEMS: CheckItem[] = [
  { key: 'cleaned',    label: 'Device Cleaned' },
  { key: 'power_ok',   label: 'Power Supply OK' },
  { key: 'functional', label: 'Functioning Normally' },
]
interface ServiceEngineer { id: string; name: string }
interface Report {
  id: string; schedule_id: string; visit_date: string; summary: string | null
  status: string; devices: DeviceLine[]; service_engineers: ServiceEngineer[]
  started_at: string | null; completed_at: string | null
  engineer_id: string | null
  engineer_name: string | null; engineer_date: string | null; engineer_signature: string | null
  client_name: string | null;   client_date: string | null;   client_signature: string | null
  engineers: { users: { full_name: string } | null } | null
  sites: { name: string; address: string | null; clients: { name: string } | null } | null
  elv_systems: { name: string; type: string } | null
  pm_schedules: { name: string; next_due_at: string | null; interval_days: number } | null
}
interface Engineer { id: string; users: { full_name: string } | null }

function dateInput(v: string | null | undefined) { return v ? v.slice(0, 10) : '' }

export default function PmReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [org, setOrg] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const engSigRef = useRef<SignatureCanvas>(null)
  const cliSigRef = useRef<SignatureCanvas>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/pm/reports/${id}`).then(r => r.json()),
      fetch('/api/engineers').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([rep, eng, settings]) => {
      setReport(rep)
      setEngineers(Array.isArray(eng) ? eng : [])
      setOrg(settings)
      setLoading(false)
    })
  }, [id])

  // Re-apply saved signatures once canvases mount
  useEffect(() => {
    if (report?.engineer_signature && engSigRef.current) engSigRef.current.fromDataURL(report.engineer_signature)
    if (report?.client_signature && cliSigRef.current)   cliSigRef.current.fromDataURL(report.client_signature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const completed = report?.status === 'completed'
  const checkItems: CheckItem[] = Array.isArray(org?.pm_check_items) && (org!.pm_check_items as CheckItem[]).length > 0
    ? (org!.pm_check_items as CheckItem[])
    : DEFAULT_CHECK_ITEMS

  function patch(p: Partial<Report>) { setReport(r => r ? { ...r, ...p } : r) }
  function setLine(idx: number, p: Partial<DeviceLine>) {
    setReport(r => r ? { ...r, devices: r.devices.map((d, i) => i === idx ? { ...d, ...p } : d) } : r)
  }
  function setCheck(idx: number, key: string, val: boolean) {
    setReport(r => r ? {
      ...r,
      devices: r.devices.map((d, i) => i === idx ? { ...d, checks: { ...(d.checks ?? {}), [key]: val } } : d),
    } : r)
  }
  function toggleEngineer(eng: Engineer) {
    setReport(r => {
      if (!r) return r
      const exists = r.service_engineers?.some(e => e.id === eng.id)
      const list = exists
        ? r.service_engineers.filter(e => e.id !== eng.id)
        : [...(r.service_engineers ?? []), { id: eng.id, name: eng.users?.full_name ?? '' }]
      return { ...r, service_engineers: list }
    })
  }
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  async function save(markComplete: boolean) {
    if (!report) return
    setSaving(true)
    const engSig = engSigRef.current && !engSigRef.current.isEmpty()
      ? engSigRef.current.getTrimmedCanvas().toDataURL('image/png')
      : report.engineer_signature || null
    const cliSig = cliSigRef.current && !cliSigRef.current.isEmpty()
      ? cliSigRef.current.getTrimmedCanvas().toDataURL('image/png')
      : report.client_signature || null

    const body = {
      visit_date:  report.visit_date,
      started_at:  report.started_at,
      summary:     report.summary,
      engineer_id: report.engineer_id,
      engineer_name: report.engineer_name,
      engineer_date: report.engineer_date,
      client_name:   report.client_name,
      client_date:   report.client_date,
      engineer_signature: engSig,
      client_signature:   cliSig,
      devices: report.devices,
      service_engineers: report.service_engineers,
      ...(markComplete ? { status: 'completed' } : {}),
    }
    const res = await fetch(`/api/pm/reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch(`/api/pm/reports/${id}`).then(r => r.json())
      setReport(fresh)
      if (markComplete) {
        const due = fmtDate(fresh?.pm_schedules?.next_due_at)
        alert(due
          ? `Report completed.\n\nNext PM for “${fresh?.pm_schedules?.name ?? 'this schedule'}” is due on ${due}.`
          : 'Report completed.')
      }
    }
  }

  async function downloadPdf() {
    if (!report) return
    await generatePmReportPdf({ report: report as never, org: org as never, checkItems })
  }

  async function remove() {
    if (!confirm('Delete this report?')) return
    await fetch(`/api/pm/reports/${id}`, { method: 'DELETE' })
    router.push('/pm')
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading…</div>
  if (!report) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Report not found.</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <button onClick={() => router.push('/pm')}
            className="flex items-center gap-1.5 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={15} /> Servicing &amp; Schedules
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>
            PM Report — {report.pm_schedules?.name}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            📍 {report.sites?.name}{report.sites?.clients ? ` · ${report.sites.clients.name}` : ''}
            {report.elv_systems ? ` · 🔧 ${SYS_LABELS[report.elv_systems.type] ?? report.elv_systems.type}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={completed
              ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
              : { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            {completed ? 'Completed' : 'Draft'}
          </span>
          <Button variant="secondary" onClick={downloadPdf}>
            <span className="flex items-center gap-1.5"><FileDown size={15} /> Download PDF</span>
          </Button>
          <button onClick={remove} className="p-2 rounded-lg" style={{ color: 'var(--text-subtle)' }} title="Delete report">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Visit dates */}
      <section className="rounded-xl border p-5 mb-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Start Date">
            <Input type="date" value={dateInput(report.started_at)}
              onChange={e => patch({ started_at: e.target.value })} />
          </Field>
          <Field label="Visit Date">
            <Input type="date" value={dateInput(report.visit_date)}
              onChange={e => patch({ visit_date: e.target.value })} />
          </Field>
          <Field label="Completed Date">
            <Input type="date" value={dateInput(report.completed_at)} disabled
              onChange={() => {}} />
          </Field>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Servicing Engineers</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {engineers.map(eng => {
              const on = report.service_engineers?.some(e => e.id === eng.id)
              return (
                <button key={eng.id} type="button" onClick={() => toggleEngineer(eng)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={on
                    ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                    : { background: 'var(--bg-base)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  {on ? '✓ ' : ''}{eng.users?.full_name ?? 'Unknown'}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Devices */}
      <section className="rounded-xl border p-5 mb-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-base)' }}>
          Devices ({report.devices.length})
        </h2>
        <div className="rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
          {report.devices.length === 0 ? (
            <p className="text-sm px-3 py-3" style={{ color: 'var(--text-subtle)' }}>No devices on this report.</p>
          ) : report.devices.map((d, i) => (
            <div key={d.device_id} className="px-3 py-2.5 space-y-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                {d.name ?? 'Device'}{d.tag_id ? ` · ${d.tag_id}` : ''}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {checkItems.map(c => (
                  <label key={c.key} className="flex items-center gap-1.5 text-xs cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={!!d.checks?.[c.key]}
                      onChange={e => setCheck(i, c.key, e.target.checked)} />
                    {c.label}
                  </label>
                ))}
              </div>
              <Input placeholder="Remarks (optional)…" value={d.notes} onChange={e => setLine(i, { notes: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      {/* Overall remarks */}
      <section className="rounded-xl border p-5 mb-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-base)' }}>Overall Remarks</h2>
        <textarea rows={3} value={report.summary ?? ''} onChange={e => patch({ summary: e.target.value })}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
          placeholder="Summary of the visit…" />
      </section>

      {/* Sign-off */}
      <section className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Engineer */}
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#2563eb' }}>Engineer</p>
          <Field label="Name">
            <Input maxLength={120} value={report.engineer_name ?? ''}
              placeholder={report.engineers?.users?.full_name ?? ''}
              onChange={e => patch({ engineer_name: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={dateInput(report.engineer_date)} onChange={e => patch({ engineer_date: e.target.value })} />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signature</label>
              <button onClick={() => { engSigRef.current?.clear(); patch({ engineer_signature: null }) }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                <RotateCcw size={11} /> Clear
              </button>
            </div>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
              <SignatureCanvas ref={engSigRef} penColor="#1e3a8a"
                canvasProps={{ style: { width: '100%', height: '120px', display: 'block' } }} />
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-success)' }}>Client Representative</p>
          <Field label="Name" hint="Filled by client">
            <Input maxLength={120} placeholder="To be filled by client" value={report.client_name ?? ''}
              onChange={e => patch({ client_name: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={dateInput(report.client_date)} onChange={e => patch({ client_date: e.target.value })} />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signature</label>
              <button onClick={() => { cliSigRef.current?.clear(); patch({ client_signature: null }) }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                <RotateCcw size={11} /> Clear
              </button>
            </div>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
              <SignatureCanvas ref={cliSigRef} penColor="#15803d"
                canvasProps={{ style: { width: '100%', height: '120px', display: 'block' } }} />
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-10">
        <Button variant="secondary" onClick={() => save(false)} loading={saving}>Save Draft</Button>
        <Button onClick={() => save(true)} loading={saving}>Mark Completed</Button>
      </div>
    </div>
  )
}
