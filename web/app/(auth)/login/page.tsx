'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router   = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return setError('Email and password are required.')
    setLoading(true)
    setError('')

    const supabase = getSupabaseBrowser()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : authError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span style={{ color: 'var(--text-base)' }}>TeamOn</span>
            <span style={{ color: '#f97316' }}>Site</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-7 space-y-5 shadow-sm"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-subtle)' }} />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm border outline-none transition-colors"
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-base)',
                }}
                onFocus={e  => (e.target.style.borderColor = '#f97316')}
                onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-subtle)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm border outline-none transition-colors"
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-base)',
                }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-subtle)' }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{ background: '#f97316', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-subtle)' }}>
          TeamOnSite · Local Development
        </p>
      </div>
    </div>
  )
}
