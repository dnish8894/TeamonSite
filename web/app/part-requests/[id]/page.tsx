'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Package } from 'lucide-react'
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
  requested_by_user: { full_name: string } | null
  acknowledged_by_user: { full_name: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  warranty: 'Under Warranty',
  preventive_maintenance: 'Preventive Maintenance',
  quotation: 'Need Quotation',
  project: 'Project',
}
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  reviewed: { color: 'var(--color-info)',    bg: 'var(--color-info-bg)'    },
  ready:    { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  closed:   { color: 'var(--text-subtle)',   bg: 'var(--border)'          },
}

export default function PartRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<PartRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingReady, setPendingReady] = useState(false)
  const [readyDraft, setReadyDraft] = useState('')

  async function load() {
    const res = await fetch(`/api/part-requests/${id}`)
    if (res.ok) setRequest(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  async function updateStatus(status: string, ready_note?: string) {
    setSaving(true)
    await fetch(`/api/part-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ready_note }),
    })
    setPendingReady(false)
    setSaving(false)
    load()
  }

  async function acknowledge() {
    setSaving(true)
    await fetch(`/api/part-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge' }),
    })
    setSaving(false)
    load()
  }

  function handleStatusChange(status: string) {
    if (status === 'ready') { setPendingReady(true); return }
    updateStatus(status)
  }

  if (loading) return <div className="p-8" style={{ color: 'var(--text-subtle)' }}>Loading...</div>
  if (!request) return (
    <div className="p-8">
      <p style={{ color: 'var(--text-muted)' }}>Part request not found.</p>
      <button onClick={() => router.push('/part-requests')} className="mt-3 text-sm" style={{ color: 'var(--color-info)' }}>← Back to Part Requests</button>
    </div>
  )

  const r = request
  const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
  const refLabel = r.tickets ? `Ticket ${r.tickets.ticket_no}` : r.projects ? `Project ${r.projects.project_no}` : '—'
  const refTitle = r.tickets?.title ?? r.projects?.name ?? ''
  const siteOrClient = r.tickets?.sites?.name ?? r.projects?.clients?.name ?? '—'
  const refHref = r.tickets ? `/tickets/${r.tickets.id}` : r.projects ? `/projects/${r.projects.id}` : null

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.push('/part-requests')}
        className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Back to Part Requests
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Package size={20} style={{ color: 'var(--text-subtle)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-base)' }}>Part Request</h1>
          </div>
          {refHref ? (
            <a href={refHref} className="text-sm mt-1 inline-block hover:underline" style={{ color: 'var(--color-info)' }}>
              {refLabel} — {refTitle}
            </a>
          ) : (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{refLabel} — {refTitle}</p>
          )}
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{siteOrClient}</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>
          {r.status.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>

      <div className="rounded-xl border p-5 mb-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p style={{ color: 'var(--text-subtle)' }}>Request Type</p>
            <p className="font-medium" style={{ color: 'var(--text-base)' }}>{TYPE_LABEL[r.request_type] ?? r.request_type}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-subtle)' }}>Engineer</p>
            <p className="font-medium" style={{ color: 'var(--text-base)' }}>{r.engineers?.users?.full_name ?? '—'}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-subtle)' }}>Requested By</p>
            <p className="font-medium" style={{ color: 'var(--text-base)' }}>{r.requested_by_user?.full_name ?? '—'}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-subtle)' }}>Date Requested</p>
            <p className="font-medium" style={{ color: 'var(--text-base)' }}>
              {new Date(r.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-subtle)' }}>Equipment Requested</p>
          {r.items && r.items.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                    {['Equipment', 'Model', 'Remark'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: i < r.items!.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-base)' }}>{it.description}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{it.model || '—'}</td>
                      <td className="px-3 py-2 italic" style={{ color: 'var(--text-subtle)' }}>{it.remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-base)' }}>{r.equipment_description}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>Update Status</h2>
        <Select value={r.status} onChange={e => handleStatusChange(e.target.value)} disabled={saving} className="max-w-xs">
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="ready">Ready for Collection</option>
          <option value="closed">Closed</option>
        </Select>

        {pendingReady && (
          <div className="space-y-2 max-w-md">
            <Textarea rows={2} placeholder="Pickup location / note (optional)"
              value={readyDraft} onChange={e => setReadyDraft(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => updateStatus('ready', readyDraft)} loading={saving}>Mark Ready</Button>
              <Button variant="secondary" onClick={() => setPendingReady(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {r.acknowledged_at ? (
          <div className="text-sm flex items-start gap-2" style={{ color: 'var(--color-success)' }}>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Collected by {r.acknowledged_by_user?.full_name ?? '—'} on{' '}
              {new Date(r.acknowledged_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        ) : r.status === 'ready' && !pendingReady ? (
          <div className="space-y-2">
            {r.ready_note && <p className="text-sm italic" style={{ color: 'var(--text-subtle)' }}>Note: {r.ready_note}</p>}
            <Button onClick={acknowledge} loading={saving}>Acknowledge / Collected</Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
