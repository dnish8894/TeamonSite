'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import { Plus, ChevronDown, ChevronRight, Cpu, Layers, Pencil, History, Upload, FileDown, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Site    { id: string; name: string; clients: { name: string } | null }
interface System  { id: string; name: string; type: string; type_label?: string | null; brand: string | null; model: string | null; location_desc: string | null }
interface Device  { id: string; name: string; tag_id: string | null; device_type: string; brand?: string | null; model: string | null; serial_no: string | null; ip_address?: string | null; mac_address?: string | null; location_desc: string | null; floor: number | null; install_date?: string | null; warranty_start?: string | null; warranty_expiry?: string | null; vendor_warranty_start?: string | null; vendor_warranty_end?: string | null; work_at_height?: boolean; work_at_height_notes?: string | null; under_contract?: boolean; last_service_date?: string | null }

interface PartItem { name?: string; qty?: number; part_no?: string }
interface DeviceHistory {
  parts: { id: string; created_at: string; request_type: string; status: string; equipment_description: string | null; items: PartItem[] | null; tickets: { ticket_no: string; title: string } | null }[]
  tickets: { id: string; ticket_no: string; title: string; type: string; status: string; created_at: string; resolved_at: string | null }[]
  pmReports: { id: string; visit_date: string; status: string; schedule: string | null }[]
}

const SYSTEM_TYPES = ['cctv','access_control','structured_cabling','av','pa','bms','other']
const DEVICE_TYPES = ['camera','nvr','dvr','door_reader','door_controller','door_lock','network_switch','patch_panel','cable_port','access_point','server','other']

const SYSTEM_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS', other: 'Other',
}
const SYSTEM_COLORS: Record<string, string> = {
  cctv: 'var(--color-info)', access_control: 'var(--color-success)',
  structured_cabling: 'var(--color-warning)', av: '#a78bfa', pa: '#f472b6', bms: '#34d399', other: '#94a3b8',
}
// Display name for a system's type — uses the custom label when type is "other".
const sysTypeName = (s: { type: string; type_label?: string | null }) =>
  s.type === 'other' ? (s.type_label?.trim() || 'Other') : (SYSTEM_LABELS[s.type] ?? s.type)

const emptySystem = { site_id: '', type: 'cctv', name: '', brand: '', model: '', location_desc: '', install_date: '', warranty_expiry: '', notes: '', type_label: '' }
const emptyDevice = { system_id: '', device_type: 'camera', name: '', brand: '', model: '', serial_no: '', ip_address: '', mac_address: '', location_desc: '', floor: '', install_date: '', warranty_start: '', warranty_expiry: '', vendor_warranty_start: '', vendor_warranty_end: '', tag_id: '', work_at_height: false, work_at_height_notes: '', under_contract: false }

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
  const [editDevId, setEditDevId] = useState<string | null>(null)
  const [histDevice, setHistDevice] = useState<Device | null>(null)
  const [history, setHistory] = useState<DeviceHistory | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [importSys, setImportSys] = useState<System | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  const TEMPLATE_COLUMNS = [
    'Name', 'Device Type', 'Tag ID', 'Brand', 'Model', 'Serial No', 'IP Address', 'MAC Address',
    'Location', 'Floor', 'Install Date', 'Vendor Warranty Start', 'Vendor Warranty End',
    'Work At Height', 'Under Contract',
  ]

  function downloadTemplate() {
    const example = {
      'Name': '5MP Dome Camera', 'Device Type': 'camera', 'Tag ID': '(leave blank to auto-generate)',
      'Brand': 'Hikvision', 'Model': 'DS-2CD2155', 'Serial No': 'SN12345', 'IP Address': '192.168.1.50',
      'MAC Address': 'AA:BB:CC:DD:EE:FF', 'Location': 'Lobby ceiling', 'Floor': '1',
      'Install Date': '2025-01-15', 'Vendor Warranty Start': '2025-01-15', 'Vendor Warranty End': '2027-01-15',
      'Work At Height': 'No', 'Under Contract': 'Yes',
    }
    const ws = XLSX.utils.json_to_sheet([example], { header: TEMPLATE_COLUMNS })
    ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(c.length + 2, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Devices')
    XLSX.writeFile(wb, 'device-import-template.xlsx')
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !importSys) return
    e.target.value = '' // allow re-selecting the same file
    setImporting(true); setImportResult(null); setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        .filter(r => String(r['Name'] ?? '').trim() && !String(r['Tag ID'] ?? '').includes('auto-generate'))
      if (rows.length === 0) { setError('No device rows found in the file.'); setImporting(false); return }
      const res = await fetch('/api/devices/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_id: importSys.id, devices: rows }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Import failed.'); setImporting(false); return }
      setImportResult({ imported: json.imported, skipped: json.skipped, errors: json.errors ?? [] })
      loadAllDevices()
    } catch {
      setError('Could not read the file. Make sure it is a valid .xlsx file.')
    }
    setImporting(false)
  }

  async function deleteDevice(d: Device) {
    if (!confirm(`Delete device "${d.name}"? This cannot be undone from the UI.`)) return
    const res = await fetch(`/api/devices/${d.id}`, { method: 'DELETE' })
    if (res.ok) loadAllDevices()
  }
  async function deleteSystem(sys: System) {
    const count = (devices[sys.id] ?? []).length
    const msg = count > 0
      ? `Delete system "${sys.name || sysTypeName(sys)}" and its ${count} device${count !== 1 ? 's' : ''}?`
      : `Delete system "${sys.name || sysTypeName(sys)}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/systems/${sys.id}`, { method: 'DELETE' })
    if (res.ok && siteId) {
      fetch(`/api/systems?site_id=${siteId}`).then(r => r.json()).then(data => setSystems(Array.isArray(data) ? data : []))
    }
  }

  async function openHistory(d: Device) {
    setHistDevice(d); setHistory(null); setHistLoading(true)
    const res = await fetch(`/api/devices/${d.id}/history`)
    setHistory(res.ok ? await res.json() : { parts: [], tickets: [], pmReports: [] })
    setHistLoading(false)
  }

  const setS = (k: string, v: string) => setSysForm(f => ({ ...f, [k]: v }))
  const setD = (k: string, v: string) => setDevForm(f => ({ ...f, [k]: v }))

  function openEditDevice(d: Device) {
    setEditDevId(d.id)
    setDevForm({
      system_id: '', device_type: d.device_type, name: d.name, brand: d.brand ?? '',
      model: d.model ?? '', serial_no: d.serial_no ?? '', ip_address: d.ip_address ?? '',
      mac_address: d.mac_address ?? '', location_desc: d.location_desc ?? '',
      floor: d.floor != null ? String(d.floor) : '', install_date: d.install_date ?? '',
      warranty_start: d.warranty_start ?? '', warranty_expiry: d.warranty_expiry ?? '',
      vendor_warranty_start: d.vendor_warranty_start ?? '', vendor_warranty_end: d.vendor_warranty_end ?? '',
      tag_id: d.tag_id ?? '', work_at_height: d.work_at_height ?? false,
      work_at_height_notes: d.work_at_height_notes ?? '', under_contract: d.under_contract ?? false,
    })
    setError(''); setShowDevModal(true)
  }

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
    if (sysForm.type === 'other' && !sysForm.type_label.trim()) return setError('Please name the custom system type.')
    setSaving(true); setError('')
    const res = await fetch('/api/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sysForm, site_id: siteId, name: sysForm.name || null, brand: sysForm.brand || null, model: sysForm.model || null, location_desc: sysForm.location_desc || null, install_date: sysForm.install_date || null, warranty_expiry: sysForm.warranty_expiry || null, notes: sysForm.notes || null, type_label: sysForm.type === 'other' ? (sysForm.type_label?.trim() || null) : null }),
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
    const payload = {
      ...devForm,
      floor: devForm.floor ? parseInt(devForm.floor as unknown as string) : null,
      brand: devForm.brand || null, model: devForm.model || null,
      serial_no: devForm.serial_no || null, ip_address: devForm.ip_address || null,
      mac_address: devForm.mac_address || null, location_desc: devForm.location_desc || null,
      install_date: devForm.install_date || null, tag_id: devForm.tag_id || null,
      warranty_start: devForm.warranty_start || null, warranty_expiry: devForm.warranty_expiry || null,
      vendor_warranty_start: devForm.vendor_warranty_start || null, vendor_warranty_end: devForm.vendor_warranty_end || null,
      work_at_height: devForm.work_at_height,
      work_at_height_notes: devForm.work_at_height ? (devForm.work_at_height_notes || null) : null,
      under_contract: devForm.under_contract,
    }
    const res = editDevId
      ? await fetch(`/api/devices/${editDevId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      : await fetch('/api/devices', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, system_id: activeSystemId }),
        })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowDevModal(false); setDevForm(emptyDevice); setEditDevId(null)
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
                      {sysTypeName(sys)}
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--text-base)' }}>
                      {sys.name || sysTypeName(sys)}
                    </span>
                    {sys.brand && <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>{sys.brand} {sys.model}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{devList.length} device{devList.length !== 1 ? 's' : ''}</span>
                    <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}
                      onClick={e => { e.stopPropagation(); setImportSys(sys); setImportResult(null); setError('') }}>
                      <Upload size={12} /> Import Excel
                    </button>
                    <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                      onClick={e => { e.stopPropagation(); setActiveSystemId(sys.id); setEditDevId(null); setDevForm(emptyDevice); setShowDevModal(true); setError('') }}>
                      <Plus size={12} /> Add Device
                    </button>
                    <button className="p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }} title="Delete system"
                      onClick={e => { e.stopPropagation(); deleteSystem(sys) }}>
                      <Trash2 size={14} />
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
                            <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide">Last Service</th>
                            <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
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
                              <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-base)' }}>
                                {d.name}
                                {d.work_at_height && (
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
                                    title={d.work_at_height_notes ?? 'Work-at-height equipment required'}>
                                    ⚠️ Height
                                  </span>
                                )}
                                {d.under_contract && (
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                                    title="Covered under contract">
                                    📄 Contract
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{d.device_type.replace(/_/g, ' ')}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{d.model ?? '—'}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{d.location_desc ?? '—'}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--text-subtle)' }}>{d.floor ?? '—'}</td>
                              <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                                {d.last_service_date ? new Date(d.last_service_date + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <button onClick={() => openHistory(d)}
                                  className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} title="Service history">
                                  <History size={14} />
                                </button>
                                <button onClick={() => openEditDevice(d)}
                                  className="p-1.5 rounded-lg ml-1" style={{ color: 'var(--color-info)' }} title="Edit device">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => deleteDevice(d)}
                                  className="p-1.5 rounded-lg ml-1" style={{ color: 'var(--color-danger)' }} title="Delete device">
                                  <Trash2 size={14} />
                                </button>
                              </td>
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
              {sysForm.type === 'other' ? (
                <Field label="Custom System Type" required hint="e.g. Fire Alarm, Intercom, BAS">
                  <Input placeholder="Type the system name" value={sysForm.type_label} onChange={e => setS('type_label', e.target.value)} />
                </Field>
              ) : (
                <Field label="System Name" hint="Leave blank to use type as name">
                  <Input placeholder="e.g. CCTV Block A" value={sysForm.name} onChange={e => setS('name', e.target.value)} />
                </Field>
              )}
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
        <Modal title={editDevId ? 'Edit Device' : 'Add Device'} onClose={() => { setShowDevModal(false); setEditDevId(null); setError('') }} width="max-w-xl">
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
              <Field label="Client Warranty Start">
                <Input type="date" value={devForm.warranty_start} onChange={e => setD('warranty_start', e.target.value)} />
              </Field>
              <Field label="Client Warranty End">
                <Input type="date" value={devForm.warranty_expiry} onChange={e => setD('warranty_expiry', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vendor Warranty Start">
                <Input type="date" value={devForm.vendor_warranty_start} onChange={e => setD('vendor_warranty_start', e.target.value)} />
              </Field>
              <Field label="Vendor Warranty End">
                <Input type="date" value={devForm.vendor_warranty_end} onChange={e => setD('vendor_warranty_end', e.target.value)} />
              </Field>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={devForm.under_contract}
                  onChange={e => setDevForm(f => ({ ...f, under_contract: e.target.checked }))} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>📄 Covered under contract</span>
              </label>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={devForm.work_at_height}
                  onChange={e => setDevForm(f => ({ ...f, work_at_height: e.target.checked }))} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>⚠️ Requires work-at-height equipment (ladder / scaffold)</span>
              </label>
              {devForm.work_at_height && (
                <div className="mt-3">
                  <Input placeholder="Notes — e.g. 4m ceiling, scissor lift needed"
                    value={devForm.work_at_height_notes} onChange={e => setD('work_at_height_notes', e.target.value)} />
                </div>
              )}
            </div>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setShowDevModal(false); setEditDevId(null) }}>Cancel</Button>
              <Button type="submit" loading={saving}>{editDevId ? 'Save Changes' : 'Save Device'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Import Devices Modal */}
      {importSys && (
        <Modal title={`Import Devices — ${importSys.name || sysTypeName(importSys)}`}
          onClose={() => { setImportSys(null); setImportResult(null); setError('') }} width="max-w-lg">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Upload an Excel file to add multiple devices to this system at once. Download the template,
              fill in one device per row, then upload it. Leave <strong>Tag ID</strong> blank to auto-generate.
            </p>

            <button onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--color-info)' }}>
              <FileDown size={15} /> Download Excel Template
            </button>

            <label className="flex items-center justify-center gap-2 text-sm px-3 py-3 rounded-lg border-2 border-dashed cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Upload size={16} />
              {importing ? 'Importing…' : 'Choose .xlsx file to upload'}
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={handleImportFile} />
            </label>

            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}

            {importResult && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                ✓ Imported {importResult.imported} device{importResult.imported !== 1 ? 's' : ''}.
                {importResult.skipped > 0 && (
                  <div className="mt-1" style={{ color: 'var(--color-warning)' }}>
                    Skipped {importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''}:
                    <ul className="mt-1 text-xs">
                      {importResult.errors.slice(0, 8).map((er, i) => <li key={i}>• {er}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={() => { setImportSys(null); setImportResult(null); setError('') }}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Service History Modal */}
      {histDevice && (
        <Modal title={`Service History — ${histDevice.name}`}
          onClose={() => { setHistDevice(null); setHistory(null) }} width="max-w-2xl">
          {histLoading ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--text-subtle)' }}>Loading…</p>
          ) : (
            <div className="space-y-6">
              {/* Part replacements */}
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>
                  Part Requests / Replacements ({history?.parts.length ?? 0})
                </h3>
                {(history?.parts.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No part requests for this device.</p>
                ) : (
                  <div className="space-y-2">
                    {history!.parts.map(p => (
                      <div key={p.id} className="rounded-lg border px-3 py-2"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                            {p.tickets?.ticket_no ? `${p.tickets.ticket_no} · ` : ''}{p.equipment_description || 'Part request'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                            {p.request_type} · {p.status}
                          </span>
                        </div>
                        {Array.isArray(p.items) && p.items.length > 0 && (
                          <ul className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {p.items.map((it, idx) => (
                              <li key={idx}>• {it.name ?? it.part_no ?? 'Item'}{it.qty ? ` × ${it.qty}` : ''}</li>
                            ))}
                          </ul>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{fmtDateTime(p.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tickets */}
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>
                  Tickets ({history?.tickets.length ?? 0})
                </h3>
                {(history?.tickets.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No tickets for this device.</p>
                ) : (
                  <div className="space-y-1.5">
                    {history!.tickets.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                        <span className="text-sm" style={{ color: 'var(--text-base)' }}>
                          <span className="font-mono text-xs" style={{ color: 'var(--color-info)' }}>{t.ticket_no}</span> · {t.title}
                        </span>
                        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-subtle)' }}>
                          {t.status} · {fmtDate(t.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PM reports */}
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-base)' }}>
                  PM Reports ({history?.pmReports.length ?? 0})
                </h3>
                {(history?.pmReports.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No PM reports covering this device.</p>
                ) : (
                  <div className="space-y-1.5">
                    {history!.pmReports.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                        <span className="text-sm" style={{ color: 'var(--text-base)' }}>{r.schedule ?? 'PM Report'}</span>
                        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-subtle)' }}>
                          {r.status} · {fmtDate(r.visit_date)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
