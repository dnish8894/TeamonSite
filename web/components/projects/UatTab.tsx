'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import SignBlock from './SignBlock'
import SignatureCanvas from 'react-signature-canvas'
import { CheckCircle, Plus, Trash2, FileDown, Sheet } from 'lucide-react'
import { exportUatPdf, exportUatExcel } from '@/lib/exportProject'

const today = new Date().toISOString().split('T')[0]

const DEFAULT_TESTS: Record<string, string[]> = {
  cctv: [
    'Camera image quality — clear and sharp',
    'Camera housing — clean, no condensation',
    'IR night vision — functioning correctly',
    'Camera angle and coverage — as per layout',
    'NVR recording — all channels active',
    'HDD storage — no warnings or errors',
    'Playback test — minimum 30 days footage',
    'Remote viewing — VMS / mobile app accessible',
    'Motion detection alerts — triggering correctly',
    'All cameras pingable on network',
  ],
  access_control: [
    'Card reader — reads all card types correctly',
    'Door lock — engages and releases properly',
    'Door sensor — open/close detected correctly',
    'Access controller — no fault indicators',
    'Access management software — operational',
    'Event logs — recording all access events',
    'Anti-passback — functioning',
    'Emergency release — manual override tested',
    'Backup power / battery — tested',
    'All doors accessible via software',
  ],
  structured_cabling: [
    'All cable ports tested and certified',
    'Patch panel — all ports labelled correctly',
    'Cable routing — contained in trunking/trays',
    'Terminations — no loose or damaged ends',
    'Port schedule — updated and accurate',
    'Cat6 test results — all ports pass standard',
    'Fibre links — tested with OTDR (if applicable)',
  ],
  av: [
    'Display screens — all powered and showing signal',
    'Audio system — no distortion or feedback',
    'Video distribution — all zones receiving signal',
    'Control system — all buttons/commands functional',
    'Cabling — all neatly routed and labelled',
  ],
  pa: [
    'PA amplifier — powering correctly',
    'All speakers — producing clear audio',
    'Zone control — individual zones switchable',
    'Microphone/paging — clear and audible',
    'Background music input — functional',
    'Emergency announcement — priority override working',
  ],
}

interface TestItem { system: string; description: string; result: 'pass' | 'fail' | 'na' | 'pending'; notes: string }

export default function UatTab({ projectId, projectName = 'Project' }: { projectId: string; projectName?: string }) {
  const engSigRef = useRef<SignatureCanvas>(null)
  const cliSigRef = useRef<SignatureCanvas>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [form, setForm] = useState({
    tested_by: '', test_date: today,
    test_items: [] as TestItem[],
    overall_result: 'pending', remarks: '',
    prepared_by: '', prepared_date: today,
    client_name: '', client_date: today,
    engineer_signature: '', client_signature: '',
  })
  const set = (k: string, v: string | TestItem[]) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`/api/projects/${projectId}/uat`).then(r => r.json()).then(data => {
      if (!data) return
      setForm(f => ({ ...f, ...data,
        test_items: data.test_items ?? [],
        test_date: data.test_date ?? today,
        prepared_date: data.prepared_date ?? today,
        client_date: data.client_date ?? today,
      }))
      if (data.engineer_signature) engSigRef.current?.fromDataURL(data.engineer_signature)
      if (data.client_signature)   cliSigRef.current?.fromDataURL(data.client_signature)
    })
  }, [projectId])

  function addDefaultTests(system: string) {
    const tests = DEFAULT_TESTS[system] ?? []
    const newItems: TestItem[] = tests.map(t => ({ system, description: t, result: 'pending', notes: '' }))
    setForm(f => ({ ...f, test_items: [...f.test_items.filter(i => i.system !== system), ...newItems] }))
  }

  function addCustomTest(system: string) {
    setForm(f => ({ ...f, test_items: [...f.test_items, { system, description: '', result: 'pending', notes: '' }] }))
  }

  function updateItem(i: number, k: keyof TestItem, v: string) {
    setForm(f => { const items = [...f.test_items]; items[i] = { ...items[i], [k]: v } as TestItem; return { ...f, test_items: items } })
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, test_items: f.test_items.filter((_, idx) => idx !== i) }))
  }

  const systems = [...new Set(form.test_items.map(i => i.system))]
  const passCount = form.test_items.filter(i => i.result === 'pass').length
  const failCount = form.test_items.filter(i => i.result === 'fail').length
  const total     = form.test_items.length

  async function save() {
    setSaving(true)
    const engSig = engSigRef.current && !engSigRef.current.isEmpty() ? engSigRef.current.getTrimmedCanvas().toDataURL() : form.engineer_signature || null
    const cliSig = cliSigRef.current && !cliSigRef.current.isEmpty() ? cliSigRef.current.getTrimmedCanvas().toDataURL() : form.client_signature || null
    await fetch(`/api/projects/${projectId}/uat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, engineer_signature: engSig, client_signature: cliSig }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const RESULT_STYLE: Record<string,{ color: string; bg: string }> = {
    pass:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    fail:    { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)'  },
    na:      { color: 'var(--text-subtle)',   bg: 'var(--border)'           },
    pending: { color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)'   },
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
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>User Acceptance Testing (UAT)</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>System testing and client sign-off</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportUatExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Excel
          </button>
          <button onClick={() => exportUatPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save UAT'}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Header info */}
        <section>
          <SL>Test Details</SL>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Tested By"><Input placeholder="Engineer name" value={form.tested_by} onChange={e => set('tested_by', e.target.value)} /></Field>
            <Field label="Test Date"><Input type="date" value={form.test_date} onChange={e => set('test_date', e.target.value)} /></Field>
            <Field label="Overall Result">
              <Select value={form.overall_result} onChange={e => set('overall_result', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="conditional_pass">Conditional Pass</option>
                <option value="fail">Fail</option>
              </Select>
            </Field>
            {total > 0 && (
              <div className="flex flex-col justify-end">
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Results</p>
                <p className="text-sm font-semibold mt-0.5">
                  <span style={{ color: 'var(--color-success)' }}>{passCount} pass</span>
                  {' · '}
                  <span style={{ color: 'var(--color-danger)' }}>{failCount} fail</span>
                  {' · '}
                  <span style={{ color: 'var(--text-subtle)' }}>{total - passCount - failCount} pending</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Add system tests */}
        <section>
          <SL>Add Test Items by System</SL>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.keys(DEFAULT_TESTS).map(sys => (
              <button key={sys} onClick={() => addDefaultTests(sys)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info)' }}>
                + {sys.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} Tests
              </button>
            ))}
          </div>

          {/* Test items table */}
          {form.test_items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No test items yet. Click a system above to add default tests.</p>
          ) : (
            <div className="space-y-4">
              {systems.map(sys => {
                const items = form.test_items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.system === sys)
                const sysPass = items.filter(({ item }) => item.result === 'pass').length
                const sysFail = items.filter(({ item }) => item.result === 'fail').length
                return (
                  <div key={sys}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                          style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                          {sys.replace(/_/g,' ').toUpperCase()}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {sysPass}/{items.length} pass{sysFail > 0 ? ` · ${sysFail} fail` : ''}
                        </span>
                      </div>
                      <button onClick={() => addCustomTest(sys)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                        <Plus size={11} /> Add custom
                      </button>
                    </div>
                    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                            <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Test Item</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold w-28" style={{ color: 'var(--text-subtle)' }}>Result</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>Notes</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(({ item, idx }) => {
                            const rs = RESULT_STYLE[item.result]
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="px-3 py-2">
                                  <input className="w-full bg-transparent text-sm outline-none"
                                    style={{ color: 'var(--text-base)' }}
                                    value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                </td>
                                <td className="px-2 py-2">
                                  <select
                                    className="text-xs font-semibold px-2 py-1 rounded-full outline-none border-0 cursor-pointer"
                                    style={{ background: rs.bg, color: rs.color }}
                                    value={item.result}
                                    onChange={e => updateItem(idx, 'result', e.target.value)}>
                                    <option value="pending">Pending</option>
                                    <option value="pass">Pass</option>
                                    <option value="fail">Fail</option>
                                    <option value="na">N/A</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input className="w-full bg-transparent text-xs outline-none"
                                    style={{ color: 'var(--text-muted)' }}
                                    placeholder="Optional notes..."
                                    value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                                </td>
                                <td className="px-2">
                                  <button onClick={() => removeItem(idx)} style={{ color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Remarks */}
        <section>
          <SL>Remarks</SL>
          <Textarea rows={3} placeholder="Overall testing remarks, outstanding items, conditions for acceptance..." value={form.remarks} onChange={e => set('remarks', e.target.value)} />
        </section>

        {/* Sign off */}
        <section>
          <SL>Acceptance Sign Off</SL>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignBlock role="Tested By (Engineer)" color="#f97316"
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
          <button onClick={() => exportUatExcel(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            <Sheet size={13} /> Export Excel
          </button>
          <button onClick={() => exportUatPdf(form, projectName)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.10)' }}>
            <FileDown size={13} /> Export PDF
          </button>
          <Button onClick={save} loading={saving}>
            {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save UAT'}
          </Button>
        </div>
      </div>
    </div>
  )
}
