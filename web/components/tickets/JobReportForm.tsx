'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { CheckCircle, Plus, Trash2, RotateCcw, MapPin } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'

interface Part {
  device: string; qty: string; model: string; serial_no: string; remarks: string
}

interface ExtraField {
  id: string
  label: string
  field_type: 'text' | 'time' | 'location' | 'yes_no' | 'signature'
}

interface ReportData {
  findings: string
  root_cause: string
  work_done: string
  recommendation: string
  labour_hrs: string
  travel_hrs: string
  onsite_time: string
  offsite_time: string
  job_status: string
  remarks: string
  parts_used: Part[]
  // Engineer sign-off
  reported_by: string
  reported_date: string
  engineer_signature: string
  // Client sign-off
  client_name: string
  client_date: string
  client_signature: string
}

const today = new Date().toISOString().split('T')[0]
const empty: ReportData = {
  findings: '', root_cause: '', work_done: '', recommendation: '',
  labour_hrs: '', travel_hrs: '', onsite_time: '', offsite_time: '',
  job_status: 'in_progress', remarks: '', parts_used: [],
  reported_by: '', reported_date: today, engineer_signature: '',
  client_name: '', client_date: today, client_signature: '',
}

const emptyPart: Part = { device: '', qty: '1', model: '', serial_no: '', remarks: '' }

const JOB_STATUSES = [
  { value: 'in_progress',    label: 'In Progress' },
  { value: 'pending_parts',  label: 'Pending Parts' },
  { value: 'pending_client', label: 'Pending Client' },
  { value: 'resolved',       label: 'Resolved / Completed' },
]

function formatHrsMin(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default function JobReportForm({ ticketId, siteId, onSaved, locked = false, workSeconds = 0 }: { ticketId: string; siteId?: string | null; onSaved?: () => void; locked?: boolean; workSeconds?: number }) {
  const [form, setForm]     = useState<ReportData>(empty)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [extraFields, setExtraFields] = useState<ExtraField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const customSigRefs = useRef<Record<string, SignatureCanvas | null>>({})
  const sigRef       = useRef<SignatureCanvas>(null)
  const clientSigRef = useRef<SignatureCanvas>(null)

  const set = (k: keyof ReportData, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setCustom = (fieldId: string, v: string) => setCustomValues(v0 => ({ ...v0, [fieldId]: v }))

  useEffect(() => {
    if (!siteId) { setExtraFields([]); return }
    fetch('/api/settings')
      .then(r => r.json())
      .then(org => {
        const rs = org?.report_settings ?? {}
        const fields: ExtraField[] = rs.extra_fields ?? []
        const siteIds: string[] = rs.extra_field_site_ids ?? []
        setExtraFields(siteIds.includes(siteId) ? fields : [])
      })
  }, [siteId])

  function captureLocation(fieldId: string) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setCustom(fieldId, `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
      () => alert('Could not get location. Check browser permissions.'),
    )
  }

  useEffect(() => {
    fetch(`/api/tickets/${ticketId}/report`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm({
            findings:           data.findings      ?? '',
            root_cause:         data.root_cause     ?? '',
            work_done:          data.work_done      ?? '',
            recommendation:     data.recommendation ?? '',
            labour_hrs:         data.labour_hrs?.toString() ?? '',
            travel_hrs:         data.travel_hrs?.toString() ?? '',
            onsite_time:        data.onsite_time    ?? '',
            offsite_time:       data.offsite_time   ?? '',
            job_status:         data.job_status     ?? 'in_progress',
            client_name:        data.client_name    ?? '',
            remarks:            data.remarks        ?? '',
            parts_used:         data.parts_used?.length ? data.parts_used : [],
            reported_by:        data.reported_by        ?? '',
            reported_date:      data.reported_date       ?? today,
            engineer_signature: data.engineer_signature  ?? '',
            client_date:        data.client_date         ?? today,
            client_signature:   data.client_signature    ?? '',
          })
          if (data.engineer_signature && sigRef.current) {
            sigRef.current.fromDataURL(data.engineer_signature)
          }
          if (data.client_signature && clientSigRef.current) {
            clientSigRef.current.fromDataURL(data.client_signature)
          }
          setCustomValues(data.custom_field_values ?? {})
        }
        setLoading(false)
      })
  }, [ticketId])

  // Re-apply saved custom signature values once their canvases mount
  useEffect(() => {
    extraFields.forEach(f => {
      if (f.field_type === 'signature' && customValues[f.id]) {
        customSigRefs.current[f.id]?.fromDataURL(customValues[f.id])
      }
    })
  }, [extraFields, customValues])

  async function save() {
    if (locked) return
    setSaving(true)
    const engSig = sigRef.current && !sigRef.current.isEmpty()
      ? sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      : form.engineer_signature || null
    const clientSig = clientSigRef.current && !clientSigRef.current.isEmpty()
      ? clientSigRef.current.getTrimmedCanvas().toDataURL('image/png')
      : form.client_signature || null

    const finalCustomValues = { ...customValues }
    for (const f of extraFields) {
      if (f.field_type === 'signature') {
        const ref = customSigRefs.current[f.id]
        if (ref && !ref.isEmpty()) finalCustomValues[f.id] = ref.getTrimmedCanvas().toDataURL('image/png')
      }
    }

    const body = {
      findings:           form.findings       || null,
      root_cause:         form.root_cause     || null,
      work_done:          form.work_done      || null,
      recommendation:     form.recommendation || null,
      labour_hrs:         form.labour_hrs     ? parseFloat(form.labour_hrs) : (workSeconds > 0 ? Math.round((workSeconds / 3600) * 100) / 100 : null),
      travel_hrs:         form.travel_hrs     ? parseFloat(form.travel_hrs) : null,
      onsite_time:        form.onsite_time    || null,
      offsite_time:       form.offsite_time   || null,
      job_status:         form.job_status,
      client_name:        form.client_name    || null,
      client_date:        form.client_date    || null,
      remarks:            form.remarks        || null,
      parts_used:         form.parts_used.filter(p => p.device.trim()),
      reported_by:        form.reported_by    || null,
      reported_date:      form.reported_date  || null,
      engineer_signature: engSig,
      client_signature:   clientSig,
      custom_field_values: finalCustomValues,
    }
    await fetch(`/api/tickets/${ticketId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    onSaved?.()
  }

  function addPart() {
    setForm(f => ({ ...f, parts_used: [...f.parts_used, { ...emptyPart }] }))
  }
  function removePart(i: number) {
    setForm(f => ({ ...f, parts_used: f.parts_used.filter((_, idx) => idx !== i) }))
  }
  function setPart(i: number, k: keyof Part, v: string) {
    setForm(f => {
      const parts = [...f.parts_used]
      parts[i] = { ...parts[i], [k]: v }
      return { ...f, parts_used: parts }
    })
  }

  if (loading) return <div className="p-4 text-sm" style={{ color: 'var(--text-subtle)' }}>Loading report...</div>

  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Field Service Report</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Fill in by the engineer on-site</p>
        </div>
        <Button onClick={save} loading={saving} disabled={locked}>
          {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Saved</span> : 'Save Report'}
        </Button>
      </div>

      {locked && (
        <div className="px-5 py-3 text-sm" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
          Click "Start" on the Work Timer before filling in the field service report.
        </div>
      )}

      <div className="p-5 space-y-6" style={locked ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>

        {/* ── Time tracking ──────────────────────────── */}
        <section>
          <SectionLabel>On-Site Time Tracking</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
            <Field label="On-Site Time">
              <Input type="time" value={form.onsite_time} onChange={e => set('onsite_time', e.target.value)} />
            </Field>
            <Field label="Off-Site Time">
              <Input type="time" value={form.offsite_time} onChange={e => set('offsite_time', e.target.value)} />
            </Field>
            <Field label="Labour (hrs)">
              <Input type="number" min="0" step="0.5" placeholder="2.5" value={form.labour_hrs} onChange={e => set('labour_hrs', e.target.value)} />
            </Field>
            <Field label="Travel (hrs)">
              <Input type="number" min="0" step="0.5" placeholder="1.0" value={form.travel_hrs} onChange={e => set('travel_hrs', e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
            style={{ background: 'var(--color-success-bg)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
              Time Tracked (Start → Complete)
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
              {formatHrsMin(workSeconds)}
            </span>
          </div>
        </section>

        {/* ── Inspection / Observation ───────────────── */}
        <section>
          <SectionLabel>Inspection / Observation</SectionLabel>
          <div className="mt-3">
            <Textarea
              rows={4}
              placeholder="Describe what was found on-site. Include device condition, error codes, visual observations..."
              value={form.findings}
              onChange={e => set('findings', e.target.value)}
            />
          </div>
        </section>

        {/* ── Root Cause ─────────────────────────────── */}
        <section>
          <SectionLabel>Root Cause Analysis</SectionLabel>
          <div className="mt-3">
            <Textarea
              rows={3}
              placeholder="What caused the fault? e.g. Power surge damaged NVR HDD, Camera lens fogged due to moisture..."
              value={form.root_cause}
              onChange={e => set('root_cause', e.target.value)}
            />
          </div>
        </section>

        {/* ── Action Taken ───────────────────────────── */}
        <section>
          <SectionLabel>Action Taken / Analysis</SectionLabel>
          <div className="mt-3">
            <Textarea
              rows={4}
              placeholder="What did you do to fix the issue? e.g. Replaced HDD, reconfigured NVR channels, cleaned camera lens..."
              value={form.work_done}
              onChange={e => set('work_done', e.target.value)}
            />
          </div>
        </section>

        {/* ── Offsite / Recommendations ──────────────── */}
        <section>
          <SectionLabel>Offsite Repair Actions / Recommendations (if any)</SectionLabel>
          <div className="mt-3">
            <Textarea
              rows={3}
              placeholder="Any follow-up required? Parts to order, further inspection needed, client action items..."
              value={form.recommendation}
              onChange={e => set('recommendation', e.target.value)}
            />
          </div>
        </section>

        {/* ── Parts Used ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between">
            <SectionLabel>Details of Part(s) Replacement</SectionLabel>
            <button onClick={addPart}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <Plus size={12} /> Add Row
            </button>
          </div>

          <div className="mt-3 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                  {['Device / Part', 'Qty', 'Model', 'Serial No.', 'Remarks', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.parts_used.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
                      No parts added. Click "Add Row" to add a part.
                    </td>
                  </tr>
                ) : form.parts_used.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-2 py-1.5">
                      <input className="w-full bg-transparent text-sm outline-none"
                        style={{ color: 'var(--text-base)' }}
                        placeholder="e.g. Hard Disk Drive"
                        value={p.device} onChange={e => setPart(i, 'device', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5 w-14">
                      <input className="w-full bg-transparent text-sm outline-none text-center"
                        style={{ color: 'var(--text-base)' }}
                        type="number" min="1" value={p.qty}
                        onChange={e => setPart(i, 'qty', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="w-full bg-transparent text-sm outline-none"
                        style={{ color: 'var(--text-base)' }}
                        placeholder="Model no." value={p.model}
                        onChange={e => setPart(i, 'model', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="w-full bg-transparent text-sm outline-none"
                        style={{ color: 'var(--text-base)' }}
                        placeholder="Serial no." value={p.serial_no}
                        onChange={e => setPart(i, 'serial_no', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="w-full bg-transparent text-sm outline-none"
                        style={{ color: 'var(--text-base)' }}
                        placeholder="Remarks" value={p.remarks}
                        onChange={e => setPart(i, 'remarks', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5 w-8">
                      <button onClick={() => removePart(i)} style={{ color: 'var(--color-danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Extra Fields (from Settings → FSR & Reports, assigned to this site) ──── */}
        {extraFields.length > 0 && (
          <section>
            <SectionLabel>Additional Information</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              {extraFields.map(f => {
                if (f.field_type === 'text') {
                  return (
                    <Field key={f.id} label={f.label}>
                      <Input value={customValues[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />
                    </Field>
                  )
                }
                if (f.field_type === 'time') {
                  return (
                    <Field key={f.id} label={f.label}>
                      <Input type="time" value={customValues[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />
                    </Field>
                  )
                }
                if (f.field_type === 'yes_no') {
                  return (
                    <div key={f.id}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                      <div className="flex gap-2">
                        {['yes', 'no'].map(opt => (
                          <button key={opt} type="button" onClick={() => setCustom(f.id, opt)}
                            className="flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-all"
                            style={customValues[f.id] === opt
                              ? { background: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info)' }
                              : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                }
                if (f.field_type === 'location') {
                  return (
                    <div key={f.id}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                      <div className="flex gap-2">
                        <Input placeholder="lat, lng" value={customValues[f.id] ?? ''} onChange={e => setCustom(f.id, e.target.value)} />
                        <button type="button" onClick={() => captureLocation(f.id)}
                          className="flex items-center gap-1 px-3 rounded-lg text-xs font-medium flex-shrink-0"
                          style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                          <MapPin size={13} /> Use My Location
                        </button>
                      </div>
                    </div>
                  )
                }
                if (f.field_type === 'signature') {
                  return (
                    <div key={f.id} className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                        <button type="button"
                          onClick={() => { customSigRefs.current[f.id]?.clear(); setCustom(f.id, '') }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                          <RotateCcw size={11} /> Clear
                        </button>
                      </div>
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
                        <SignatureCanvas
                          ref={(r) => { customSigRefs.current[f.id] = r }}
                          penColor="#1e3a8a"
                          canvasProps={{ style: { width: '100%', height: '120px', display: 'block' } }} />
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </section>
        )}

        {/* ── Job Status + Remarks ───────────────────── */}
        <section>
          <SectionLabel>Job Status & Remarks</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <Field label="Job Status">
              <Select value={form.job_status} onChange={e => set('job_status', e.target.value)}>
                {JOB_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Client Rep. Name (for sign-off)">
              <Input placeholder="Name of client who acknowledged" value={form.client_name}
                onChange={e => set('client_name', e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Remarks">
              <Textarea rows={2} placeholder="Any additional remarks..." value={form.remarks}
                onChange={e => set('remarks', e.target.value)} />
            </Field>
          </div>
        </section>

        {/* ── Acknowledgement ────────────────────────── */}
        <section>
          <SectionLabel>Acknowledgement</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">

            {/* Engineer side */}
            <div className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-info)' }}>
                Tech / Engineer
              </p>
              <Field label="Engineer Name">
                <Input placeholder="Full name" value={form.reported_by}
                  onChange={e => set('reported_by', e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.reported_date}
                  onChange={e => set('reported_date', e.target.value)} />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signature</label>
                  <button onClick={() => { sigRef.current?.clear(); set('engineer_signature', '') }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                    style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                    <RotateCcw size={11} /> Clear
                  </button>
                </div>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
                  <SignatureCanvas ref={sigRef} penColor="#1e3a8a"
                    canvasProps={{ style: { width: '100%', height: '120px', display: 'block' } }} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Sign using mouse or touch</p>
              </div>
            </div>

            {/* Client side */}
            <div className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-success)' }}>
                Client Representative
              </p>
              <Field label="Client Rep. Name" hint="Leave blank — client fills this">
                <Input placeholder="To be filled by client" value={form.client_name}
                  onChange={e => set('client_name', e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.client_date}
                  onChange={e => set('client_date', e.target.value)} />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signature</label>
                  <button onClick={() => { clientSigRef.current?.clear(); set('client_signature', '') }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                    style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                    <RotateCcw size={11} /> Clear
                  </button>
                </div>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
                  <SignatureCanvas ref={clientSigRef} penColor="#15803d"
                    canvasProps={{ style: { width: '100%', height: '120px', display: 'block' } }} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Client signs here before engineer leaves</p>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{children}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}
