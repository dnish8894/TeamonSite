import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmailSafe } from '@/lib/email'

let cachedOrgName: string | null = null
async function orgName(): Promise<string> {
  if (cachedOrgName) return cachedOrgName
  const { data } = await supabaseAdmin.from('organisations').select('name').limit(1).single()
  const name = data?.name ?? 'Our team'
  cachedOrgName = name
  return name
}

function shell(title: string, body: string, org: string) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1c1917;max-width:560px">
      <div style="background:#1c1917;color:#fff;padding:14px 18px;border-radius:6px 6px 0 0">
        <strong style="font-size:15px">${org}</strong>
      </div>
      <div style="border:1px solid #e7e5e4;border-top:none;padding:18px;border-radius:0 0 6px 6px">
        <h2 style="font-size:16px;margin:0 0 10px">${title}</h2>
        ${body}
        <p style="color:#78716c;font-size:12px;margin-top:18px">This is an automated message from ${org}.</p>
      </div>
    </div>`
}

/** Confirmation to the client when they submit a fault report. */
export async function emailClientSubmission(to: string, ticketNo: string, summary: string, site?: string) {
  if (!to) return
  const org = await orgName()
  await sendEmailSafe({
    to,
    subject: `Fault Report Received — ${ticketNo}`,
    html: shell("We've received your report", `
      <p>Thank you — your fault report has been logged.</p>
      <p><strong>Reference:</strong> ${ticketNo}</p>
      ${site ? `<p><strong>Site:</strong> ${site}</p>` : ''}
      <p><strong>Reported issue:</strong> ${summary}</p>
      <p>Our team will review and respond shortly.</p>`, org),
  })
}

/** Notify the client when an engineer is assigned. */
export async function emailClientAssigned(to: string, ticketNo: string, engineer: string, site?: string) {
  if (!to) return
  const org = await orgName()
  await sendEmailSafe({
    to,
    subject: `Technician Assigned — ${ticketNo}`,
    html: shell('A technician has been assigned', `
      <p>Good news — a technician has been assigned to your case.</p>
      <p><strong>Reference:</strong> ${ticketNo}</p>
      ${engineer ? `<p><strong>Technician:</strong> ${engineer}</p>` : ''}
      ${site ? `<p><strong>Site:</strong> ${site}</p>` : ''}
      <p>They will be in touch / attend site shortly.</p>`, org),
  })
}

/** Notify the client when the job is completed / technician has left site. */
export async function emailClientCompleted(to: string, ticketNo: string, site?: string) {
  if (!to) return
  const org = await orgName()
  await sendEmailSafe({
    to,
    subject: `Job Completed — ${ticketNo}`,
    html: shell('Your job has been completed', `
      <p>The work on your case has been completed and our technician has left site.</p>
      <p><strong>Reference:</strong> ${ticketNo}</p>
      ${site ? `<p><strong>Site:</strong> ${site}</p>` : ''}
      <p>If the issue persists, simply reply to this email or scan the QR again to reopen.</p>`, org),
  })
}
