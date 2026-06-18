'use client'

import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Field, Input } from '@/components/ui/Field'
import { RotateCcw } from 'lucide-react'

interface Props {
  role: string
  color: string
  name: string; onName: (v: string) => void
  date: string; onDate: (v: string) => void
  sigRef: React.RefObject<SignatureCanvas>
  savedSig?: string
  onClear: () => void
}

export default function SignBlock({ role, color, name, onName, date, onDate, sigRef, onClear }: Props) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{role}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input placeholder="Full name" value={name} onChange={e => onName(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={e => onDate(e.target.value)} />
        </Field>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Signature</label>
          <button onClick={onClear} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <RotateCcw size={11} /> Clear
          </button>
        </div>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: '#fff' }}>
          <SignatureCanvas ref={sigRef} penColor={color}
            canvasProps={{ style: { width: '100%', height: '100px', display: 'block' } }} />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Sign using mouse or touch</p>
      </div>
    </div>
  )
}
