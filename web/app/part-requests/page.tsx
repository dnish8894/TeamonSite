'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, CheckCircle2, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Select, Textarea } from '@/components/ui/Field'
import Button from '@/components/ui/Button'

interface PartRequestItem { description: string; model: string | null; remark: string | null }

interface PartRequest {
  id: string
  equipment_description: string
  items: PartRequestItem[] | null
  request_type: string
  status: string
  created_at: string
  ready_note: string | null
  ready_at: string | null
  acknowledged_at: string | null
  tickets: { id: string; ticket_no: string; title: string; sites: { name: string; clients: { name: string } | null } | null } | null
  projects: { id: string; project_no: string; name: string; clients: { name: string } | null } | null
  engineers: { id: string; users: { full_name: string } | null } | null
  acknowledged_by_user: { full_name: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  warranty: 'Under Warranty',
  preventive_maintenance: 'Preventive Maintenance',
  quotation: 'Need Quotation',
  project: 'Project',
}
const TYPE_COLOR: Record<string, string> = {
  warranty: 'var(--color-success)',
  preventive_maintenance: 'var(--color-info)',
  quotation: 'var(--color-warning)',
  project: 'var(--brand-accent, #f97316)',
}
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  reviewed: { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  ready:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  closed:   { color: 'var(--text-subtle)',   bg: 'var(--border)'          },
}

export default function PartRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PartRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [readyDraft, setReadyDraft] = useState<Record<string, string>>({})
  const [pendingReady, setPendingReady] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'outstanding' | 'pending' | 'reviewed' | 'ready' | 'closed' | 'all'>('outstanding')

  async function load() {
    const res = await fetch('/api/part-requests')
    const data = await res.json()
    setRequests(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string, ready_note?: string) {
    setSaving(s => ({ ...s, [id]: true }))
    await fetch(`/api/part-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ready_note }),
    })
    setPendingReady(s => ({ ...s, [id]: false }))
    setSaving(s => ({ ...s, [id]: false }))
    load()
  }

  async function acknowledge(id: string) {
    setSaving(s => ({ ...s, [id]: true }))
    await fetch(`/api/part-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge' }),
    })
    setSaving(s => ({ ...s, [id]: false }))
    load()
  }

  function handleStatusChange(id: string, status: string) {
    if (status === 'ready') {
      setPendingReady(s => ({ ...s, [id]: true }))
      return
    }
    updateStatus(id, status)
  }

  const pending = requests.filter(r => r.status === 'pending').length
  const TYPE_LABEL_FN = (t: string) => TYPE_LABEL[t] ?? t

  const filtered = requests.filter(r =>
    filter === 'all' ? true
    : filter === 'outstanding' ? r.status !== 'closed' && !r.acknowledged_at
    : r.status === filter
  )

  function exportExcel() {
    const rows = [
      ['Source', 'Reference', 'Title', 'Site / Client', 'Equipment', 'Type', 'Engineer', 'Status', 'Ready Note', 'Collected By', 'Date'],
      ...filtered.map(r => [
        r.tickets ? 'Ticket' : 'Project',
        r.tickets?.ticket_no ?? r.projects?.project_no ?? '—',
        r.tickets?.title ?? r.projects?.name ?? '—',
        r.tickets?.sites?.name ?? r.projects?.clients?.name ?? '—',
        r.items && r.items.length > 0
          ? r.items.map(it => `${it.description}${it.model ? ` (${it.model})` : ''}${it.remark ? ` — ${it.remark}` : ''}`).join('; ')
          : r.equipment_description,
        TYPE_LABEL_FN(r.request_type),
        r.engineers?.users?.full_name ?? '—',
        r.acknowledged_at ? 'Collected' : r.status,
        r.ready_note ?? '',
        r.acknowledged_by_user?.full_name ?? '',
        new Date(r.created_at).toLocaleDateString('en-MY'),
      ]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 24 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Part Requests')
    XLSX.writeFile(wb, `Pending_Part_Replacement_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Pending Part Replacement</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {pending} pending · {requests.length} total — raised when a ticket is closed/paused due to a faulty part
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ minWidth: 160 }}>
            <option value="outstanding">Outstanding</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="ready">Ready for Collection</option>
            <option value="closed">Closed / Collected</option>
            <option value="all">All</option>
          </Select>
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <FileDown size={15} /> Export to Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Package size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>{requests.length === 0 ? 'No part requests yet.' : 'No requests match this filter.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Source', 'Site / Client', 'Equipment', 'Type', 'Engineer', 'Status', 'Ready / Collection', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => router.push(`/part-requests/${r.id}`)}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--color-info)' }}>
                        {r.tickets?.ticket_no ?? r.projects?.project_no ?? '—'}
                      </span>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{r.tickets?.title ?? r.projects?.name}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {r.tickets?.sites?.name ?? r.projects?.clients?.name ?? '—'}
                      {r.tickets?.sites?.clients && <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{r.tickets.sites.clients.name}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-xs" style={{ color: 'var(--text-base)' }}>
                      {r.items && r.items.length > 0 ? (
                        <ul className="space-y-1">
                          {r.items.map((it, i) => (
                            <li key={i} className="text-xs">
                              <span style={{ color: 'var(--text-base)' }}>{it.description}</span>
                              {it.model && <span style={{ color: 'var(--text-subtle)' }}> · Model: {it.model}</span>}
                              {it.remark && <span className="block italic" style={{ color: 'var(--text-subtle)' }}>{it.remark}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : r.equipment_description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: TYPE_COLOR[r.request_type], background: 'var(--bg-base)' }}>
                        {TYPE_LABEL[r.request_type] ?? r.request_type}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{r.engineers?.users?.full_name ?? '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        disabled={saving[r.id]} className="text-xs" style={{ color: st.color }}>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="ready">Ready for Collection</option>
                        <option value="closed">Closed</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]" onClick={e => e.stopPropagation()}>
                      {pendingReady[r.id] ? (
                        <div className="space-y-2">
                          <Textarea rows={2} placeholder="Pickup location / note (optional)"
                            value={readyDraft[r.id] ?? ''} onChange={e => setReadyDraft(d => ({ ...d, [r.id]: e.target.value }))} />
                          <div className="flex gap-2">
                            <Button onClick={() => updateStatus(r.id, 'ready', readyDraft[r.id] ?? '')} loading={saving[r.id]}>
                              Mark Ready
                            </Button>
                            <Button variant="secondary" onClick={() => setPendingReady(s => ({ ...s, [r.id]: false }))}>Cancel</Button>
                          </div>
                        </div>
                      ) : r.acknowledged_at ? (
                        <div className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-success)' }}>
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                          <span>
                            Collected by {r.acknowledged_by_user?.full_name ?? '—'}
                            <br />{new Date(r.acknowledged_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      ) : r.status === 'ready' ? (
                        <div className="space-y-1.5">
                          {r.ready_note && <p className="text-xs italic" style={{ color: 'var(--text-subtle)' }}>{r.ready_note}</p>}
                          <Button onClick={() => acknowledge(r.id)} loading={saving[r.id]} className="text-xs">
                            Acknowledge / Collected
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
