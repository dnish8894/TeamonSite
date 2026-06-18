'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import SignBlock from './SignBlock'
import SignatureCanvas from 'react-signature-canvas'
import { CheckCircle, Plus, Trash2, FileDown, Sheet } from 'lucide-react'
import { exportSurveyPdf, exportSurveyExcel } from '@/lib/exportProject'

const SYSTEMS = ['cctv','access_control','structured_cabling','av','pa','bms']
const SYS_LABELS: Record<string,string> = { cctv:'CCTV', access_control:'Access Control', structured_cabling:'Structured Cabling', av:'Audio Visual', pa:'Public Address', bms:'BMS' }

const today = new Date().toISOString().split('T')[0]

interface Area { name: string; floor: string; notes: string }

export default function SiteSurveyTab({ projectId, projectName = 'Project' }: { projectId: string; projectName?: string }) {
  const engSigRef = useRef<SignatureCanvas>(null)
  const cliSigRef = useRef<SignatureCanvas>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState({
    surveyed_by: '', survey_date: today,
    building_type: '', total_floors: '', total_area_sqft: '',
    access_notes: '', power_supply: '', power_notes: '',
    network_available: 'false', network_notes: '', cable_route_notes: '',
    systems_scope: [] as string[], areas: [] as Area[], remarks: '',
    prepared_by: '', prepared_date: today, client_name: '', client_date: today,
    engineer_signature: '', client_signature: '',
  })
  const set = (k: string, v: string | string[]) => setForm(f => ({ ...f, [k]: v }))
  const toggleSystem = (s: string) => set('systems_scope',
    form.systems_scope.includes(s) ? form.systems_scope.filter(x => x !== s) : [...form.systems_scope, s])
  const addArea    = () => setForm(f => ({ ...f, areas: [...f.areas, { name: '', floor: '', notes: '' }] }))
  const removeArea = (i: number) => setForm(f => ({ ...f, areas: f.areas.filter((_,idx) => idx !== i) }))
  const setArea    = (i: number, k: keyof Area, v: string) => setForm(f => {
    const a = [...f.areas]; a[i] = { ...a[i], [k]: v }; return { ...f, areas: a }
  })

  useEffect(() => {
    fetch(`/api/projects/${projectId}/survey`).then(r => r.json()).then(data => {
      if (!data) return
      setForm(f => ({ ...f, ...data,
        total_floors: data.total_floors?.toString() ?? '',
        total_area_sqft: data.total_area_sqft?.toString() ?? '',
        network_available: data.network_available?.toString() ?? 'false',
        systems_scope: data.systems_scope ?? [],
        areas: data.areas ?? [],
        survey_date: data.survey_date ?? today,
        prepared_date: data.prepared_date ?? today,
        client_date: data.client_date ?? today,
      }))
      if (data.engineer_signature) engSigRef.current?.fromDataURL(data.engineer_signature)
      if (data.client_signature)   cliSigRef.current?.fromDataURL(data.client_signature)
    })
  }, [projectId])

  async function save() {
    setSaving(true)
    const engSig = engSigRef.current && !engSigRef.current.isEmpty() ? engSigRef.current.getTrimmedCanvas().toDataURL() : form.engineer_signature || null
    const cliSig = cliSigRef.current && !cliSigRef.current.isEmpty() ? cliSigRef.current.getTrimmedCanvas().toDataURL() : form.client_signature || null
    await fetch(`/api/projects/${projectId}/survey`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form,
        total_floors: form.total_floors ? parseInt(form.total_floors) : null,
        total_area_sqft: form.total_area_sqft ? parseFloat(form.total_area_sqft) : null,
        network_available: form.network_available === 'true',
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
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Site Survey Form</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Pre-installation site assessment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportSurveyExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Excel
          </button>
          <button onClick={() => exportSurveyPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save Survey'}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Basic info */}
        <section>
          <SL>Survey Details</SL>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Surveyed By"><Input placeholder="Engineer name" value={form.surveyed_by} onChange={e => set('surveyed_by', e.target.value)} /></Field>
            <Field label="Survey Date"><Input type="date" value={form.survey_date} onChange={e => set('survey_date', e.target.value)} /></Field>
            <Field label="Building Type"><Input placeholder="e.g. Office Tower, Hospital" value={form.building_type} onChange={e => set('building_type', e.target.value)} /></Field>
            <Field label="Total Floors"><Input type="number" placeholder="10" value={form.total_floors} onChange={e => set('total_floors', e.target.value)} /></Field>
            <Field label="Total Area (sq ft)"><Input type="number" placeholder="50000" value={form.total_area_sqft} onChange={e => set('total_area_sqft', e.target.value)} /></Field>
          </div>
        </section>

        {/* Systems scope */}
        <section>
          <SL>Systems to Install</SL>
          <div className="flex flex-wrap gap-2">
            {SYSTEMS.map(s => {
              const sel = form.systems_scope.includes(s)
              return (
                <button key={s} type="button" onClick={() => toggleSystem(s)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                  style={sel
                    ? { background: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info)' }
                    : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                  {SYS_LABELS[s]}
                </button>
              )
            })}
          </div>
        </section>

        {/* Site conditions */}
        <section>
          <SL>Site Conditions</SL>
          <div className="space-y-4">
            <Field label="Access Notes / Restrictions">
              <Textarea rows={2} placeholder="Guard procedures, permits required, restricted areas..." value={form.access_notes} onChange={e => set('access_notes', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Power Supply Available">
                <Input placeholder="e.g. 240V single phase, 3-phase available" value={form.power_supply} onChange={e => set('power_supply', e.target.value)} />
              </Field>
              <Field label="Network Available">
                <Select value={form.network_available} onChange={e => set('network_available', e.target.value)}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              </Field>
            </div>
            <Field label="Power Notes">
              <Textarea rows={2} placeholder="DB location, conduit availability..." value={form.power_notes} onChange={e => set('power_notes', e.target.value)} />
            </Field>
            <Field label="Network Notes">
              <Textarea rows={2} placeholder="Network room location, existing infrastructure..." value={form.network_notes} onChange={e => set('network_notes', e.target.value)} />
            </Field>
            <Field label="Cable Routing Notes">
              <Textarea rows={3} placeholder="Proposed cable routes, trunking paths, ceiling access, riser locations..." value={form.cable_route_notes} onChange={e => set('cable_route_notes', e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Areas / Rooms */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SL>Areas / Rooms Surveyed</SL>
            <button onClick={addArea} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg ml-4"
              style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <Plus size={12} /> Add Area
            </button>
          </div>
          {form.areas.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No areas added. Click "Add Area" to add rooms/locations surveyed.</p>
          ) : (
            <div className="space-y-3">
              {form.areas.map((a, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4"><Input placeholder="Area/Room name" value={a.name} onChange={e => setArea(i, 'name', e.target.value)} /></div>
                  <div className="col-span-2"><Input placeholder="Floor" value={a.floor} onChange={e => setArea(i, 'floor', e.target.value)} /></div>
                  <div className="col-span-5"><Input placeholder="Notes / observations" value={a.notes} onChange={e => setArea(i, 'notes', e.target.value)} /></div>
                  <button onClick={() => removeArea(i)} className="col-span-1 mt-2" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Remarks */}
        <section>
          <SL>Remarks</SL>
          <Textarea rows={3} placeholder="Any additional remarks, concerns or special requirements..." value={form.remarks} onChange={e => set('remarks', e.target.value)} />
        </section>

        {/* Sign off */}
        <section>
          <SL>Sign Off</SL>
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
          <button onClick={() => exportSurveyExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Export Excel
          </button>
          <button onClick={() => exportSurveyPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> Export PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save Site Survey'}
          </Button>
        </div>
      </div>
    </div>
  )
}
