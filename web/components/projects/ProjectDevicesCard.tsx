'use client'

import { useEffect, useState } from 'react'
import { Cpu, Plus, X, CheckCircle } from 'lucide-react'
import Button from '@/components/ui/Button'

interface Dev {
  id: string
  name: string
  tag_id: string | null
  device_type: string
  elv_systems: { name: string | null; type: string } | null
}

const SYS_LABEL: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS',
}

export default function ProjectDevicesCard({ projectId }: { projectId: string }) {
  const [linked, setLinked] = useState<Dev[]>([])
  const [available, setAvailable] = useState<Dev[]>([])
  const [showManage, setShowManage] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/devices`)
    const data = await res.json()
    setLinked(data.linked ?? [])
    setAvailable(data.available ?? [])
  }
  useEffect(() => { load() }, [projectId])

  function openManage() {
    setSelected(linked.map(d => d.id))
    setShowManage(true)
  }
  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/devices`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: selected }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
    setShowManage(false); load()
  }

  // In the manage view, show currently-linked + still-available devices
  const manageList = [...linked, ...available.filter(a => !linked.some(l => l.id === a.id))]

  return (
    <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--text-base)' }}>Project Devices</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{linked.length} device{linked.length !== 1 ? 's' : ''} installed under this project</p>
        </div>
        <button onClick={openManage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: '#f97316', color: '#fff' }}>
          <Plus size={14} /> Manage
        </button>
      </div>

      {linked.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No devices linked yet. Click Manage to assign devices installed under this project.</p>
      ) : (
        <div className="space-y-2">
          {linked.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              <Cpu size={15} style={{ color: 'var(--color-success)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{d.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {d.tag_id ?? d.device_type}{d.elv_systems ? ` · ${SYS_LABEL[d.elv_systems.type] ?? d.elv_systems.type}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowManage(false)}>
          <div className="rounded-xl border w-full max-w-md max-h-[80vh] flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-base)' }}>Manage Project Devices</h3>
              <button onClick={() => setShowManage(false)} style={{ color: 'var(--text-subtle)' }}><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {manageList.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No devices found at this project's site. Add devices on the Devices page first.</p>
              ) : (
                <div className="space-y-2">
                  {manageList.map(d => {
                    const on = selected.includes(d.id)
                    return (
                      <button key={d.id} type="button" onClick={() => toggle(d.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all"
                        style={on ? { borderColor: 'var(--color-info)', background: 'var(--color-info-bg)' } : { borderColor: 'var(--border)' }}>
                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                          style={on ? { borderColor: 'var(--color-info)', background: 'var(--color-info)' } : { borderColor: 'var(--border)' }}>
                          {on && <CheckCircle size={10} color="white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{d.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{d.tag_id ?? d.device_type}{d.elv_systems ? ` · ${SYS_LABEL[d.elv_systems.type] ?? d.elv_systems.type}` : ''}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setShowManage(false)}>Cancel</Button>
              <Button onClick={save} loading={saving}>{saved ? 'Saved' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
