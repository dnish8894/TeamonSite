'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, ChevronRight, Building2, Layers, CalendarRange, Edit2, Check, X } from 'lucide-react'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import SiteContactsCard from '@/components/sites/SiteContactsCard'

interface Device  { id: string; name: string; tag_id: string | null; device_type: string; model: string | null; is_active: boolean }
interface System  { id: string; type: string; name: string; brand: string | null; model: string | null; location_desc: string | null; install_date: string | null; is_active: boolean; devices: Device[] }
interface TicketRow { id: string; ticket_no: string; title: string; status: string; priority: string; created_at: string }
interface Site {
  id: string; name: string; address: string | null; city: string | null; state: string | null
  postcode: string | null; floors: number | null; site_contact: string | null; site_phone: string | null
  access_notes: string | null; is_active: boolean; created_at: string
  contract_type: 'dlp' | 'maintenance' | null
  contract_start: string | null
  contract_end: string | null
  pm_classification: 'comprehensive' | 'non_comprehensive' | null
  clients: { id: string; name: string; type: string } | null
  elv_systems: System[]
  tickets: TicketRow[]
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open:        { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  assigned:    { color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)'   },
  in_progress: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  resolved:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  closed:      { color: 'var(--text-subtle)',   bg: 'var(--border)'           },
}
const SYS_COLORS: Record<string, string> = {
  cctv: 'var(--color-info)', access_control: 'var(--color-success)',
  structured_cabling: 'var(--color-warning)', av: '#a78bfa', pa: '#f472b6', bms: '#34d399',
}

const CONTRACT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  dlp:         { label: 'DLP',         color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  maintenance: { label: 'Maintenance', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [site, setSite]             = useState<Site | null>(null)
  const [loading, setLoading]       = useState(true)
  const [expandedSys, setExpandedSys] = useState<string | null>(null)

  // Contract inline edit state
  const [editingContract, setEditingContract] = useState(false)
  const [contractForm, setContractForm]       = useState({ contract_type: '', contract_start: '', contract_end: '', pm_classification: '' })
  const [savingContract, setSavingContract]   = useState(false)

  useEffect(() => {
    fetch(`/api/sites/${id}`).then(r => r.json()).then(d => {
      setSite(d)
      if (d?.elv_systems?.[0]) setExpandedSys(d.elv_systems[0].id)
      setLoading(false)
    })
  }, [id])

  function openContractEdit() {
    if (!site) return
    setContractForm({
      contract_type:  site.contract_type  ?? '',
      contract_start: site.contract_start ?? '',
      contract_end:   site.contract_end   ?? '',
      pm_classification: site.pm_classification ?? '',
    })
    setEditingContract(true)
  }

  async function saveContract() {
    setSavingContract(true)
    await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractForm),
    })
    setSavingContract(false)
    setEditingContract(false)
    // Reload site
    fetch(`/api/sites/${id}`).then(r => r.json()).then(d => setSite(d))
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading...</div>
  if (!site)   return <div className="p-8" style={{ color: 'var(--color-danger)' }}>Site not found.</div>

  const openTickets = site.tickets.filter(t => !['closed','cancelled'].includes(t.status))
  const totalDevices = site.elv_systems.reduce((sum, s) => sum + s.devices.length, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/sites')}
        className="flex items-center gap-2 text-sm mb-5"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-base)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={16} /> Back to Sites
      </button>

      {/* Header */}
      <div className="rounded-xl border p-6 mb-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {/* Breadcrumb: Client → Site */}
            {site.clients && (
              <button onClick={() => router.push(`/clients/${site.clients!.id}`)}
                className="flex items-center gap-1 text-xs mb-2 hover:underline"
                style={{ color: 'var(--color-info)' }}>
                <Building2 size={11} /> {site.clients.name} <ChevronRight size={10} />
              </button>
            )}
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={16} style={{ color: 'var(--color-info)' }} />
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>{site.name}</h1>
              {!site.is_active && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>Inactive</span>
              )}
            </div>
            {site.address && <p className="text-sm ml-6" style={{ color: 'var(--text-muted)' }}>{[site.address, site.city, site.state, site.postcode].filter(Boolean).join(', ')}</p>}
            {site.site_contact && <p className="text-sm ml-6 mt-0.5" style={{ color: 'var(--text-subtle)' }}>Contact: {site.site_contact} {site.site_phone}</p>}
            {site.access_notes && <p className="text-xs ml-6 mt-1 italic" style={{ color: 'var(--text-subtle)' }}>Access: {site.access_notes}</p>}

            {/* ── Contract / DLP period ─────────────────────────────── */}
            <div className="ml-6 mt-3">
              {!editingContract ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {site.contract_type ? (
                    <>
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: CONTRACT_LABELS[site.contract_type].bg, color: CONTRACT_LABELS[site.contract_type].color }}>
                        <CalendarRange size={11} />
                        {CONTRACT_LABELS[site.contract_type].label}
                      </span>
                      {(site.contract_start || site.contract_end) && (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {site.contract_start
                            ? new Date(site.contract_start + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '?'}
                          {' → '}
                          {site.contract_end
                            ? new Date(site.contract_end + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '?'}
                        </span>
                      )}
                      {site.pm_classification && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={site.pm_classification === 'comprehensive'
                            ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' }
                            : { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                          {site.pm_classification === 'comprehensive' ? 'Comprehensive' : 'Non-Comprehensive'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>No DLP / maintenance period set</span>
                  )}
                  <button onClick={openContractEdit}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                    title="Edit contract period">
                    <Edit2 size={13} />
                  </button>
                </div>
              ) : (
                /* ── Inline edit form ── */
                <div className="rounded-xl border p-4 space-y-3 max-w-md"
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
                    Contract / Service Period
                  </p>
                  <Field label="Type">
                    <Select value={contractForm.contract_type}
                      onChange={e => setContractForm(f => ({ ...f, contract_type: e.target.value }))}>
                      <option value="">— None —</option>
                      <option value="dlp">DLP (Defects Liability Period)</option>
                      <option value="maintenance">Maintenance</option>
                    </Select>
                  </Field>
                  {contractForm.contract_type && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start Date">
                        <Input type="date" value={contractForm.contract_start}
                          onChange={e => setContractForm(f => ({ ...f, contract_start: e.target.value }))} />
                      </Field>
                      <Field label="End Date">
                        <Input type="date" value={contractForm.contract_end}
                          onChange={e => setContractForm(f => ({ ...f, contract_end: e.target.value }))} />
                      </Field>
                    </div>
                  )}
                  {contractForm.contract_type === 'maintenance' && (
                    <Field label="Classification" hint="Comprehensive = parts covered · Non-Comprehensive = parts chargeable">
                      <Select value={contractForm.pm_classification}
                        onChange={e => setContractForm(f => ({ ...f, pm_classification: e.target.value }))}>
                        <option value="">— Not set —</option>
                        <option value="comprehensive">Comprehensive (parts covered)</option>
                        <option value="non_comprehensive">Non-Comprehensive (parts chargeable)</option>
                      </Select>
                    </Field>
                  )}
                  <div className="flex gap-2">
                    <Button loading={savingContract} onClick={saveContract}>
                      <span className="flex items-center gap-1.5"><Check size={13} /> Save</span>
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingContract(false)}>
                      <span className="flex items-center gap-1.5"><X size={13} /> Cancel</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Systems',  value: site.elv_systems.length, color: 'var(--color-info)'    },
              { label: 'Devices',  value: totalDevices,            color: 'var(--color-success)'  },
              { label: 'Open Jobs',value: openTickets.length,      color: openTickets.length > 0 ? 'var(--color-warning)' : 'var(--text-subtle)' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-base)' }}>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ELV Systems + Devices */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>ELV Systems & Devices</h2>
            <button onClick={() => router.push('/devices')}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              Manage Devices
            </button>
          </div>

          {site.elv_systems.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <Layers size={24} style={{ color: 'var(--text-subtle)', margin: '0 auto 8px' }} />
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No ELV systems installed yet.</p>
            </div>
          ) : site.elv_systems.map(sys => {
            const color = SYS_COLORS[sys.type] ?? 'var(--text-muted)'
            const isOpen = expandedSys === sys.id
            return (
              <div key={sys.id} className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                  onClick={() => setExpandedSys(isOpen ? null : sys.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}22`, color }}>
                      {sys.type.replace(/_/g,' ').toUpperCase()}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--text-base)' }}>{sys.name || sys.type}</span>
                    {sys.brand && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{sys.brand} {sys.model}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{sys.devices.length} device{sys.devices.length !== 1 ? 's' : ''}</span>
                    <ChevronRight size={14} style={{ color: 'var(--text-subtle)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  </div>
                </div>
                {isOpen && (
                  <div>
                    {sys.devices.length === 0 ? (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-subtle)' }}>No devices in this system.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Tag ID','Name','Type','Model'].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                                style={{ color: 'var(--text-subtle)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sys.devices.map(d => (
                            <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-4 py-2">
                                <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: 'var(--bg-base)', color }}>
                                  {d.tag_id ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-base)' }}>{d.name}</td>
                              <td className="px-4 py-2 capitalize" style={{ color: 'var(--text-muted)' }}>{d.device_type.replace(/_/g,' ')}</td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-subtle)' }}>{d.model ?? '—'}</td>
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

        {/* Contacts + Tickets */}
        <div>
          <SiteContactsCard siteId={id} />
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Tickets</h2>
            <button onClick={() => router.push('/tickets')} className="text-xs" style={{ color: 'var(--color-info)' }}>
              View all
            </button>
          </div>
          {site.tickets.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No tickets for this site.</p>
          ) : (
            <div className="space-y-2">
              {site.tickets.slice(0, 10).map(t => {
                const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.open
                return (
                  <div key={t.id}
                    className="rounded-lg border p-3 cursor-pointer transition-all"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = ss.color)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-base)' }}>{t.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: ss.bg, color: ss.color }}>
                        {t.status.replace(/_/g,' ')}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                      {t.ticket_no} · {new Date(t.created_at).toLocaleDateString('en-MY', { day:'numeric', month:'short' })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
