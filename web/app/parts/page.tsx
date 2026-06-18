'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Field'
import Button from '@/components/ui/Button'
import {
  Plus, Package, AlertTriangle, Search,
  ArrowUpDown, Edit2, Trash2,
  Upload, Download, FileSpreadsheet, FileText,
  CheckCircle2, XCircle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Part {
  id: string; name: string; part_no: string | null; brand: string | null
  unit: string; unit_cost: number | null; stock_qty: number
  min_stock_qty: number; location: string | null; is_active: boolean
}

const UNITS = ['pcs', 'm', 'roll', 'set', 'box', 'pair', 'litre', 'kg']

const emptyForm = {
  name: '', part_no: '', brand: '', unit: 'pcs',
  unit_cost: '', stock_qty: '0', min_stock_qty: '0', location: '',
}

export default function PartsPage() {
  const [parts, setParts]             = useState<Part[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState<'all' | 'low' | 'ok'>('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [editPart, setEditPart]       = useState<Part | null>(null)
  const [adjustPart, setAdjustPart]   = useState<Part | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [form, setForm]               = useState(emptyForm)
  const [adjustForm, setAdjustForm]   = useState({ type: 'add', qty: '', note: '' })

  // Import state
  const fileInputRef                  = useRef<HTMLInputElement>(null)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null)

  const set    = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setAdj = (k: string, v: string) => setAdjustForm(f => ({ ...f, [k]: v }))

  async function load() {
    const res = await fetch('/api/parts')
    setParts(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openEdit(p: Part) {
    setEditPart(p)
    setForm({
      name: p.name, part_no: p.part_no ?? '', brand: p.brand ?? '',
      unit: p.unit, unit_cost: p.unit_cost?.toString() ?? '',
      stock_qty: p.stock_qty.toString(),
      min_stock_qty: p.min_stock_qty.toString(),
      location: p.location ?? '',
    })
    setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const res = await fetch('/api/parts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowAdd(false); setForm(emptyForm); load()
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editPart || !form.name.trim()) return setError('Name is required.')
    setSaving(true); setError('')
    const res = await fetch(`/api/parts/${editPart.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setEditPart(null); setForm(emptyForm); load()
    setSaving(false)
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustPart || !adjustForm.qty) return
    setSaving(true)
    await fetch(`/api/parts/${adjustPart.id}/adjust`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adjustForm),
    })
    setSaving(false); setAdjustPart(null)
    setAdjustForm({ type: 'add', qty: '', note: '' }); load()
  }

  async function deletePart(id: string) {
    if (!confirm('Remove this part from inventory?')) return
    await fetch(`/api/parts/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Export Excel ─────────────────────────────────────────────────────────
  function exportExcel() {
    const rows = parts.map(p => ({
      'Name':           p.name,
      'Part No':        p.part_no ?? '',
      'Brand':          p.brand ?? '',
      'Unit':           p.unit,
      'Unit Cost (RM)': p.unit_cost ?? '',
      'Stock Qty':      p.stock_qty,
      'Min Stock':      p.min_stock_qty,
      'Location':       p.location ?? '',
      'Status':         p.stock_qty <= p.min_stock_qty ? (p.stock_qty === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Column widths
    ws['!cols'] = [30, 18, 18, 8, 14, 10, 10, 25, 14].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16)
    doc.text('Parts & Inventory Report', 14, 16)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-MY')}   Total parts: ${parts.length}   Total value: RM ${totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, 14, 23)

    autoTable(doc, {
      startY: 28,
      head: [['Name', 'Part No', 'Brand', 'Unit', 'Unit Cost (RM)', 'Stock', 'Min Stock', 'Location', 'Status']],
      body: parts.map(p => [
        p.name,
        p.part_no ?? '—',
        p.brand ?? '—',
        p.unit,
        p.unit_cost != null ? `RM ${Number(p.unit_cost).toFixed(2)}` : '—',
        p.stock_qty,
        p.min_stock_qty,
        p.location ?? '—',
        p.stock_qty === 0 ? 'Out of Stock' : p.stock_qty <= p.min_stock_qty ? 'Low Stock' : 'In Stock',
      ]),
      headStyles: { fillColor: [249, 115, 22], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 45 },
        7: { cellWidth: 35 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 8) {
          const val = String(data.cell.raw)
          if (val === 'Out of Stock') data.cell.styles.textColor = [220, 38, 38]
          else if (val === 'Low Stock') data.cell.styles.textColor = [217, 119, 6]
          else data.cell.styles.textColor = [22, 163, 74]
        }
      },
    })

    doc.save(`inventory_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // ── Download Template ─────────────────────────────────────────────────────
  function downloadTemplate() {
    const template = [{
      'Name': 'Example: Cat6 UTP Cable',
      'Part No': 'CAT6-305M',
      'Brand': 'Panduit',
      'Unit': 'roll',
      'Unit Cost (RM)': 280.00,
      'Stock Qty': 5,
      'Min Stock': 2,
      'Location': 'Warehouse Shelf B3',
    }]
    const ws = XLSX.utils.json_to_sheet(template)
    ws['!cols'] = [30, 18, 18, 8, 16, 10, 10, 25].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, 'inventory_import_template.xlsx')
  }

  // ── Import Excel ──────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/parts/import', { method: 'POST', body: fd })
    const json = await res.json()
    setImporting(false)
    if (e.target) e.target.value = ''

    if (!res.ok) {
      setImportResult({ inserted: 0, skipped: 0, errors: [json.error] })
    } else {
      setImportResult(json)
      load()
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const lowStock = parts.filter(p => p.stock_qty <= p.min_stock_qty)
  const displayed = parts
    .filter(p => filter === 'all' ? true : filter === 'low' ? p.stock_qty <= p.min_stock_qty : p.stock_qty > p.min_stock_qty)
    .filter(p => !search
      || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.part_no ?? '').toLowerCase().includes(search.toLowerCase())
      || (p.brand ?? '').toLowerCase().includes(search.toLowerCase()))

  const totalValue = parts.reduce((sum, p) => sum + (p.unit_cost ?? 0) * p.stock_qty, 0)

  const PartForm = ({ onSubmit, title, onClose }: { onSubmit: (e: React.FormEvent) => void; title: string; onClose: () => void }) => (
    <Modal title={title} onClose={onClose} width="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Part Name" required>
            <Input placeholder="e.g. Cat6 UTP Cable" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Part No.">
            <Input placeholder="e.g. CAT6-305M" value={form.part_no} onChange={e => set('part_no', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand">
            <Input placeholder="e.g. Panduit" value={form.brand} onChange={e => set('brand', e.target.value)} />
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Unit Cost (RM)">
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} />
          </Field>
          <Field label="Stock Qty">
            <Input type="number" min="0" step="0.01" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} />
          </Field>
          <Field label="Min Stock (alert)">
            <Input type="number" min="0" step="0.01" value={form.min_stock_qty} onChange={e => set('min_stock_qty', e.target.value)} />
          </Field>
        </div>
        <Field label="Storage Location">
          <Input placeholder="e.g. Warehouse Shelf B3" value={form.location} onChange={e => set('location', e.target.value)} />
        </Field>
        {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Part</Button>
        </div>
      </form>
    </Modal>
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>Parts & Inventory</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {parts.length} parts · Total value: RM {totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Import Excel */}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Import from Excel"
          >
            <Upload size={15} />
            {importing ? 'Importing…' : 'Import Excel'}
          </button>

          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-success)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Download import template"
          >
            <FileSpreadsheet size={15} />
            Template
          </button>

          {/* Export Excel */}
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-success)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Export to Excel"
          >
            <Download size={15} />
            Excel
          </button>

          {/* Export PDF */}
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Export to PDF"
          >
            <FileText size={15} />
            PDF
          </button>

          {/* Add Part */}
          <Button onClick={() => { setShowAdd(true); setForm(emptyForm); setError('') }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Add Part</span>
          </Button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="mb-5 rounded-xl border p-4 flex items-start gap-3"
          style={{
            background: importResult.errors.length > 0 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
            borderColor: importResult.errors.length > 0 ? 'var(--color-warning)' : 'var(--color-success)',
          }}>
          {importResult.errors.length === 0
            ? <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
            : <XCircle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
          }
          <div className="flex-1 text-sm">
            <p className="font-semibold" style={{ color: 'var(--text-base)' }}>
              Import complete — {importResult.inserted} parts added
              {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5" style={{ color: 'var(--color-danger)' }}>
                {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--text-subtle)' }}>✕</button>
        </div>
      )}

      {/* Summary cards */}
      {parts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Parts',  value: parts.length,     color: 'var(--color-info)',    suffix: '' },
            { label: 'Low Stock',    value: lowStock.length,  color: lowStock.length > 0 ? 'var(--color-danger)' : 'var(--color-success)', suffix: ' items' },
            { label: 'Total Units',  value: parts.reduce((s, p) => s + p.stock_qty, 0).toFixed(0), color: 'var(--color-success)', suffix: ' units' },
            { label: 'Stock Value',  value: `RM ${totalValue.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`, color: 'var(--color-warning)', suffix: '' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}{s.suffix}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
          <input
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text-base)', borderColor: 'var(--border)' }}
            placeholder="Search by name, part no, brand..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'low', 'ok'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={filter === f
              ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
              : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {f === 'all' ? `All (${parts.length})` : f === 'low' ? `⚠ Low Stock (${lowStock.length})` : `✓ In Stock (${parts.length - lowStock.length})`}
          </button>
        ))}
      </div>

      {/* Parts table */}
      {loading ? (
        <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Package size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No parts found.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Add spare parts manually or import from Excel.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
              style={{ color: 'var(--color-success)', borderColor: 'var(--border)', background: 'var(--bg-base)' }}>
              <FileSpreadsheet size={14} /> Download Template
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
              style={{ color: '#f97316', borderColor: '#f97316', background: 'var(--bg-base)' }}>
              <Upload size={14} /> Import Excel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name / Part No', 'Brand', 'Unit Cost', 'Stock', 'Min Stock', 'Location', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(p => {
                const isLow   = p.stock_qty <= p.min_stock_qty
                const stockColor = isLow
                  ? p.stock_qty === 0 ? 'var(--color-danger)' : 'var(--color-warning)'
                  : 'var(--color-success)'

                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-base)' }}>{p.name}</p>
                      {p.part_no && <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-subtle)' }}>{p.part_no}</p>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{p.brand ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {p.unit_cost != null ? `RM ${Number(p.unit_cost).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base" style={{ color: stockColor }}>
                          {p.stock_qty}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{p.unit}</span>
                        {isLow && (
                          <span className="flex items-center gap-0.5 text-xs font-medium"
                            style={{ color: p.stock_qty === 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            <AlertTriangle size={11} />
                            {p.stock_qty === 0 ? 'Out' : 'Low'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {p.min_stock_qty} {p.unit}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {p.location ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setAdjustPart(p); setAdjustForm({ type: 'add', qty: '', note: '' }) }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-info)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                          title="Adjust stock">
                          <ArrowUpDown size={14} />
                        </button>
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-success)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                          title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deletePart(p.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                          title="Remove">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showAdd && <PartForm title="Add Part" onSubmit={handleAdd} onClose={() => setShowAdd(false)} />}

      {/* Edit modal */}
      {editPart && <PartForm title={`Edit — ${editPart.name}`} onSubmit={handleEdit} onClose={() => setEditPart(null)} />}

      {/* Adjust stock modal */}
      {adjustPart && (
        <Modal title={`Adjust Stock — ${adjustPart.name}`} onClose={() => setAdjustPart(null)} width="max-w-sm">
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-base)' }}>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Current Stock</p>
              <p className="text-3xl font-bold mt-1"
                style={{ color: adjustPart.stock_qty <= adjustPart.min_stock_qty ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {adjustPart.stock_qty} <span className="text-sm font-normal">{adjustPart.unit}</span>
              </p>
            </div>

            <Field label="Adjustment Type">
              <Select value={adjustForm.type} onChange={e => setAdj('type', e.target.value)}>
                <option value="add">➕ Add stock (received)</option>
                <option value="remove">➖ Remove stock (used / damaged)</option>
                <option value="set">🎯 Set exact quantity</option>
              </Select>
            </Field>

            <Field label={`Quantity (${adjustPart.unit})`} required>
              <Input type="number" min="0" step="0.01" placeholder="0"
                value={adjustForm.qty} onChange={e => setAdj('qty', e.target.value)} />
            </Field>

            {adjustForm.qty && (
              <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-base)' }}>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>New Stock Will Be</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-info)' }}>
                  {adjustForm.type === 'set'
                    ? parseFloat(adjustForm.qty || '0')
                    : adjustForm.type === 'add'
                    ? adjustPart.stock_qty + parseFloat(adjustForm.qty || '0')
                    : Math.max(0, adjustPart.stock_qty - parseFloat(adjustForm.qty || '0'))
                  } <span className="text-sm font-normal">{adjustPart.unit}</span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setAdjustPart(null)}>Cancel</Button>
              <Button type="submit" loading={saving} disabled={!adjustForm.qty}>Confirm</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
