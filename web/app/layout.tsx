import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import BrandColorProvider from '@/components/BrandColorProvider'
import ConditionalShell from '@/components/ConditionalShell'

export const metadata: Metadata = {
  title: 'TeamOnSite',
  description: 'Field service management — TeamOnSite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <BrandColorProvider />
          {/* Sidebar vs standalone is decided client-side via usePathname (reliable,
              no dependency on a middleware-set header). */}
          <ConditionalShell>{children}</ConditionalShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
