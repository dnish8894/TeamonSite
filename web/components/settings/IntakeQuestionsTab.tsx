'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, CheckCircle } from 'lucide-react'
import { Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

export interface IntakeQuestion {
  id: string
  label: string
  type: 'choice' | 'text'
  options: string[]
}
export type IntakeQuestions = Record<string, IntakeQuestion[]>

const SYSTEM_TYPES: { key: string; label: string }[] = [
  { key: 'cctv', label: 'CCTV' },
  { key: 'access_control', label: 'Access Control' },
  { key: 'pa', label: 'Public Address / Intercom' },
  { key: 'av', label: 'Audio Visual / VMS' },
  { key: 'structured_cabling', label: 'Structured Cabling' },
  { key: 'bms', label: 'BMS' },
]

const newQuestion = (): IntakeQuestion => ({ id: crypto.randomUUID(), label: '', type: 'choice', options: [''] })

export default function IntakeQuestionsTab({
  value, onChange, onSave, saving, saved,
}: {
  value: IntakeQuestions
  onChange: (v: IntakeQuestions) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const [activeType, setActiveType] = useState(SYSTEM_TYPES[0].key)
  const questions = value[activeType] ?? []

  function update(qs: IntakeQuestion[]) {
    onChange({ ...value, [activeType]: qs })
  }
  function addQ()        { update([...questions, newQuestion()]) }
  function removeQ(i: number) { update(questions.filter((_, idx) => idx !== i)) }
  function setQ(i: number, patch: Partial<IntakeQuestion>) {
    update(questions.map((q, idx) => idx === i ? { ...q, ...patch } : q))
  }
  function setOpt(i: number, oi: number, v: string) {
    const opts = [...questions[i].options]; opts[oi] = v
    setQ(i, { options: opts })
  }
  function addOpt(i: number)        { setQ(i, { options: [...questions[i].options, ''] }) }
  function removeOpt(i: number, oi: number) { setQ(i, { options: questions[i].options.filter((_, x) => x !== oi) }) }

  return (
    <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>QR Fault Form Questions</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Guided questions shown to clients when they scan a QR and report a fault, per system type.</p>
        </div>
        <Button onClick={onSave} loading={saving}>
          {saved ? <span className="flex items-center gap-1.5"><CheckCircle size={14}/> Saved</span> : 'Save Questions'}
        </Button>
      </div>

      <div className="p-5">
        {/* System type tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {SYSTEM_TYPES.map(s => {
            const count = (value[s.key] ?? []).length
            return (
              <button key={s.key} onClick={() => setActiveType(s.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={activeType === s.key
                  ? { background: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info)' }
                  : { background: 'transparent', color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
                {s.label}{count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>

        {questions.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: 'var(--text-subtle)' }}>No questions for this system yet. Clients will just see the free-text box.</p>
        ) : (
          <div className="space-y-4 mb-4">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
                <div className="flex items-start gap-2">
                  <GripVertical size={16} style={{ color: 'var(--text-subtle)', marginTop: 8 }} />
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Input placeholder="Question (e.g. Which camera is affected?)" value={q.label} onChange={e => setQ(i, { label: e.target.value })} />
                      </div>
                      <Select value={q.type} onChange={e => setQ(i, { type: e.target.value as 'choice' | 'text' })}>
                        <option value="choice">Multiple choice</option>
                        <option value="text">Short text</option>
                      </Select>
                    </div>
                    {q.type === 'choice' && (
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input placeholder={`Option ${oi + 1}`} value={opt} onChange={e => setOpt(i, oi, e.target.value)} />
                            {q.options.length > 1 && (
                              <button onClick={() => removeOpt(i, oi)} style={{ color: 'var(--color-danger)' }}><Trash2 size={13} /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addOpt(i)} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-info)' }}>
                          <Plus size={12} /> Add option
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeQ(i)} style={{ color: 'var(--color-danger)' }} title="Remove question"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={addQ}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border w-full justify-center"
          style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
          <Plus size={14} /> Add Question
        </button>

        <div className="mt-5 rounded-lg p-3 text-xs" style={{ background: 'var(--bg-base)', color: 'var(--text-subtle)' }}>
          An <strong>urgency</strong> question is always shown on the form and maps to ticket priority
          (Critical → P2, Affecting use → P3, Minor → P4) — you don't need to add it here.
        </div>
      </div>
    </div>
  )
}
