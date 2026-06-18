'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { QrCode, Printer, Download } from 'lucide-react'

interface Site { id: string; name: string; clients: { name: string } | null }
interface QRItem {
  tier: 'site' | 'system' | 'device'
  id: string
  label: string
  sublabel: string
  url: string
  dataUrl: string
}

const TIER_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  site:   { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'SITE' },
  system: { color: '#16a34a', bg: '#f0fdf4', label: 'SYSTEM' },
  device: { color: '#7c3aed', bg: '#f5f3ff', label: 'DEVICE' },
}

export default function QRPage() {
  const [sites, setSites]     = useState<Site[]>([])
  const [siteId, setSiteId]   = useState('')
  const [items, setItems]     = useState<QRItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState<'all' | 'site' | 'system' | 'device'>('all')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []))
  }, [])

  async function generate() {
    if (!siteId) return
    setLoading(true)
    const res = await fetch(`/api/qr?site_id=${siteId}`)
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function handlePrint() {
    const printContents = printRef.current?.innerHTML
    if (!printContents) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>QR Sticker Sheet</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px; }
            .card { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px; text-align: center; page-break-inside: avoid; }
            .tier-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 999px; display: inline-block; margin-bottom: 6px; }
            .qr-img { width: 120px; height: 120px; margin: 6px auto; display: block; }
            .label { font-size: 11px; font-weight: 600; color: #111; margin-top: 4px; word-break: break-word; }
            .sublabel { font-size: 9px; color: #6b7280; margin-top: 2px; }
            .url { font-size: 7px; color: #9ca3af; margin-top: 4px; word-break: break-all; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.tier === filter)
  const selectedSite = sites.find(s => s.id === siteId)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>QR Codes</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Generate and print QR stickers for sites, systems, and devices
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Printer size={16} /> Print All ({filtered.length})
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-end gap-4 mb-6">
        <div className="w-72">
          <Field label="Select Site">
            <Select value={siteId} onChange={e => { setSiteId(e.target.value); setItems([]) }}>
              <option value="">— Choose a site —</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.clients ? ` (${s.clients.name})` : ''}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Button onClick={generate} loading={loading} disabled={!siteId}>
          <span className="flex items-center gap-2"><QrCode size={16} /> Generate QR Codes</span>
        </Button>
      </div>

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-6">
          {(['all', 'site', 'system', 'device'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border capitalize"
              style={filter === f
                ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {f === 'all' ? `All (${items.length})` : `${f} (${items.filter(i => i.tier === f).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!items.length && !loading && (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <QrCode size={40} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Select a site and click Generate.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            QR codes will be created for the site, all its systems, and all devices.
          </p>
        </div>
      )}

      {/* QR Grid — screen view */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(item => {
            const t = TIER_COLORS[item.tier]
            return (
              <div key={item.id} className="rounded-xl border p-4 text-center flex flex-col items-center gap-2"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full tracking-widest"
                  style={{ background: t.bg, color: t.color }}>
                  {t.label}
                </span>
                <img src={item.dataUrl} alt={item.label} className="w-28 h-28" />
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-base)' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sublabel}</p>
                </div>
                <a href={item.dataUrl} download={`qr-${item.tier}-${item.label}.png`}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg mt-1"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                  <Download size={11} /> Save
                </a>
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden print layout — 4-column grid optimised for A4 */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <div className="grid">
            {filtered.map(item => {
              const t = TIER_COLORS[item.tier]
              return (
                <div key={item.id} className="card">
                  <span className="tier-badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                  <img src={item.dataUrl} className="qr-img" alt={item.label} />
                  <p className="label">{item.label}</p>
                  <p className="sublabel">{item.sublabel}</p>
                  <p className="url">{item.url}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
