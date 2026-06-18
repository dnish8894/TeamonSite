interface FieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}

export function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{hint}</p>}
    </div>
  )
}

const inputBase = `
  w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors
`
const inputStyle = {
  background: 'var(--bg-base)',
  color: 'var(--text-base)',
  borderColor: 'var(--border)',
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputBase} ${props.className ?? ''}`}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputBase} resize-none ${props.className ?? ''}`}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} ${props.className ?? ''}`}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  )
}
