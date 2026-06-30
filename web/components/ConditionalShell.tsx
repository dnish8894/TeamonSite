'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import RoleGuard from '@/components/RoleGuard'

// Standalone, full-screen pages with no admin sidebar/role-guard.
// /scan is the public client questionnaire reached via QR.
const STANDALONE_PATHS = ['/login', '/setup', '/scan']

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const standalone = STANDALONE_PATHS.some(p => pathname.startsWith(p))

  if (standalone) {
    return <div style={{ background: 'var(--bg-base)' }}>{children}</div>
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <RoleGuard />
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-base)' }}>
        {children}
      </main>
    </div>
  )
}
