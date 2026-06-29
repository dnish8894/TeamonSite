import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { SETTINGS_ROLES } from '@/lib/permissions'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !SETTINGS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission.' }, { status: 403 })
  }
  const body = await req.json()
  const to = (body.to as string)?.trim()
  if (!to) return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 })

  try {
    // Uses the saved org SMTP config (or env / Mailpit fallback).
    await sendEmail({
      to,
      subject: 'TeamOnSite — Test Email',
      html: '<p>✅ Your email settings are working. This is a test message from TeamOnSite.</p>',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Send failed.' }, { status: 500 })
  }
}
