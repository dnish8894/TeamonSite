'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MapPin, Cpu, Wrench, AlertTriangle, CheckCircle } from 'lucide-react'

interface IntakeQuestion { id: string; label: string; type: 'choice' | 'text'; options: string[] }
interface ScanData {
  tier: string
  label: string
  sublabel: string
  details: Record<string, string>
  isEngineer: boolean
  system_type?: string | null
  intake_questions?: Record<string, IntakeQuestion[]>
  systems?: { id: string; name: string; type: string }[]
}

const URGENCY_OPTIONS: { label: string; priority: string }[] = [
  { label: 'Critical — not working / security risk', priority: 'P2' },
  { label: 'Affecting daily use',                     priority: 'P3' },
  { label: 'Minor / intermittent',                    priority: 'P4' },
]
const SYS_LABEL: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', pa: 'Public Address / Intercom',
  av: 'Audio Visual / VMS', structured_cabling: 'Structured Cabling', bms: 'BMS',
}

export default function ScanPage() {
  const { tier, id } = useParams<{ tier: string; id: string }>()
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [selectedSystem, setSelectedSystem] = useState('')   // for site QR
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [urgency, setUrgency] = useState('')

  useEffect(() => {
    fetch(`/api/scan/${tier}/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [tier, id])

  // Which system type's questionnaire to show
  const activeType = tier === 'site' ? selectedSystem : (data?.system_type ?? '')
  const questions = (data?.intake_questions?.[activeType] ?? [])

  async function submitFault(e: React.FormEvent) {
    e.preventDefault()

    // Compile a readable description from the structured answers
    const answeredLines = questions
      .filter(q => answers[q.id]?.trim())
      .map(q => `${q.label}: ${answers[q.id]}`)
    if (urgency) answeredLines.push(`Urgency: ${urgency}`)
    const compiled = [...answeredLines, form.description.trim() ? `Details: ${form.description.trim()}` : '']
      .filter(Boolean).join('\n')

    const priority = URGENCY_OPTIONS.find(u => u.label === urgency)?.priority ?? 'P3'
    const intakeAnswers = {
      system_type: activeType || null,
      urgency: urgency || null,
      answers: questions.filter(q => answers[q.id]?.trim()).map(q => ({ label: q.label, value: answers[q.id] })),
    }

    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: (answeredLines[0] ?? form.description).slice(0, 80) || 'Fault reported via QR',
        description: compiled || 'Fault reported via QR',
        reporter_name: form.name,
        site_id: data?.details?.site_id,
        device_id: tier === 'device' ? id : null,
        system_id: tier === 'system' ? id : null,
        type: 'breakdown',
        priority,
        intake_answers: intakeAnswers,
        source_qr_tier: tier,
        source_qr_id: id,
      }),
    })
    setSubmitted(true)
  }

  const tierIcon = tier === 'site' ? MapPin : tier === 'system' ? Layers : Cpu

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
      <div className="text-center p-8">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">QR code not found</p>
        <p className="text-gray-500 text-sm mt-1">This QR code may be invalid or expired.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
      <div className="text-center p-8 max-w-sm">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Report Submitted</h2>
        <p className="text-gray-500 mt-2 text-sm">
          Your fault report has been received. Our team will respond shortly.
        </p>
        <p className="text-xs text-gray-400 mt-6">Powered by teamonsite.app</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div style={{ background: '#1e2130' }} className="px-6 py-4 flex items-center gap-2">
        <span className="text-white font-bold text-lg">Report</span>
        <span className="text-blue-400 font-bold text-lg">Questionnaire</span>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        {/* Info card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ background: '#eff6ff' }}>
              <Wrench size={20} style={{ color: '#f97316' }} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{tier}</p>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{data.label}</h2>
            </div>
          </div>

          {data.sublabel && (
            <p className="text-gray-500 text-sm mb-3">{data.sublabel}</p>
          )}

          {Object.keys(data.details).filter(k => k !== 'site_id').length > 0 && (
            <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
              {Object.entries(data.details)
                .filter(([k]) => k !== 'site_id')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-gray-700 font-medium">{v}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Fault report form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-1">Report a Fault</h3>
          <p className="text-sm text-gray-500 mb-4">
            Describe the issue and we'll send a technician.
          </p>
          <form onSubmit={submitFault} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your Name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ahmad bin Ali"
                maxLength={120}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            {/* System picker — only for site-level QR */}
            {tier === 'site' && (data.systems?.length ?? 0) > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Which system is affected? <span className="text-red-500">*</span></label>
                <select required value={selectedSystem} onChange={e => { setSelectedSystem(e.target.value); setAnswers({}) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Select system —</option>
                  {data.systems!.map(s => (
                    <option key={s.id} value={s.type}>{s.name || (SYS_LABEL[s.type] ?? s.type)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic per-system questions */}
            {questions.map(q => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-gray-600 mb-1">{q.label}</label>
                {q.type === 'choice' ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options.filter(Boolean).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setAnswers(a => ({ ...a, [q.id]: a[q.id] === opt ? '' : opt }))}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                        style={answers[q.id] === opt
                          ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                          : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    maxLength={200} value={answers[q.id] ?? ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {/* Urgency — always shown */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">How urgent is it?</label>
              <div className="flex flex-col gap-2">
                {URGENCY_OPTIONS.map(u => (
                  <button key={u.label} type="button"
                    onClick={() => setUrgency(urgency === u.label ? '' : u.label)}
                    className="px-3 py-2 rounded-lg text-sm font-medium border text-left transition-all"
                    style={urgency === u.label
                      ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                      : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Anything else? {questions.length === 0 && <span className="text-red-500">*</span>}</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                rows={3}
                placeholder="Any other details that might help..."
                required={questions.length === 0}
                maxLength={4000}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <button type="submit"
              className="w-full py-3 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#f97316' }}>
              Submit Fault Report
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by teamonsite.app
        </p>
      </div>
    </div>
  )
}

function Layers({ size, style }: { size: number; style?: React.CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={style}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
}
