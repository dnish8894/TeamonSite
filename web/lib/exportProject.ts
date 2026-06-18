/**
 * Shared PDF + Excel export helpers for project forms.
 * Each function takes the form data and generates / downloads the file.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ── Colours ─────────────────────────────────────────────────────────────────
const ORANGE: [number, number, number] = [249, 115, 22]
const DARK:   [number, number, number] = [28,  25,  23]
const GREY:   [number, number, number] = [120, 113, 108]
const WHITE:  [number, number, number] = [255, 255, 255]

// ── Shared header ────────────────────────────────────────────────────────────
function addHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...ORANGE)
  doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...WHITE)
  doc.text(title, 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(255, 220, 180)
  doc.text(subtitle, 14, 19)
  doc.setTextColor(...DARK)
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ORANGE)
  doc.text(text.toUpperCase(), 14, y)
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.4)
  doc.line(14, y + 1.5, doc.internal.pageSize.width - 14, y + 1.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  return y + 7
}

function kv(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  doc.text(label, 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  const lines = doc.splitTextToSize(value || '—', 160)
  doc.text(lines, 55, y)
  return y + lines.length * 5 + 1
}

function addSignatureRow(
  doc: jsPDF, y: number,
  eng: { name: string; date: string; sig: string },
  cli: { name: string; date: string; sig: string },
  engLabel: string, cliLabel: string
): number {
  const mid = doc.internal.pageSize.width / 2

  // Left block
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
  doc.text(engLabel, 14, y)
  if (eng.sig) {
    try { doc.addImage(eng.sig, 'PNG', 14, y + 2, 70, 20) } catch {}
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK)
  doc.text(eng.name || '—', 14, y + 26)
  doc.text(eng.date || '—', 14, y + 31)

  // Right block
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY)
  doc.text(cliLabel, mid + 5, y)
  if (cli.sig) {
    try { doc.addImage(cli.sig, 'PNG', mid + 5, y + 2, 70, 20) } catch {}
  }
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
  doc.text(cli.name || '—', mid + 5, y + 26)
  doc.text(cli.date || '—', mid + 5, y + 31)

  return y + 38
}

// ════════════════════════════════════════════════════════════════════════════
// 1.  TNC — PDF
// ════════════════════════════════════════════════════════════════════════════
export interface TncForm {
  scope_items: string[]
  exclusions: string[]
  warranty_months: string
  defect_liability_months: string
  payment_terms: string
  special_conditions: string
  prepared_by: string; prepared_date: string
  client_name: string; client_date: string
  engineer_signature: string; client_signature: string
}

export function exportTncPdf(form: TncForm, projectName = 'Project') {
  const doc = new jsPDF()
  addHeader(doc, 'Terms & Conditions / Scope of Work', projectName)
  let y = 30

  // Scope of work
  y = sectionTitle(doc, y, 'Scope of Work')
  if (form.scope_items.length === 0) {
    doc.text('No scope items defined.', 14, y); y += 7
  } else {
    form.scope_items.forEach((item, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${item}`, 180)
      doc.text(lines, 14, y)
      y += lines.length * 5 + 1
      if (y > 265) { doc.addPage(); y = 20 }
    })
  }
  y += 4

  // Exclusions
  y = sectionTitle(doc, y, 'Exclusions')
  if (form.exclusions.length === 0) {
    doc.text('No exclusions defined.', 14, y); y += 7
  } else {
    form.exclusions.forEach((item, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${item}`, 180)
      doc.text(lines, 14, y)
      y += lines.length * 5 + 1
      if (y > 265) { doc.addPage(); y = 20 }
    })
  }
  y += 4

  // Contract terms
  y = sectionTitle(doc, y, 'Contract Terms')
  y = kv(doc, y, 'Warranty Period:', `${form.warranty_months} months`)
  y = kv(doc, y, 'DLP:', `${form.defect_liability_months} months`)
  if (form.payment_terms) y = kv(doc, y, 'Payment Terms:', form.payment_terms)
  if (form.special_conditions) y = kv(doc, y, 'Special Conditions:', form.special_conditions)
  y += 4

  // Signatures
  if (y > 210) { doc.addPage(); y = 20 }
  y = sectionTitle(doc, y, 'Acknowledgement & Acceptance')
  addSignatureRow(doc, y,
    { name: form.prepared_by, date: form.prepared_date, sig: form.engineer_signature },
    { name: form.client_name, date: form.client_date, sig: form.client_signature },
    'Prepared By (Engineer)', 'Client Representative'
  )

  doc.save(`TNC_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
}

// TNC — Excel
export function exportTncExcel(form: TncForm, projectName = 'Project') {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Scope
  const scopeData = [
    ['#', 'Scope Item'],
    ...form.scope_items.map((item, i) => [i + 1, item]),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(scopeData)
  ws1['!cols'] = [{ wch: 5 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Scope of Work')

  // Sheet 2: Exclusions
  const exclData = [
    ['#', 'Exclusion'],
    ...form.exclusions.map((item, i) => [i + 1, item]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(exclData)
  ws2['!cols'] = [{ wch: 5 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Exclusions')

  // Sheet 3: Terms
  const termsData = [
    ['Field', 'Value'],
    ['Project', projectName],
    ['Warranty Period', `${form.warranty_months} months`],
    ['DLP', `${form.defect_liability_months} months`],
    ['Payment Terms', form.payment_terms],
    ['Special Conditions', form.special_conditions],
    ['Prepared By', form.prepared_by],
    ['Prepared Date', form.prepared_date],
    ['Client Name', form.client_name],
    ['Client Date', form.client_date],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(termsData)
  ws3['!cols'] = [{ wch: 22 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Contract Terms')

  XLSX.writeFile(wb, `TNC_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ════════════════════════════════════════════════════════════════════════════
// 2.  SITE SURVEY — PDF
// ════════════════════════════════════════════════════════════════════════════
export interface SurveyArea { name: string; floor: string; notes: string }
export interface SurveyForm {
  surveyed_by: string; survey_date: string
  building_type: string; total_floors: string; total_area_sqft: string
  access_notes: string; power_supply: string; power_notes: string
  network_available: string; network_notes: string; cable_route_notes: string
  systems_scope: string[]; areas: SurveyArea[]; remarks: string
  prepared_by: string; prepared_date: string
  client_name: string; client_date: string
  engineer_signature: string; client_signature: string
}

const SYS_LABELS: Record<string,string> = {
  cctv: 'CCTV', access_control: 'Access Control', structured_cabling: 'Structured Cabling',
  av: 'Audio Visual', pa: 'Public Address', bms: 'BMS',
}

export function exportSurveyPdf(form: SurveyForm, projectName = 'Project') {
  const doc = new jsPDF()
  addHeader(doc, 'Site Survey Report', projectName)
  let y = 30

  // Building info
  y = sectionTitle(doc, y, 'Building Information')
  y = kv(doc, y, 'Surveyed By:', form.surveyed_by)
  y = kv(doc, y, 'Survey Date:', form.survey_date)
  y = kv(doc, y, 'Building Type:', form.building_type)
  y = kv(doc, y, 'Total Floors:', form.total_floors)
  y = kv(doc, y, 'Total Area:', form.total_area_sqft ? `${form.total_area_sqft} sqft` : '—')
  y += 3

  // Site conditions
  y = sectionTitle(doc, y, 'Site Conditions')
  y = kv(doc, y, 'Access Notes:', form.access_notes)
  y = kv(doc, y, 'Power Supply:', form.power_supply)
  if (form.power_notes) y = kv(doc, y, 'Power Notes:', form.power_notes)
  y = kv(doc, y, 'Network Available:', form.network_available === 'true' ? 'Yes' : 'No')
  if (form.network_notes) y = kv(doc, y, 'Network Notes:', form.network_notes)
  if (form.cable_route_notes) y = kv(doc, y, 'Cable Route:', form.cable_route_notes)
  y += 3

  // Systems scope
  y = sectionTitle(doc, y, 'Systems in Scope')
  const sysText = form.systems_scope.map(s => SYS_LABELS[s] ?? s).join(', ') || 'None selected'
  const sysLines = doc.splitTextToSize(sysText, 180)
  doc.text(sysLines, 14, y); y += sysLines.length * 5 + 5

  // Survey areas
  if (form.areas.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    y = sectionTitle(doc, y, 'Survey Areas')
    autoTable(doc, {
      startY: y,
      head: [['Area / Location', 'Floor', 'Notes']],
      body: form.areas.map(a => [a.name, a.floor, a.notes]),
      headStyles: { fillColor: ORANGE, textColor: WHITE },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 20 }, 2: { cellWidth: 100 } },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Remarks
  if (form.remarks) {
    if (y > 220) { doc.addPage(); y = 20 }
    y = sectionTitle(doc, y, 'Remarks')
    const lines = doc.splitTextToSize(form.remarks, 180)
    doc.text(lines, 14, y); y += lines.length * 5 + 5
  }

  // Signatures
  if (y > 200) { doc.addPage(); y = 20 }
  y = sectionTitle(doc, y, 'Acknowledgement')
  addSignatureRow(doc, y,
    { name: form.prepared_by, date: form.prepared_date, sig: form.engineer_signature },
    { name: form.client_name, date: form.client_date, sig: form.client_signature },
    'Surveyed By (Engineer)', 'Client Representative'
  )

  doc.save(`SiteSurvey_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
}

// Site Survey — Excel
export function exportSurveyExcel(form: SurveyForm, projectName = 'Project') {
  const wb = XLSX.utils.book_new()

  const info = [
    ['Field', 'Value'],
    ['Project', projectName],
    ['Surveyed By', form.surveyed_by],
    ['Survey Date', form.survey_date],
    ['Building Type', form.building_type],
    ['Total Floors', form.total_floors],
    ['Total Area (sqft)', form.total_area_sqft],
    ['Access Notes', form.access_notes],
    ['Power Supply', form.power_supply],
    ['Power Notes', form.power_notes],
    ['Network Available', form.network_available === 'true' ? 'Yes' : 'No'],
    ['Network Notes', form.network_notes],
    ['Cable Route Notes', form.cable_route_notes],
    ['Systems in Scope', form.systems_scope.map(s => SYS_LABELS[s] ?? s).join(', ')],
    ['Remarks', form.remarks],
    ['Prepared By', form.prepared_by],
    ['Prepared Date', form.prepared_date],
    ['Client Name', form.client_name],
    ['Client Date', form.client_date],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(info)
  ws1['!cols'] = [{ wch: 24 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Survey Info')

  if (form.areas.length > 0) {
    const areaData = [
      ['Area / Location', 'Floor', 'Notes'],
      ...form.areas.map(a => [a.name, a.floor, a.notes]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(areaData)
    ws2['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Survey Areas')
  }

  XLSX.writeFile(wb, `SiteSurvey_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ════════════════════════════════════════════════════════════════════════════
// 3.  UAT — PDF
// ════════════════════════════════════════════════════════════════════════════
export interface TestItem { system: string; description: string; result: string; notes: string }
export interface UatForm {
  tested_by: string; test_date: string
  test_items: TestItem[]
  overall_result: string; remarks: string
  prepared_by: string; prepared_date: string
  client_name: string; client_date: string
  engineer_signature: string; client_signature: string
}

const RESULT_COLOR: Record<string, [number,number,number]> = {
  pass:    [22,  163, 74],
  fail:    [220, 38,  38],
  na:      [120, 113, 108],
  pending: [217, 119, 6],
}

export function exportUatPdf(form: UatForm, projectName = 'Project') {
  const doc = new jsPDF({ orientation: 'landscape' })
  addHeader(doc, 'User Acceptance Test (UAT) Report', projectName)
  let y = 30

  // Summary
  y = sectionTitle(doc, y, 'Test Summary')
  const pass = form.test_items.filter(i => i.result === 'pass').length
  const fail = form.test_items.filter(i => i.result === 'fail').length
  const total = form.test_items.length
  y = kv(doc, y, 'Tested By:', form.tested_by)
  y = kv(doc, y, 'Test Date:', form.test_date)
  y = kv(doc, y, 'Overall Result:', form.overall_result.toUpperCase())
  y = kv(doc, y, 'Score:', `${pass} / ${total} passed  |  ${fail} failed`)
  if (form.remarks) y = kv(doc, y, 'Remarks:', form.remarks)
  y += 4

  // Test items table
  if (form.test_items.length > 0) {
    y = sectionTitle(doc, y, 'Test Items')
    autoTable(doc, {
      startY: y,
      head: [['#', 'System', 'Test Description', 'Result', 'Notes']],
      body: form.test_items.map((item, i) => [
        i + 1,
        (SYS_LABELS[item.system] ?? item.system).toUpperCase(),
        item.description,
        item.result.toUpperCase(),
        item.notes || '—',
      ]),
      headStyles: { fillColor: ORANGE, textColor: WHITE },
      styles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 30 },
        2: { cellWidth: 120 },
        3: { cellWidth: 20 },
        4: { cellWidth: 80 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const c = RESULT_COLOR[String(data.cell.raw).toLowerCase()]
          if (c) { data.cell.styles.textColor = c; data.cell.styles.fontStyle = 'bold' }
        }
      },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Signatures
  if (y > 150) { doc.addPage(); y = 20 }
  y = sectionTitle(doc, y, 'Acknowledgement')
  addSignatureRow(doc, y,
    { name: form.prepared_by, date: form.prepared_date, sig: form.engineer_signature },
    { name: form.client_name, date: form.client_date, sig: form.client_signature },
    'Tested By (Engineer)', 'Client Representative'
  )

  doc.save(`UAT_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
}

// UAT — Excel
export function exportUatExcel(form: UatForm, projectName = 'Project') {
  const wb = XLSX.utils.book_new()

  // Summary sheet
  const summary = [
    ['Field', 'Value'],
    ['Project', projectName],
    ['Tested By', form.tested_by],
    ['Test Date', form.test_date],
    ['Overall Result', form.overall_result],
    ['Passed', form.test_items.filter(i => i.result === 'pass').length],
    ['Failed', form.test_items.filter(i => i.result === 'fail').length],
    ['Total Items', form.test_items.length],
    ['Remarks', form.remarks],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  ws1['!cols'] = [{ wch: 20 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Test items sheet
  const testData = [
    ['#', 'System', 'Test Description', 'Result', 'Notes'],
    ...form.test_items.map((item, i) => [
      i + 1,
      SYS_LABELS[item.system] ?? item.system,
      item.description,
      item.result.toUpperCase(),
      item.notes,
    ]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(testData)
  ws2['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 65 }, { wch: 12 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Test Items')

  XLSX.writeFile(wb, `UAT_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ════════════════════════════════════════════════════════════════════════════
// 4.  MEETING MINUTES — PDF
// ════════════════════════════════════════════════════════════════════════════
export interface MinuteRecord {
  title: string; meeting_date: string; location: string | null
  attendees: string | null; agenda: string | null
  minutes: string | null; action_items: string | null
  next_meeting_date: string | null; recurrence: string; prepared_by: string | null
}

export function exportMinutesPdf(records: MinuteRecord[], projectName = 'Project') {
  const doc = new jsPDF()
  addHeader(doc, 'Meeting Minutes', projectName)
  let y = 30

  if (records.length === 0) {
    doc.text('No meeting minutes recorded.', 14, y)
    doc.save(`Minutes_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
    return
  }

  records.forEach((r, idx) => {
    if (idx > 0) { doc.addPage(); y = 20 }

    y = sectionTitle(doc, y, `${idx + 1}. ${r.title}`)
    y = kv(doc, y, 'Date:', r.meeting_date)
    if (r.location)    y = kv(doc, y, 'Location:', r.location)
    if (r.prepared_by) y = kv(doc, y, 'Prepared By:', r.prepared_by)
    y = kv(doc, y, 'Recurrence:', r.recurrence === 'none' ? 'One-off' : r.recurrence)
    if (r.next_meeting_date) y = kv(doc, y, 'Next Meeting:', r.next_meeting_date)
    y += 2

    if (r.attendees) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
      doc.text('Attendees:', 14, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      const lines = doc.splitTextToSize(r.attendees, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 3
    }

    if (r.agenda) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
      doc.text('Agenda:', 14, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      const lines = doc.splitTextToSize(r.agenda, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 3
      if (y > 250) { doc.addPage(); y = 20 }
    }

    if (r.minutes) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
      doc.text('Minutes / Discussion:', 14, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      const lines = doc.splitTextToSize(r.minutes, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 3
      if (y > 250) { doc.addPage(); y = 20 }
    }

    if (r.action_items) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
      doc.text('Action Items:', 14, y); y += 4
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      const lines = doc.splitTextToSize(r.action_items, 180)
      doc.text(lines, 14, y); y += lines.length * 5 + 3
    }
  })

  doc.save(`Minutes_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
}

// Meeting Minutes — Excel
export function exportMinutesExcel(records: MinuteRecord[], projectName = 'Project') {
  const wb = XLSX.utils.book_new()

  // Summary sheet
  const summaryData = [
    ['#', 'Title', 'Date', 'Location', 'Recurrence', 'Prepared By', 'Next Meeting'],
    ...records.map((r, i) => [
      i + 1, r.title, r.meeting_date, r.location ?? '',
      r.recurrence === 'none' ? 'One-off' : r.recurrence,
      r.prepared_by ?? '', r.next_meeting_date ?? '',
    ]),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  ws1['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 14 }, { wch: 25 }, { wch: 14 }, { wch: 20 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Detail sheet
  const detailData: (string | number)[][] = [
    ['Title', 'Date', 'Location', 'Prepared By', 'Recurrence', 'Attendees', 'Agenda', 'Minutes', 'Action Items', 'Next Meeting'],
  ]
  records.forEach(r => {
    detailData.push([
      r.title, r.meeting_date, r.location ?? '',
      r.prepared_by ?? '',
      r.recurrence === 'none' ? 'One-off' : r.recurrence,
      r.attendees ?? '', r.agenda ?? '', r.minutes ?? '',
      r.action_items ?? '', r.next_meeting_date ?? '',
    ])
  })
  const ws2 = XLSX.utils.aoa_to_sheet(detailData)
  ws2['!cols'] = [30, 14, 25, 20, 14, 40, 50, 60, 50, 14].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws2, 'Full Details')

  XLSX.writeFile(wb, `Minutes_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
}
