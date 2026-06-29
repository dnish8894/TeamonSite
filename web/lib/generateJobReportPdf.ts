import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Report Settings types ────────────────────────────
export interface ReportSettings {
  report_title?:         string
  color_theme?:          'navy' | 'green' | 'red' | 'slate' | 'purple'
  section_labels?: {
    breakdown_box?:     string
    problem?:           string
    inspection?:        string
    root_cause?:        string
    action_taken?:      string
    recommendations?:   string
    parts?:             string
    photos?:            string
    ack?:               string
  }
  ack_labels?: {
    engineer?: string
    client?:   string
  }
  show_recommendations?: boolean
  show_parts?:           boolean
  show_photos?:          boolean
  extra_fields?: { id: string; label: string; field_type: 'text' | 'time' | 'location' | 'yes_no' | 'signature' }[]
  extra_field_site_ids?: string[]
}

// Color presets
const COLOR_THEMES: Record<string, { primary: [number,number,number]; accent: [number,number,number] }> = {
  navy:   { primary: [30,  33,  48],  accent: [37,  99,  235] },
  green:  { primary: [21,  128, 61],  accent: [22,  163, 74]  },
  red:    { primary: [153, 27,  27],  accent: [220, 38,  38]  },
  slate:  { primary: [51,  65,  85],  accent: [100, 116, 139] },
  purple: { primary: [88,  28,  135], accent: [147, 51,  234] },
}

function defaults(rs: ReportSettings | null | undefined) {
  const theme = COLOR_THEMES[rs?.color_theme ?? 'navy'] ?? COLOR_THEMES.navy
  return {
    report_title:       rs?.report_title                       || 'FIELD SERVICE REPORT',
    primary:            theme.primary,
    accent:             theme.accent,
    breakdown_box:      rs?.section_labels?.breakdown_box      || 'Breakdown Details',
    problem:            rs?.section_labels?.problem            || 'Description of Problem',
    inspection:         rs?.section_labels?.inspection         || 'Inspection / Observation',
    root_cause:         rs?.section_labels?.root_cause         || 'Root Cause Analysis',
    action_taken:       rs?.section_labels?.action_taken       || 'Action Taken / Analysis',
    recommendations:    rs?.section_labels?.recommendations    || 'Offsite Repair Actions / Recommendations (if any)',
    parts:              rs?.section_labels?.parts              || 'Details of Part(s) Replacement',
    photos:             rs?.section_labels?.photos             || 'Photo Records',
    ack:                rs?.section_labels?.ack                || 'Acknowledgement',
    eng_label:          rs?.ack_labels?.engineer               || 'Tech / Engineer',
    cli_label:          rs?.ack_labels?.client                 || 'Client Representative',
    show_recommendations: rs?.show_recommendations             ?? true,
    show_parts:           rs?.show_parts                       ?? true,
    show_photos:          rs?.show_photos                      ?? true,
  }
}

export interface PdfData {
  ticket: {
    ticket_no: string; title: string; description: string | null
    type: string; priority: string; status: string
    quotation_no?: string | null
    reporter_name: string | null; reporter_phone: string | null
    site_id?: string | null
    created_at: string; resolved_at: string | null; closed_at: string | null
    started_at?: string | null
    sla_resolve_due: string | null; sla_response_due: string | null
    sites: { name: string; address: string | null; city: string | null; state: string | null; site_contact: string | null; site_phone: string | null; clients: { name: string; type: string } | null } | null
    elv_systems: { name: string; type: string } | null
    devices: { name: string; tag_id: string | null; device_type: string; model: string | null; serial_no: string | null; location_desc: string | null; floor: number | null } | null
    engineers: { users: { full_name: string; phone: string | null } | null } | null
  }
  report: {
    findings: string | null; root_cause: string | null; work_done: string | null
    recommendation: string | null; labour_hrs: number | null; travel_hrs: number | null
    client_name: string | null; client_date: string | null; client_signature: string | null
    signed_at: string | null
    onsite_time: string | null; offsite_time: string | null
    job_status: string | null; remarks: string | null
    reported_by: string | null; reported_date: string | null; engineer_signature: string | null
    parts_used: Array<{ device: string; qty: string; model: string; serial_no: string; remarks: string }> | null
    photos: Array<{ url: string; label: string; caption: string }> | null
    custom_field_values?: Record<string, string> | null
  } | null
  activities: Array<{ action: string; new_value: string | null; note: string | null; created_at: string; users: { full_name: string } | null }>
  org: { name: string; phone: string | null; email: string | null; address: string | null; logo_url?: string | null; report_settings?: ReportSettings | null }
}

export function getApplicableExtraFields(data: PdfData) {
  const rs = data.org.report_settings
  const fields = rs?.extra_fields ?? []
  const siteIds = rs?.extra_field_site_ids ?? []
  if (!data.ticket.site_id || !siteIds.includes(data.ticket.site_id)) return []
  return fields
}

export async function generateJobReportPdf(data: PdfData) {
  const { ticket, report, org } = data
  const cfg = defaults(org.report_settings)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W  = doc.internal.pageSize.getWidth()
  const H  = doc.internal.pageSize.getHeight()
  const ml = 14
  const cw = W - ml * 2

  const NAVY  = cfg.primary
  const BLUE  = cfg.accent
  const BLACK = [20,  20,  20]  as [number,number,number]
  const GREY  = [100, 100, 100] as [number,number,number]
  const LGREY = [220, 220, 220] as [number,number,number]
  const WHITE = [255, 255, 255] as [number,number,number]

  let y = ml

  const fmt     = (d: string | null) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

  // Pre-fetch the org logo once (if set) so pageHeader() — called sync, possibly multiple times per doc — can embed it
  let logoBase64: string | null = null
  let logoFormat: 'PNG' | 'JPEG' = 'PNG'
  if (org.logo_url) {
    try {
      const blob = await (await fetch(org.logo_url)).blob()
      logoFormat = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG'
      logoBase64 = await new Promise<string>(resolve => {
        const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob)
      })
    } catch { /* logo failed to load — header falls back to text-only */ }
  }

  // ── Page header ──────────────────────────────────────
  function pageHeader() {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 22, 'F')
    doc.setTextColor(...WHITE)
    const textX = logoBase64 ? ml + 18 : ml
    if (logoBase64) {
      try { doc.addImage(logoBase64, logoFormat, ml, 3, 15, 15) } catch { /* skip broken logo */ }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text(org.name, textX, 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    const sub = [org.address, org.phone ? `Tel: ${org.phone}` : null, org.email].filter(Boolean).join('   ·   ')
    doc.text(sub, textX, 16)
    // Call ID box — widened, with text auto-shrunk to fit so long ticket numbers stay visible
    const boxW = 54
    const boxX = W - ml - boxW
    const padX = 2.5
    doc.setFillColor(...WHITE)
    doc.roundedRect(boxX, 4, boxW, 14, 1.5, 1.5, 'F')
    doc.setTextColor(...GREY); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
    doc.text('CALL ID', boxX + padX, 9.5)
    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold')
    let idFont = 10
    doc.setFontSize(idFont)
    const avail = boxW - padX * 2
    while (idFont > 6 && doc.getTextWidth(ticket.ticket_no) > avail) {
      idFont -= 0.5
      doc.setFontSize(idFont)
    }
    doc.text(ticket.ticket_no, boxX + padX, 15.5)
    // Separator
    doc.setDrawColor(...LGREY); doc.setLineWidth(0.3)
    doc.line(ml, 23, W - ml, 23)
    y = 28
  }

  // ── Section header ───────────────────────────────────
  function section(title: string, extraY = 3) {
    if (y + 12 > H - 15) { doc.addPage(); pageHeader() }
    y += extraY
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLACK)
    doc.text(title, ml, y)
    y += 1.5
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.35)
    doc.line(ml, y, W - ml, y)
    doc.setLineWidth(0.2)
    y += 5
  }

  // ── Text block ───────────────────────────────────────
  function textBox(content: string | null | undefined, minH = 16) {
    const bh = content?.trim()
      ? Math.max(minH, doc.splitTextToSize(content.trim(), cw - 6).length * 4.5 + 6)
      : minH
    if (y + bh > H - 15) { doc.addPage(); pageHeader() }
    doc.setFillColor(249, 250, 252)
    doc.rect(ml, y, cw, bh, 'F')
    doc.setDrawColor(...LGREY); doc.rect(ml, y, cw, bh)
    if (content?.trim()) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...BLACK)
      const lines = doc.splitTextToSize(content.trim(), cw - 6)
      doc.text(lines, ml + 3, y + 5)
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
      doc.text('— Not filled in —', ml + 3, y + 5)
    }
    y += bh + 5
  }

  // ── Key-value row ────────────────────────────────────
  function kvRow(rows: Array<[string, string, string, string]>) {
    const half = cw / 2
    for (const [lk, lv, rk, rv] of rows) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
      doc.text(lk, ml, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
      doc.text(lv || '—', ml + 36, y)
      if (rk) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY)
        doc.text(rk, ml + half + 4, y)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
        doc.text(rv || '—', ml + half + 40, y)
      }
      y += 5.5
    }
  }

  // ════════════════════════════════════════════════════
  // PAGE 1
  // ════════════════════════════════════════════════════
  pageHeader()

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BLACK)
  doc.text(cfg.report_title, W / 2, y + 5, { align: 'center' })
  y += 14

  // ── Breakdown Details box ────────────────────────────
  const bStart = y
  doc.setFillColor(245, 247, 250); doc.roundedRect(ml, y, cw, 58, 2, 2, 'F')
  doc.setFillColor(...NAVY); doc.roundedRect(ml, y, cw, 7.5, 2, 2, 'F')
  doc.rect(ml, y + 4, cw, 3.5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE)
  doc.text(cfg.breakdown_box, W / 2, y + 5.5, { align: 'center' })
  doc.setTextColor(...BLACK)
  y += 11

  kvRow([
    ['Company',       ticket.sites?.clients?.name ?? '—',            'Tech. Name',    ticket.engineers?.users?.full_name ?? '—'],
    ['Site Name',     ticket.sites?.name ?? '—',                     'Response Date', fmt(ticket.created_at)],
    ['Reported By',   ticket.reporter_name ?? '—',                   'Response Time', fmtTime(ticket.created_at)],
    ['Log Date',      fmt(ticket.created_at),                        'Log Time',      fmtTime(ticket.created_at)],
    ['On-Site Time',  report?.onsite_time ?? '—',                    'Target Resolve',fmtTime(ticket.sla_resolve_due)],
    ['Priority',      ticket.priority,                               'System',        ticket.elv_systems?.type.replace(/_/g,' ') ?? '—'],
    ['Job Type',      ticket.type.replace(/_/g,' '),                 'Severity',      ticket.priority],
    ['Job Status',    (report?.job_status ?? ticket.status).replace(/_/g,' ').toUpperCase(), 'Quotation No.', ticket.quotation_no ?? '—'],
  ])

  doc.setDrawColor(...LGREY); doc.roundedRect(ml, bStart, cw, y - bStart + 3, 2, 2)
  y += 6

  // ── Section: Problem ─────────────────────────────────
  section(cfg.problem)
  textBox(ticket.description, 18)

  // ── Section: Device ──────────────────────────────────
  section('Device Name')
  const deviceStr = ticket.devices
    ? [ticket.devices.name, ticket.devices.tag_id ? `[${ticket.devices.tag_id}]` : null,
       ticket.devices.model, ticket.devices.location_desc,
       ticket.devices.floor != null ? `Level ${ticket.devices.floor}` : null]
       .filter(Boolean).join('   ·   ')
    : null
  textBox(deviceStr, 12)

  // ── Section: Inspection ──────────────────────────────
  section(cfg.inspection)
  textBox(report?.findings, 20)

  // ── Section: Action Taken ────────────────────────────
  section(cfg.action_taken)
  textBox(report?.work_done, 20)

  // ── Section: Root Cause ──────────────────────────────
  section(cfg.root_cause)
  textBox(report?.root_cause, 16)

  // ── Section: Recommendations (optional) ─────────────
  if (cfg.show_recommendations) {
    section(cfg.recommendations)
    textBox(report?.recommendation, 16)
  }

  // ── Section: Extra Fields (assigned to this site via Settings) ─────────
  const extraFields = getApplicableExtraFields(data)
  if (extraFields.length > 0) {
    section('Additional Information')
    const cv = report?.custom_field_values ?? {}
    for (const f of extraFields) {
      const val = cv[f.id]
      if (f.field_type === 'signature') {
        if (y + 28 > H - 15) { doc.addPage(); pageHeader() }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
        doc.text(f.label, ml, y)
        y += 2
        if (val) {
          try { doc.addImage(val, 'PNG', ml, y, 50, 18) } catch { /* skip */ }
        } else {
          doc.setDrawColor(...LGREY); doc.setFillColor(252,252,252); doc.rect(ml, y, 50, 18, 'FD')
        }
        y += 22
      } else {
        if (y + 6 > H - 15) { doc.addPage(); pageHeader() }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
        doc.text(f.label, ml, y)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLACK)
        doc.text(val ?? '—', ml + 55, y)
        y += 5.5
      }
    }
    y += 4
  }

  // ── Job Status row ────────────────────────────────────
  if (y + 16 > H - 15) { doc.addPage(); pageHeader() }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLACK)
  doc.text('Job Status:', ml, y)
  const statusLabel = (report?.job_status ?? ticket.status).replace(/_/g,' ').toUpperCase()
  doc.setFillColor(...BLUE); doc.roundedRect(ml + 22, y - 5, 38, 7, 1, 1, 'F')
  doc.setTextColor(...WHITE); doc.setFontSize(8)
  doc.text(statusLabel, ml + 41, y, { align: 'center' })
  doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('Remarks:', ml + 68, y)
  doc.setFont('helvetica', 'normal')
  doc.text(report?.remarks ?? '—', ml + 88, y)
  y += 10
  doc.setDrawColor(...LGREY); doc.line(ml, y, W - ml, y); y += 6

  // ── Section: Parts (optional) ────────────────────────
  if (cfg.show_parts) {
    if (y + 30 > H - 15) { doc.addPage(); pageHeader() }
    section(cfg.parts)
    const partsBody = (report?.parts_used?.length ?? 0) > 0
      ? report!.parts_used!.map(p => [p.device, p.qty, p.model, p.serial_no, p.remarks])
      : [['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']]

    autoTable(doc, {
      startY: y,
      margin: { left: ml, right: ml },
      head: [['Device / Part', 'Qty', 'Model', 'Serial Number', 'Remarks']],
      body: partsBody,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 12 } },
      theme: 'grid',
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ════════════════════════════════════════════════════
  // PAGE 2 — Photos + Acknowledgement
  // ════════════════════════════════════════════════════
  doc.addPage(); pageHeader()

  // ── Section: Photos (optional) ───────────────────────
  if (cfg.show_photos) {
    section(cfg.photos)

    const photos  = report?.photos ?? []
    const befores = photos.filter(p => p.label === 'before')
    const afters  = photos.filter(p => p.label === 'after')
    const pairs   = Math.max(befores.length, afters.length, 1)
    const imgW    = (cw - 8) / 2
    const imgH    = 60

    for (let i = 0; i < pairs; i++) {
      if (y + imgH + 18 > H - 20) { doc.addPage(); pageHeader(); section(`${cfg.photos} (continued)`) }
      const bPhoto = befores[i]
      const aPhoto = afters[i]

      for (const [photo, xOff, caption] of [
        [bPhoto, 0,        'Breakdown Picture (before)'],
        [aPhoto, imgW + 8, 'Breakdown Picture (after)'],
      ] as [typeof bPhoto, number, string][]) {
        const x = ml + xOff
        if (photo) {
          try {
            const blob = await (await fetch(photo.url)).blob()
            const b64  = await new Promise<string>(resolve => {
              const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob)
            })
            doc.addImage(b64, 'JPEG', x, y, imgW, imgH)
          } catch {
            doc.setDrawColor(...LGREY); doc.setFillColor(248,249,252); doc.rect(x, y, imgW, imgH, 'FD')
            doc.setFontSize(8); doc.setTextColor(...LGREY)
            doc.text('[No image]', x + imgW / 2, y + imgH / 2, { align: 'center' })
          }
          if (photo.caption) {
            doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.setFont('helvetica', 'italic')
            doc.text(photo.caption, x + imgW / 2, y + imgH + 4, { align: 'center' })
          }
        } else {
          doc.setDrawColor(...LGREY); doc.setFillColor(248,249,252); doc.rect(x, y, imgW, imgH, 'FD')
          doc.setFontSize(8); doc.setTextColor(...LGREY)
          doc.text('No photo', x + imgW / 2, y + imgH / 2, { align: 'center' })
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY)
        doc.text(caption, x + imgW / 2, y + imgH + (photo?.caption ? 9 : 5), { align: 'center' })
      }
      y += imgH + 16
    }
  }

  // ── Section: Acknowledgement ─────────────────────────
  if (y + 60 > H - 15) { doc.addPage(); pageHeader() }
  y += 4; section(cfg.ack)

  const r = report as Record<string, string | null | undefined> & typeof report
  const engName: string       = r?.reported_by         || ticket.engineers?.users?.full_name || ''
  const engDate: string | null = r?.reported_date      || ticket.resolved_at || null
  const engSig:  string | null = r?.engineer_signature || null
  const cliName: string        = r?.client_name        || ''
  const cliDate: string | null = r?.client_date        || null
  const cliSig:  string | null = r?.client_signature   || null

  const boxW = (cw - 10) / 2
  const boxH = 52

  const sides = [
    { xOff: 0,         role: cfg.eng_label, name: engName, date: fmt(engDate), sig: engSig, color: BLUE                              },
    { xOff: boxW + 10, role: cfg.cli_label, name: cliName, date: fmt(cliDate), sig: cliSig, color: [22,163,74] as [number,number,number] },
  ]

  for (const s of sides) {
    const x = ml + s.xOff
    doc.setDrawColor(...LGREY); doc.rect(x, y, boxW, boxH)
    doc.setFillColor(...s.color)
    doc.rect(x, y, boxW, 7, 'F')
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
    } else {
      doc.setDrawColor(...LGREY); doc.setFillColor(252, 252, 252)
      doc.rect(x + 3, y + 25, boxW - 6, 20, 'FD')
      doc.setFontSize(7); doc.setTextColor(...LGREY)
      doc.text('Sign here', x + boxW / 2, y + 36, { align: 'center' })
    }
    doc.setDrawColor(...LGREY); doc.line(x + 3, y + 49, x + boxW - 3, y + 49)
    doc.setFontSize(7); doc.setTextColor(...LGREY)
    doc.text('Signature', x + boxW / 2, y + 51, { align: 'center' })
  }
  y += boxH + 12

  // ── Footer ────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LGREY); doc.line(ml, H - 9, W - ml, H - 9)
    doc.setFontSize(7); doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal')
    doc.text(`${org.name}   ·   ${ticket.ticket_no}   ·   Page ${i} of ${total}`, W / 2, H - 5, { align: 'center' })
  }

  doc.save(`${ticket.ticket_no}-field-service-report.pdf`)
}
