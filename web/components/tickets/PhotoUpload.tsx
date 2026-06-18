'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react'

interface Photo { url: string; label: string; caption: string; taken_at: string }

export default function PhotoUpload({ ticketId }: { ticketId: string }) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [label, setLabel]         = useState<'before' | 'after'>('before')
  const [caption, setCaption]     = useState('')
  const fileRef  = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function loadPhotos() {
    const res = await fetch(`/api/tickets/${ticketId}/photos`)
    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadPhotos() }, [ticketId])

  async function upload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('label', label)
    fd.append('caption', caption)
    await fetch(`/api/tickets/${ticketId}/photos`, { method: 'POST', body: fd })
    setCaption('')
    await loadPhotos()
    setUploading(false)
  }

  async function remove(url: string) {
    await fetch(`/api/tickets/${ticketId}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    loadPhotos()
  }

  const before = photos.filter(p => p.label === 'before')
  const after  = photos.filter(p => p.label === 'after')

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-subtle)' }}>
        Photos
      </h2>

      {/* Upload controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-lg" style={{ background: 'var(--bg-base)' }}>
        {/* Before / After toggle */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {(['before', 'after'] as const).map(l => (
            <button key={l} onClick={() => setLabel(l)}
              className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
              style={label === l
                ? { background: l === 'before' ? 'var(--color-info)' : 'var(--color-success)', color: '#fff' }
                : { background: 'transparent', color: 'var(--text-muted)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Caption input */}
        <input
          className="flex-1 min-w-32 px-3 py-1.5 rounded-lg text-sm border outline-none"
          style={{ background: 'var(--bg-card)', color: 'var(--text-base)', borderColor: 'var(--border)' }}
          placeholder="Caption (optional)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
        />

        {/* Upload file */}
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
          <Upload size={13} /> {uploading ? 'Uploading...' : 'Upload'}
        </button>

        {/* Camera capture */}
        <button onClick={() => cameraRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
          <Camera size={13} /> Capture
        </button>

        {/* Hidden inputs */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Loading photos...</p>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <ImageIcon size={28} style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No photos yet. Upload before and after images.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[{ key: 'before', list: before, color: 'var(--color-info)' },
            { key: 'after',  list: after,  color: 'var(--color-success)' }].map(({ key, list, color }) => (
            <div key={key}>
              <p className="text-xs font-bold uppercase mb-2" style={{ color }}>
                {key} ({list.length})
              </p>
              {list.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>No {key} photos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {list.map((p, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square"
                      style={{ borderColor: 'var(--border)' }}>
                      <img src={p.url} alt={p.caption || key}
                        className="w-full h-full object-cover" />
                      {p.caption && (
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-xs text-white"
                          style={{ background: 'rgba(0,0,0,0.6)' }}>
                          {p.caption}
                        </div>
                      )}
                      <button onClick={() => remove(p.url)}
                        className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'var(--color-danger)', color: '#fff' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
