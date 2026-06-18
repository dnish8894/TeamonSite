'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Ticket, Building2, Users, HardHat,
  Wrench, QrCode, CalendarClock, Package, FolderKanban,
  Settings, LogOut, CalendarRange, FileBarChart2,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { usePush } from '@/lib/usePush'
import { Bell, BellOff } from 'lucide-react'

const navItems = [
  { href: '/',          icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/tickets',   icon: Ticket,          label: 'Tickets'      },
  { href: '/projects',  icon: FolderKanban,    label: 'Projects'     },
  { href: '/clients',   icon: Users,           label: 'Clients'      },
  { href: '/sites',     icon: Building2,       label: 'Sites'        },
  { href: '/devices',   icon: Wrench,          label: 'Devices'      },
  { href: '/engineers', icon: HardHat,         label: 'Engineers'    },
  { href: '/qr',        icon: QrCode,          label: 'QR Codes'     },
  { href: '/pm',        icon: CalendarClock,   label: 'PM Schedules' },
  { href: '/parts',     icon: Package,         label: 'Inventory'    },
  { href: '/standby',   icon: CalendarRange,   label: 'Standby'      },
  { href: '/reports',   icon: FileBarChart2,   label: 'Reports'      },
  { href: '/settings',  icon: Settings,        label: 'Settings'     },
]

const ROLE_COLORS: Record<string, string> = {
  admin:    '#f87171',
  manager:  'var(--color-info)',
  engineer: 'var(--color-success)',
  client:   'var(--color-warning)',
}

interface UserProfile { full_name: string; email: string; role: string }

export default function Sidebar() {
  const pathname    = usePathname()
  const router      = useRouter()
  const [user, setUser]             = useState<UserProfile | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const { supported, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePush()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => setUser(d))
      .catch(() => {})
  }, [pathname])

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <aside
      className="w-60 min-h-screen flex flex-col border-r"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)', color: 'var(--text-base)' }}
    >
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-base)' }}>TeamOn</span>
        <span className="text-lg font-bold tracking-tight" style={{ color: '#f97316' }}>Site</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={active ? { background: '#f97316', color: '#ffffff' } : { color: 'var(--text-muted)' }}
              onMouseEnter={e => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-base)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.background = ''
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                }
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <ThemeToggle />

        {/* Push notification toggle */}
        {supported && (
          <button
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={pushLoading}
            title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={subscribed
              ? { background: 'rgba(249,115,22,0.12)', color: '#f97316' }
              : { background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
            {subscribed ? <Bell size={14} /> : <BellOff size={14} />}
            {pushLoading ? 'Updating…' : subscribed ? 'Notifications On' : 'Enable Notifications'}
          </button>
        )}

        {/* User card */}
        {user && (
          <div className="mt-3 px-2 py-2.5 rounded-xl flex items-center gap-2.5 group"
            style={{ background: 'var(--bg-base)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: '#f97316', color: '#fff' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-base)' }}>
                {user.full_name}
              </p>
              <p className="text-xs capitalize" style={{ color: ROLE_COLORS[user.role] ?? 'var(--text-subtle)' }}>
                {user.role}
              </p>
            </div>
            <button onClick={handleLogout} disabled={loggingOut} title="Sign out"
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-danger)' }}>
              <LogOut size={14} />
            </button>
          </div>
        )}

        <p className="px-2 pt-2 text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>v0.1.0</p>
      </div>
    </aside>
  )
}
