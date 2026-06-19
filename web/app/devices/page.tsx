'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, ChevronDown, ChevronRight, Cpu, Layers } from 'lucide-react'

interface Site    { id: string; name: string; clients: { name: string } | null }
interface System  { id: string; name: string; type: string; brand: string | null; model: string | null; location_desc: string | null }
interface Device  { id: string; name: string; tag_id: string | null; device_type: string; model: string | null; serial_no: string | null; location_desc: string | null; floor: number | null }

const SYSTEM_TYPES = ['cctv','access_control','structured_cabling','av','pa','bms']
const DEVICE_TYPES = ['camera','nvr','dvr','door_reader','door_controller','door_lock','network_switch','patch_panel','cable_port','access_point','server','other']

const SYSTEM_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS',
}
const SYSTEM_COLORS: Record<string, string> = {
  cctv: 'var(--color-info)', access_control: 'var(--color-success)',
  structured_cabling: 'var(--color-warning)', av: '#a78bfa', pa: '#f472b6', bms: '#34d399',
}

const emptySystem = { site_id: '', type: 'cctv', name: '', brand: '', model: '', location_desc: '', install_date: '', warranty_expiry: '', notes: '' }
const emptyDevice = { system_id: '', device_type: 'camera', name: '', brand: '', model: '', serial_no: '', ip_address: '', mac_address: '', location_desc: '', floor: '', install_date: '', warranty_start: '', warranty_expiry: '', tag_id: '' }

export default function DevicesPage() {
  const [sites, setSites]       = useState<Site[]>([])
  const [systems, setSystems]   = useState<System[]>([])
  const [devices, setDevices]   = useState<Record<string, Device[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [siteId, setSiteId]     = useState('')
  const [loading, setLoading]   = useState(false)

  const [showSysModal, setShowSysModal]     = useState(false)
  const [showDevModal, setShowDevModal]     = useState(false)
  const [activeSystemId, setActiveSystemId] = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [sysForm, setSysForm] = useState(emptySystem)
  const [devForm, setDevForm] = useState(emptyDevice)

  const setS = (k: string, v: string) => setSysForm(f => ({ ...f, [k]: v }))
  const setD = (k: string, v: string) => setDevForm(f => ({ ...f, [k]: v }))

  // Load sites on mount
  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(data => setSites(Array.isArray(data) ? data : []))
  }, [])

  // Load systems when site changes
  useEffect(() => {
    if (!siteId) { setSystems([]); setDevices({}); return }
    setLoading(true)
    fetch(`/api/systems?site_id=${siteId}`)
      .then(r => r.json())
      .then(data => {
        setSystems(Array.isArray(data) ? data : [])
        setLoading(false)
        // Auto-expand all systems
        const exp: Record<string, boolean> = {}
        ;(data ?? []).forEach((s: System) => { exp[s.id] = true })
        setExpanded(exp)
      })
  }, [siteId])

  async function loadDevicesForSystem(systemId: string) {
    const res = await fetch(`/api/devices?site_id=${siteId}`)
    const all = await res.json()
    // group by system
    const grouped: Record<string, Device[]> = {}
    ;(all ?? []).forEach((d: Device & { system_id: string }) => {
      if (!grouped[d.system_id]) grouped[d.system_id] = []
      grouped[d.system_id].push(d)
    })
    setDevices(grouped)
  }

  async function loadAllDevices() {
    if (!siteId) return
    const res = await fetch(`/api/devices?site_id=${siteId}`)
    const all = await res.json()
    const grouped: Record<string, Device[]> = {}
    ;(Array.isArray(all) ? all : []).forEach((d: Device & { system_id: string }) => {
      if (!grouped[d.system_id]) grouped[d.system_id] = []
      grouped[d.system_id].push(d)
    })
    setDevices(grouped)
  }

  useEffect(() => { if (systems.length > 0) loadAllDevices() }, [systems])

  async function submitSystem(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return setError('Select a site first.')
    setSaving(true); setError('')
    const res = await fetch('/api/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sysForm, site_id: siteId, name: sysForm.name || null, brand: sysForm.brand || null, model: sysForm.model || null, location_desc: sysForm.location_desc || null, install_date: sysForm.install_date || null, warranty_expiry: sysForm.warranty_expiry || null, notes: sysForm.notes || null }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowSysModal(false); setSysForm(emptySystem)
    // Reload systems
    fetch(`/api/systems?site_id=${siteId}`).then(r => r.json()).then(data => setSystems(Array.isArray(data) ? data : []))
    setSaving(false)
  }

  async function submitDevice(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...devForm,
        system_id: activeSystemId,
        floor: devForm.floor ? parseInt(devForm.floor) : null,
        brand: devForm.brand || null, model: devForm.model || null,
        serial_no: devForm.serial_no || null, ip_address: devForm.ip_address || null,
        mac_address: devForm.mac_address || null, location_desc: devForm.location_desc || null,
        install_date: devForm.install_date || null, tag_id: devForm.tag_id || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowDevModal(false); setDevForm(emptyDevice)
    loadAllDevices()
    setSaving(false)
  }

  function toggleExpand(id: string) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  const selectedSite = sites.find(s => s.id === siteId)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Devices</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            ELV systems and devices by site
          </p>
        </div>
        {siteId && (
          <Button onClick={() => { setShowSysModal(true); setError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Add System</span>
          </Button>
        )}
      </div>

      {/* Site selector */}
      <div className="mb-6 max-w-sm">
        <Field label="Select Site">
          <Select value={siteId} onChange={e => setSiteId(e.target.value)}>
            <option value="">— Choose a site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.clients ? ` (${s.clients.name})` : ''}</option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Content */}
      {!siteId ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Layers size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Select a site to view its ELV systems and devices.</p>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : systems.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Cpu size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No ELV systems yet for <strong>{selectedSite?.name}</strong>.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>Click "Add System" to add CCTV, Access Control, etc.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {systems.map(sys => {
            const devList = devices[sys.id] ?? []
            const isOpen = expanded[sys.id] ?? true
            const color = SYSTEM_COLORS[sys.type] ?? 'var(--text-muted)'
            return (
              <div key={sys.id} className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {/* System header */}
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                  onClick={() => toggleExpand(sys.id)}>
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown size={16} style={{ color: 'var(--text-subtle)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-subtle)' }} />}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}22`, color }}>
                      {SYSTEM_LABELS[sys.type] ?? sys.type}
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--text-base)' }}>
                      {sys.name || SYSTEM_LABELS[sys.type]}
                    </span>
                    {sys.brand && <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>{sys.brand} {sys.model}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{devList.length} device{devList.length !== 1 ? 's' : ''}</span>
                    <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                      onClick={e => { e.stopPropagation(); setActiveSystemId(sys.id); setShowDevModal(true); setError('') }}>
                      <Plus size={12} /> Add Device
                    </button>
                  </div>
                </div>

                {/* Device list */}
                {isOpen && (
                  <div>
                    {devList.length === 0 ? (
                      <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
                        No devices yet. Click "Add Device" to add one.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Tag ID</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Name</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Model</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Location</th>
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Floor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devList.map(d => (
                            <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                              onMouseLeave={e => (e.currentTarget.style.background = '')}>
                              <td className="px-5 py-3">
                                <span className="font-mono text-xs px-2 py-0.5 rounded"
                                  style={{ background: 'var(--bg-base)', color: 'var(--color-info)' }}>
                                  {d.tag_id ?? '—'}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-base)' }}>{d.name}</td>
                              <td className="px-5 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{d.device_type.replace(/_/g, ' ')}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{d.model ?? '—'}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{d.location_desc ?? '—'}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-subtle)' }}>{d.floor ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add System Modal */}
      {showSysModal && (
        <Modal title="Add ELV System" onClose={() => { setShowSysModal(false); setError('') }} width="max-w-lg">
          <form onSubmit={submitSystem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="System Type" required>
                <Select value={sysForm.type} onChange={e => setS('type', e.target.value)}>
                  {SYSTEM_TYPES.map(t => <option key={t} value={t}>{SYSTEM_LABELS[t]}</option>)}
                </Select>
              </Field>
              <Field label="System Name" hint="Leave blank to use type as name">
                <Input placeholder="e.g. CCTV Block A" value={sysForm.name} onChange={e => setS('name', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand">
                <Input placeholder="e.g. Hikvision" value={sysForm.brand} onChange={e => setS('brand', e.target.value)} />
              </Field>
              <Field label="Main Model">
                <Input placeholder="e.g. DS-7616NI-K2" value={sysForm.model} onChange={e => setS('model', e.target.value)} />
              </Field>
            </div>
            <Field label="Location" hint="Where is the head-end / main controller?">
              <Input placeholder="e.g. Server Room, Level B1" value={sysForm.location_desc} onChange={e => setS('location_desc', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Install Date">
                <Input type="date" value={sysForm.install_date} onChange={e => setS('install_date', e.target.value)} />
              </Field>
              <Field label="Warranty Expiry">
                <Input type="date" value={sysForm.warranty_expiry} onChange={e => setS('warranty_expiry', e.target.value)} />
              </Field>
            </div>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowSysModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save System</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Device Modal */}
      {showDevModal && (
        <Modal title="Add Device" onClose={() => { setShowDevModal(false); setError('') }} width="max-w-xl">
          <form onSubmit={submitDevice} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Device Type" required>
                <Select value={devForm.device_type} onChange={e => setD('device_type', e.target.value)}>
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </Select>
              </Field>
              <Field label="Device Name" required>
                <Input placeholder="e.g. CAM-001 Main Lobby" value={devForm.name} onChange={e => setD('name', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand">
                <Input placeholder="e.g. Hikvision" value={devForm.brand} onChange={e => setD('brand', e.target.value)} />
              </Field>
              <Field label="Model">
                <Input placeholder="e.g. DS-2CD2143G2" value={devForm.model} onChange={e => setD('model', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Serial No">
                <Input placeholder="Serial number" value={devForm.serial_no} onChange={e => setD('serial_no', e.target.value)} />
              </Field>
              <Field label="Tag ID" hint="Auto-generated if blank">
                <Input placeholder="e.g. DEV-CAM-0089" value={devForm.tag_id} onChange={e => setD('tag_id', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IP Address">
                <Input placeholder="192.168.1.10" value={devForm.ip_address} onChange={e => setD('ip_address', e.target.value)} />
              </Field>
              <Field label="MAC Address">
                <Input placeholder="AA:BB:CC:DD:EE:FF" value={devForm.mac_address} onChange={e => setD('mac_address', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Floor">
                <Input type="number" placeholder="1" value={devForm.floor} onChange={e => setD('floor', e.target.value)} />
              </Field>
              <Field label="Install Date">
                <Input type="date" value={devForm.install_date} onChange={e => setD('install_date', e.target.value)} />
              </Field>
              <Field label="Location">
                <Input placeholder="e.g. Main entrance" value={devForm.location_desc} onChange={e => setD('location_desc', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Warranty Start">
                <Input type="date" value={devForm.warranty_start} onChange={e => setD('warranty_start', e.target.value)} />
              </Field>
              <Field label="Warranty End">
                <Input type="date" value={devForm.warranty_expiry} onChange={e => setD('warranty_expiry', e.target.value)} />
              </Field>
            </div>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowDevModal(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save Device</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
