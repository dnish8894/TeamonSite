import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PmDeviceLine {
  device_id: string; name: string | null; tag_id: string | null
  checks: Record<string, boolean>; notes: string
}
export interface PmCheckItem { key: string; label: string }

export interface PmPdfData {
  checkItems: PmCheckItem[]
  report: {
    id: string; visit_date: string; summary: string | null; status: string
    started_at: string | null; completed_at: string | null
    devices: PmDeviceLine[]
    service_engineers: { id: string; name: string }[]
    engineer_name: string | null; engineer_date: string | null; engineer_signature: string | null
    client_name: string | null;   client_date: string | null;   client_signature: string | null
    engineers: { users: { full_name: string } | null } | null
    sites: { name: string; address: string | null; clients: { name: string } | null } | null
    elv_systems: { name: string; type: string } | null
    pm_schedules: { name: string } | null
  }
  org: { name?: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null } | null
}

const NAVY: [number, number, number]  = [30, 33, 48]
const BLUE: [number, number, number]  = [37, 99, 235]
const GREEN: [number, number, number] = [22, 163, 74]
const GREY: [number, number, number]  = [90, 90, 90]
const LGREY: [number, number, number] = [180, 180, 180]
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [20, 20, 20]

const SYS_LABELS: Record<string, string> = {
  cctv: 'CCTV', access_control: 'Access Control',
  structured_cabling: 'Structured Cabling', av: 'AV', pa: 'PA', bms: 'BMS',
}

function fmt(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function urlToBase64(url: string): Promise<{ data: string; fmt: string } | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    const f = blob.type.includes('png') ? 'PNG' : 'JPEG'
    return { data, fmt: f }
  } catch { return null }
}

export async function generatePmReportPdf({ report, org, checkItems }: PmPdfData) {
  const items = checkItems?.length ? checkItems : []
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const ml = 14
  const cw = W - ml * 2
  let y = 0

  const logo = org?.logo_url ? await urlToBase64(org.logo_url) : null

  function pageHeader() {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 22, 'F')
    if (logo) { try { doc.addImage(logo.data, logo.fmt, ml, 3.5, 15, 15) } catch { /* skip */ } }
    doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text('PREVENTIVE MAINTENANCE REPORT', logo ? ml + 19 : ml, 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(org?.name || '', logo ? ml + 19 : ml, 16)
    y = 28
  }

  function section(label: string) {
    if (y + 10 > H - 15) { doc.addPage(); pageHeader() }
    doc.setFillColor(...BLUE); doc.rect(ml, y, cw, 6, 'F')
    doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    doc.text(label.toUpperCase(), ml + 2, y + 4.2)
    y += 9
  }

  function kv(rows: [string, string][]) {
    doc.setFontSize(8.5)
    const colW = cw / 2
    rows.forEach((r, i) => {
      const x = ml + (i % 2) * colW
      if (i % 2 === 0 && i > 0) y += 6
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY)
      doc.text(r[0], x, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
      doc.text(r[1] || '—', x + 32, y)
    })
    y += 8
  }

  pageHeader()

  // ── Visit details ──
  section('Visit Details')
  kv([
    ['Schedule', report.pm_schedules?.name || ''],
    ['Site', report.sites?.name || ''],
    ['Client', report.sites?.clients?.name || ''],
    ['System', report.elv_systems ? (SYS_LABELS[report.elv_systems.type] ?? report.elv_systems.type) : 'All systems'],
    ['Engineers', (report.service_engineers ?? []).map(e => e.name).filter(Boolean).join(', ')
      || report.engineer_name || report.engineers?.users?.full_name || ''],
    ['Status', report.status === 'completed' ? 'Completed' : 'Draft'],
    ['Start Date', fmt(report.started_at)],
    ['Completed', fmt(report.completed_at)],
  ])

  // ── Devices serviced ──
  section('Devices Serviced')
  autoTable(doc, {
    startY: y,
    head: [['#', 'Device', 'Tag ID', 'Checks Done', 'Remarks']],
    body: report.devices.map((d, i) => [
      String(i + 1),
      d.name || 'Device',
      d.tag_id || '',
      items.filter(c => d.checks?.[c.key]).map(c => c.label).join(', ') || '—',
      d.notes || '',
    ]),
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: BLACK },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 24 }, 3: { cellWidth: 48 } },
    margin: { left: ml, right: ml },
    didDrawPage: () => { /* header handled manually */ },
  })
  // @ts-expect-error lastAutoTable injected by plugin
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  // ── Overall remarks ──
  if (report.summary) {
    section('Overall Remarks')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...BLACK)
    const lines = doc.splitTextToSize(report.summary, cw)
    if (y + lines.length * 4.5 > H - 15) { doc.addPage(); pageHeader() }
    doc.text(lines, ml, y)
    y += lines.length * 4.5 + 6
  }

  // ── Acknowledgement ──
  if (y + 60 > H - 15) { doc.addPage(); pageHeader() }
  section('Acknowledgement')
  const boxW = (cw - 10) / 2
  const boxH = 52
  const sides = [
    { xOff: 0, role: 'Engineer', name: report.engineer_name || report.engineers?.users?.full_name || '',
      date: fmt(report.engineer_date), sig: report.engineer_signature, color: BLUE },
    { xOff: boxW + 10, role: 'Client Representative', name: report.client_name || '',
      date: fmt(report.client_date), sig: report.client_signature, color: GREEN },
  ]
  for (const s of sides) {
    const x = ml + s.xOff
    doc.setDrawColor(...LGREY); doc.rect(x, y, boxW, boxH)
    doc.setFillColor(...s.color); doc.rect(x, y, boxW, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE)
    doc.text(s.role.toUpperCase(), x + boxW / 2, y + 5, { align: 'center' })
    doc.setTextColor(...GREY); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('Name :', x + 3, y + 14)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
    doc.text(s.name || '________________________________', x + 18, y + 14)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY)
    doc.text('Date :', x + 3, y + 21)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
    doc.text(s.date || '________________________________', x + 18, y + 21)
    if (s.sig) {
      try { doc.addImage(s.sig, 'PNG', x + 3, y + 25, boxW - 6, 20) } catch { /* skip */ }
    }
    doc.setDrawColor(...LGREY); doc.line(x + 3, y + 49, x + boxW - 3, y + 49)
    doc.setFontSize(7); doc.setTextColor(...LGREY)
    doc.text('Signature', x + boxW / 2, y + 51, { align: 'center' })
  }
  y += boxH + 10

  // ── Footer ──
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LGREY); doc.line(ml, H - 9, W - ml, H - 9)
    doc.setFontSize(7); doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal')
    doc.text(`${org?.name || ''}   ·   PM Report   ·   Page ${i} of ${total}`, W / 2, H - 5, { align: 'center' })
  }

  const fname = `PM-${(report.sites?.name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}-${(report.visit_date || '').slice(0, 10)}.pdf`
  doc.save(fname)
}
