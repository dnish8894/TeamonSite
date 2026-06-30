import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'
import BrandColorProvider from '@/components/BrandColorProvider'
import RoleGuard from '@/components/RoleGuard'

export const metadata: Metadata = {
  title: 'TeamOnSite',
  description: 'Field service management — TeamOnSite',
}

// Standalone, full-screen pages with no admin sidebar/role-guard.
// /scan is the public client questionnaire reached via QR — must not show the app shell.
const STANDALONE_PATHS = ['/login', '/setup', '/scan']

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h        = await headers()
  const pathname = h.get('x-pathname') ?? ''
  const isAuth   = STANDALONE_PATHS.some(p => pathname.startsWith(p))

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <BrandColorProvider />
          {isAuth ? (
            // Auth pages (login, setup) — full screen, no sidebar
            <div style={{ background: 'var(--bg-base)' }}>{children}</div>
          ) : (
            // App pages — sidebar + main
            <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
              <RoleGuard />
              <Sidebar />
              <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-base)' }}>
                {children}
              </main>
            </div>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}
