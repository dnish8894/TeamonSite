'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-base)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.background = ''
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
