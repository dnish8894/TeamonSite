'use client'

import { useEffect, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { CheckCircle, FileDown } from 'lucide-react'
import { exportAcsSurveyPdf, AcsSurveyForm } from '@/lib/exportProject'

const today = new Date().toISOString().split('T')[0]

const emptyForm: AcsSurveyForm = {
  site_name: '', site_location: '', pic_name: '', pic_no: '',
  site_type: '', job_type: '',
  no_of_doors: '', door_license: '', type_of_doors: '',
  double_leaf_doors: '', single_leaf_doors: '', type_of_reader: '', shift_patterns: '',
  no_of_controllers: '', type_of_controller: '', no_of_sub_controllers: '', type_of_sub_controller: '',
  power_supply_required: '', cabling_by_infiniteql: '', hacking_drill: '', cable_measurement: '',
  installation_termination: '', existing_fire_signal: '', drawing_layout_required: '',
  touch_up_make_good: '', type_of_touch_up: '', paint_job: '', notes: '',
  surveyed_by: '', survey_date: today, survey_time: '',
}

export default function AcsSurveyTab({ projectId, projectName = 'Project' }: { projectId: string; projectName?: string }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState<AcsSurveyForm>(emptyForm)

  const set = (k: keyof AcsSurveyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`/api/projects/${projectId}/survey`).then(r => r.json()).then(data => {
      if (data?.acs_survey) setForm(f => ({ ...f, ...data.acs_survey }))
    })
  }, [projectId])

  async function save() {
    setSaving(true)
    // Auto-stamp the completion time (and date, if not chosen) when the survey is saved.
    const now = new Date()
    const completed: AcsSurveyForm = {
      ...form,
      survey_date: form.survey_date || now.toISOString().split('T')[0],
      survey_time: now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
    setForm(completed)
    await fetch(`/api/projects/${projectId}/survey`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acs_survey: completed }),
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
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>ACS Site Survey Form</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Access control system pre-installation survey</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportAcsSurveyPdf(form, projectName)}
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
        {/* Site Details */}
        <section>
          <SL>Site Details</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Site Name"><Input placeholder="e.g. Bangunan Public Bank" value={form.site_name} onChange={e => set('site_name', e.target.value)} /></Field>
            <Field label="Site Location"><Input placeholder="Address / building" value={form.site_location} onChange={e => set('site_location', e.target.value)} /></Field>
            <Field label="Person In Charge Name"><Input placeholder="e.g. Mr. Jaya" value={form.pic_name} onChange={e => set('pic_name', e.target.value)} /></Field>
            <Field label="PIC Contact No"><Input placeholder="+60-12-345 6789" value={form.pic_no} onChange={e => set('pic_no', e.target.value)} /></Field>
            <Field label="Site">
              <Select value={form.site_type} onChange={e => set('site_type', e.target.value)}>
                <option value="">— Select —</option>
                <option value="EXISTING SITE">Existing Site</option>
                <option value="NEW SITE">New Site</option>
              </Select>
            </Field>
            <Field label="Type of Job">
              <Select value={form.job_type} onChange={e => set('job_type', e.target.value)}>
                <option value="">— Select —</option>
                <option value="NEW">New</option>
                <option value="ADDITIONAL">Additional</option>
                <option value="NEW or ADDITIONAL">New &amp; Additional</option>
              </Select>
            </Field>
          </div>
        </section>

        {/* Doors */}
        <section>
          <SL>Doors</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="No of Doors"><Input type="number" value={form.no_of_doors} onChange={e => set('no_of_doors', e.target.value)} /></Field>
            <Field label="Door License"><Input type="number" value={form.door_license} onChange={e => set('door_license', e.target.value)} /></Field>
            <Field label="Type of Doors"><Input placeholder="e.g. Reader In & Reader Out" value={form.type_of_doors} onChange={e => set('type_of_doors', e.target.value)} /></Field>
            <Field label="Type of Reader"><Input placeholder="e.g. Face Reader, Card Reader" value={form.type_of_reader} onChange={e => set('type_of_reader', e.target.value)} /></Field>
            <Field label="No. of Double Leaf Doors"><Input type="number" value={form.double_leaf_doors} onChange={e => set('double_leaf_doors', e.target.value)} /></Field>
            <Field label="No. of Single Leaf Doors"><Input type="number" value={form.single_leaf_doors} onChange={e => set('single_leaf_doors', e.target.value)} /></Field>
            <Field label="Shift Patterns"><Input placeholder="e.g. 3 shifts, 24hr" value={form.shift_patterns} onChange={e => set('shift_patterns', e.target.value)} /></Field>
          </div>
        </section>

        {/* Backend Installation */}
        <section>
          <SL>Backend Installation Area</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="No. of Controller Required"><Input type="number" value={form.no_of_controllers} onChange={e => set('no_of_controllers', e.target.value)} /></Field>
            <Field label="Type of Controller"><Input value={form.type_of_controller} onChange={e => set('type_of_controller', e.target.value)} /></Field>
            <Field label="No. of Sub-Controllers"><Input type="number" value={form.no_of_sub_controllers} onChange={e => set('no_of_sub_controllers', e.target.value)} /></Field>
            <Field label="Type of Sub Controller"><Input placeholder="e.g. 4IN 2OUT Wiegand Module" value={form.type_of_sub_controller} onChange={e => set('type_of_sub_controller', e.target.value)} /></Field>
            <Field label="Power Supply Required"><Input type="number" value={form.power_supply_required} onChange={e => set('power_supply_required', e.target.value)} /></Field>
            <Field label="Cabling by InfiniteQL">
              <Select value={form.cabling_by_infiniteql} onChange={e => set('cabling_by_infiniteql', e.target.value)}>
                <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
              </Select>
            </Field>
            <Field label="Installation & Termination Work">
              <Select value={form.installation_termination} onChange={e => set('installation_termination', e.target.value)}>
                <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
              </Select>
            </Field>
            <Field label="Existing Fire Signal">
              <Select value={form.existing_fire_signal} onChange={e => set('existing_fire_signal', e.target.value)}>
                <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
              </Select>
            </Field>
            <Field label="Touch-Up & Make Good">
              <Select value={form.touch_up_make_good} onChange={e => set('touch_up_make_good', e.target.value)}>
                <option value="">— Select —</option><option value="Yes">Yes</option><option value="No">No</option>
              </Select>
            </Field>
            <Field label="Type of Touch Up"><Input placeholder="e.g. Minor (Plaster & etc)" value={form.type_of_touch_up} onChange={e => set('type_of_touch_up', e.target.value)} /></Field>
            <Field label="Drawing / Layout Planning Required"><Input value={form.drawing_layout_required} onChange={e => set('drawing_layout_required', e.target.value)} /></Field>
            <Field label="Paint Job"><Input value={form.paint_job} onChange={e => set('paint_job', e.target.value)} /></Field>
          </div>
          <div className="mt-4 space-y-4">
            <Field label="Hacking and Drill Requirement"><Textarea rows={2} value={form.hacking_drill} onChange={e => set('hacking_drill', e.target.value)} /></Field>
            <Field label="Cable Measurement"><Textarea rows={2} placeholder="e.g. 1xCat6, 2xAlarm cable, 2xDC cable (5 meter)..." value={form.cable_measurement} onChange={e => set('cable_measurement', e.target.value)} /></Field>
          </div>
        </section>

        {/* Notes & Sign-Off */}
        <section>
          <SL>Notes & Sign-Off</SL>
          <div className="space-y-4">
            <Field label="Notes"><Textarea rows={3} placeholder="Any additional remarks or special requirements..." value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Site Survey Done By"><Input placeholder="Engineer name" value={form.surveyed_by} onChange={e => set('surveyed_by', e.target.value)} /></Field>
              <Field label="Date of Survey"><Input type="date" value={form.survey_date} onChange={e => set('survey_date', e.target.value)} /></Field>
              <Field label="Time of Survey" hint="Auto-recorded when you save">
                <Input readOnly placeholder="Auto on save" value={form.survey_time}
                  style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }} />
              </Field>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => exportAcsSurveyPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> Download PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save Survey'}
          </Button>
        </div>
      </div>
    </div>
  )
}
