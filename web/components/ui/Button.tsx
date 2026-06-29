interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

export default function Button({ variant = 'primary', loading, children, disabled, ...props }: ButtonProps) {
  const styles = {
    primary:   { background: 'var(--brand-accent, #f97316)', color: '#fff' },
    secondary: { background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    danger:    { background: 'var(--color-danger)', color: '#fff' },
  }

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 border border-transparent"
      style={styles[variant]}
    >
      {loading ? 'Saving...' : children}
    </button>
  )
}
