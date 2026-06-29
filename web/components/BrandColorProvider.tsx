'use client'

import { useEffect } from 'react'

export default function BrandColorProvider() {
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(org => {
        if (org?.brand_color) {
          document.documentElement.style.setProperty('--brand-accent', org.brand_color)
        }
      })
      .catch(() => {})
  }, [])

  return null
}
