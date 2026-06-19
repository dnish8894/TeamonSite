import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ImageRun, HeadingLevel,
} from 'docx'
import { saveAs } from 'file-saver'
import type { PdfData } from './generateJobReportPdf'
import { getApplicableExtraFields } from './generateJobReportPdf'

const fmt     = (d: string | null) => d ? new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

function heading(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })
}

function bodyText(text: string | null | undefined) {
  return new Paragraph({ children: [new TextRun(text?.trim() || '—')], spacing: { after: 200 } })
}

function kvCell(label: string, value: string) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value || '—')] })],
  })
}

async function dataUrlToBuffer(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

export async function generateJobReportDocx(data: PdfData) {
  const { ticket, report, org } = data
  const rs = org.report_settings ?? {}

  const title = rs.report_title ?? 'FIELD SERVICE REPORT'

  const children: Paragraph[] = []

  children.push(new Paragraph({ text: org.name, heading: HeadingLevel.TITLE }))
  children.push(new Paragraph({ text: [org.address, org.phone ? `Tel: ${org.phone}` : null, org.email].filter(Boolean).join('  ·  '), spacing: { after: 200 } }))
  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 } }))
  children.push(new Paragraph({ text: `Call ID: ${ticket.ticket_no}`, alignment: AlignmentType.CENTER, spacing: { after: 200 } }))

  // ── Breakdown details table ──────────────────────────
  const rows = [
    ['Company', ticket.sites?.clients?.name ?? '—', 'Tech. Name', ticket.engineers?.users?.full_name ?? '—'],
    ['Site Name', ticket.sites?.name ?? '—', 'Response Date', fmt(ticket.created_at)],
    ['Reported By', ticket.reporter_name ?? '—', 'Response Time', fmtTime(ticket.created_at)],
    ['Priority', ticket.priority, 'Target Resolve', fmtTime(ticket.sla_resolve_due)],
    ['System', ticket.elv_systems?.type?.replace(/_/g, ' ') ?? '—', 'Labour Hrs', report?.labour_hrs != null ? `${report.labour_hrs} hrs` : '—'],
    ['Job Type', ticket.type.replace(/_/g, ' '), 'Travel Hrs', report?.travel_hrs != null ? `${report.travel_hrs} hrs` : '—'],
    ['On-Site Time', report?.onsite_time ?? '—', 'Off-Site Time', report?.offsite_time ?? '—'],
    ['Job Status', (report?.job_status ?? ticket.status).replace(/_/g, ' ').toUpperCase(), '', ''],
  ]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([lk, lv, rk, rv]) => new TableRow({
      children: [kvCell(lk, lv), kvCell(rk, rv)],
    })),
  })

  const docChildren: (Paragraph | Table)[] = [...children, table]

  docChildren.push(heading('Description of Problem'))
  docChildren.push(bodyText(ticket.description))

  if (ticket.devices) {
    docChildren.push(heading('Device'))
    docChildren.push(bodyText([
      ticket.devices.name, ticket.devices.tag_id ? `[${ticket.devices.tag_id}]` : null,
      ticket.devices.model, ticket.devices.location_desc,
      ticket.devices.floor != null ? `Level ${ticket.devices.floor}` : null,
    ].filter(Boolean).join('  ·  ')))
  }

  docChildren.push(heading(rs.section_labels?.inspection || 'Inspection / Observation'))
  docChildren.push(bodyText(report?.findings))

  docChildren.push(heading(rs.section_labels?.action_taken || 'Action Taken / Analysis'))
  docChildren.push(bodyText(report?.work_done))

  docChildren.push(heading(rs.section_labels?.root_cause || 'Root Cause Analysis'))
  docChildren.push(bodyText(report?.root_cause))

  if (rs.show_recommendations ?? true) {
    docChildren.push(heading(rs.section_labels?.recommendations || 'Offsite Repair Actions / Recommendations'))
    docChildren.push(bodyText(report?.recommendation))
  }

  // ── Extra fields (site-assigned) ─────────────────────
  const extraFields = getApplicableExtraFields(data)
  if (extraFields.length > 0) {
    docChildren.push(heading('Additional Information'))
    const cv = report?.custom_field_values ?? {}
    for (const f of extraFields) {
      const val = cv[f.id]
      if (f.field_type === 'signature' && val) {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: `${f.label}:`, bold: true })], spacing: { after: 80 } }))
        try {
          const buf = await dataUrlToBuffer(val)
          docChildren.push(new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: 150, height: 60 }, type: 'png' })] }))
        } catch { /* skip broken signature */ }
      } else {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: `${f.label}: `, bold: true }), new TextRun(val ?? '—')], spacing: { after: 100 } }))
      }
    }
  }

  if (rs.show_parts ?? true) {
    docChildren.push(heading(rs.section_labels?.parts || 'Details of Part(s) Replacement'))
    const parts = report?.parts_used?.length ? report.parts_used : []
    if (parts.length === 0) {
      docChildren.push(bodyText(null))
    } else {
      const partsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: ['Device / Part', 'Qty', 'Model', 'Serial No.', 'Remarks'].map(h =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) }),
          ...parts.map(p => new TableRow({
            children: [p.device, p.qty, p.model, p.serial_no, p.remarks].map(v =>
              new TableCell({ children: [new Paragraph(v || '—')] })),
          })),
        ],
      })
      docChildren.push(partsTable)
    }
  }

  docChildren.push(heading('Remarks'))
  docChildren.push(bodyText(report?.remarks))

  // ── Acknowledgement ───────────────────────────────────
  docChildren.push(heading(rs.section_labels?.ack || 'Acknowledgement'))
  const engName = report?.reported_by || ticket.engineers?.users?.full_name || ''
  const cliName = report?.client_name || ''
  docChildren.push(new Paragraph({
    children: [new TextRun({ text: `${rs.ack_labels?.engineer || 'Tech / Engineer'}: `, bold: true }), new TextRun(`${engName || '—'}   (${fmt(report?.reported_date ?? null)})`)],
    spacing: { after: 100 },
  }))
  docChildren.push(new Paragraph({
    children: [new TextRun({ text: `${rs.ack_labels?.client || 'Client Representative'}: `, bold: true }), new TextRun(`${cliName || '—'}   (${fmt(report?.client_date ?? null)})`)],
    spacing: { after: 200 },
  }))

  const doc = new Document({
    sections: [{ children: docChildren }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${ticket.ticket_no}-field-service-report.docx`)
}
