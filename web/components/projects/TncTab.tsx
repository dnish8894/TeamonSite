'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import SignBlock from './SignBlock'
import SignatureCanvas from 'react-signature-canvas'
import { CheckCircle, Plus, Trash2, FileDown, Sheet } from 'lucide-react'
import { exportTncPdf, exportTncExcel } from '@/lib/exportProject'

const today = new Date().toISOString().split('T')[0]

export default function TncTab({ projectId, projectName = 'Project' }: { projectId: string; projectName?: string }) {
  const engSigRef = useRef<SignatureCanvas>(null)
  const cliSigRef = useRef<SignatureCanvas>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState({
    scope_items: [] as string[],
    exclusions: [] as string[],
    warranty_months: '12',
    defect_liability_months: '12',
    payment_terms: '',
    special_conditions: '',
    prepared_by: '', prepared_date: today,
    client_name: '', client_date: today,
    engineer_signature: '', client_signature: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tnc`).then(r => r.json()).then(data => {
      if (!data) return
      setForm(f => ({ ...f, ...data,
        warranty_months: data.warranty_months?.toString() ?? '12',
        defect_liability_months: data.defect_liability_months?.toString() ?? '12',
        scope_items: data.scope_items ?? [],
        exclusions: data.exclusions ?? [],
        prepared_date: data.prepared_date ?? today,
        client_date: data.client_date ?? today,
      }))
      if (data.engineer_signature) engSigRef.current?.fromDataURL(data.engineer_signature)
      if (data.client_signature)   cliSigRef.current?.fromDataURL(data.client_signature)
    })
  }, [projectId])

  const addScope     = () => setForm(f => ({ ...f, scope_items: [...f.scope_items, ''] }))
  const setScope     = (i: number, v: string) => setForm(f => { const a = [...f.scope_items]; a[i] = v; return { ...f, scope_items: a } })
  const removeScope  = (i: number) => setForm(f => ({ ...f, scope_items: f.scope_items.filter((_,idx) => idx !== i) }))
  const addExcl      = () => setForm(f => ({ ...f, exclusions: [...f.exclusions, ''] }))
  const setExcl      = (i: number, v: string) => setForm(f => { const a = [...f.exclusions]; a[i] = v; return { ...f, exclusions: a } })
  const removeExcl   = (i: number) => setForm(f => ({ ...f, exclusions: f.exclusions.filter((_,idx) => idx !== i) }))

  async function save() {
    setSaving(true)
    const engSig = engSigRef.current && !engSigRef.current.isEmpty() ? engSigRef.current.getTrimmedCanvas().toDataURL() : form.engineer_signature || null
    const cliSig = cliSigRef.current && !cliSigRef.current.isEmpty() ? cliSigRef.current.getTrimmedCanvas().toDataURL() : form.client_signature || null
    await fetch(`/api/projects/${projectId}/tnc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form,
        warranty_months: parseInt(form.warranty_months),
        defect_liability_months: parseInt(form.defect_liability_months),
        engineer_signature: engSig, client_signature: cliSig,
      }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const SL = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{children}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )

  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Terms & Conditions / Scope of Work</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Project scope, exclusions and contractual terms</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportTncExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}
            title="Export Excel">
            <Sheet size={13} /> Excel
          </button>
          <button onClick={() => exportTncPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}
            title="Export PDF">
            <FileDown size={13} /> PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save TNC'}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Scope of work */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SL>Scope of Work</SL>
            <button onClick={addScope} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg ml-4"
              style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <Plus size={12} /> Add Item
            </button>
          </div>
          {form.scope_items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No scope items. Click "Add Item" to define what is included.</p>
          ) : (
            <div className="space-y-2">
              {form.scope_items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-bold w-6 text-center" style={{ color: 'var(--text-subtle)' }}>{i+1}.</span>
                  <Input placeholder="e.g. Supply and install 16 units IP CCTV cameras" value={item} onChange={e => setScope(i, e.target.value)} />
                  <button onClick={() => removeScope(i)} style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Exclusions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SL>Exclusions</SL>
            <button onClick={addExcl} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg ml-4"
              style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <Plus size={12} /> Add Item
            </button>
          </div>
          {form.exclusions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No exclusions. Click "Add Item" to define what is NOT included.</p>
          ) : (
            <div className="space-y-2">
              {form.exclusions.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-bold w-6 text-center" style={{ color: 'var(--text-subtle)' }}>{i+1}.</span>
                  <Input placeholder="e.g. Civil works, false ceiling reinstatement" value={item} onChange={e => setExcl(i, e.target.value)} />
                  <button onClick={() => removeExcl(i)} style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Terms */}
        <section>
          <SL>Contract Terms</SL>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Warranty Period">
              <Select value={form.warranty_months} onChange={e => set('warranty_months', e.target.value)}>
                {[6,12,18,24,36].map(m => <option key={m} value={m}>{m} months</option>)}
              </Select>
            </Field>
            <Field label="Defect Liability Period (DLP)">
              <Select value={form.defect_liability_months} onChange={e => set('defect_liability_months', e.target.value)}>
                {[3,6,12,18,24].map(m => <option key={m} value={m}>{m} months</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4 space-y-4">
            <Field label="Payment Terms">
              <Textarea rows={3} placeholder="e.g. 30% deposit upon award, 40% upon delivery, 30% upon completion..." value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} />
            </Field>
            <Field label="Special Conditions">
              <Textarea rows={3} placeholder="Any special terms, client requirements, regulatory compliance..." value={form.special_conditions} onChange={e => set('special_conditions', e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Sign off */}
        <section>
          <SL>Acknowledgement & Acceptance</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignBlock role="Prepared By (Engineer)" color="#f97316"
              name={form.prepared_by} onName={v => set('prepared_by', v)}
              date={form.prepared_date} onDate={v => set('prepared_date', v)}
              sigRef={engSigRef} onClear={() => { engSigRef.current?.clear(); set('engineer_signature', '') }} />
            <SignBlock role="Client Representative" color="#16a34a"
              name={form.client_name} onName={v => set('client_name', v)}
              date={form.client_date} onDate={v => set('client_date', v)}
              sigRef={cliSigRef} onClear={() => { cliSigRef.current?.clear(); set('client_signature', '') }} />
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => exportTncExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Export Excel
          </button>
          <button onClick={() => exportTncPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> Export PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save TNC'}
          </Button>
        </div>
      </div>
    </div>
  )
}
