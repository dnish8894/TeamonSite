'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isPathAllowed, defaultPathFor } from '@/lib/permissions'

export default function RoleGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | undefined>()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => setRole(d?.role))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (role && !isPathAllowed(role, pathname)) {
      router.replace(defaultPathFor(role))
    }
  }, [role, pathname, router])

  return null
}
