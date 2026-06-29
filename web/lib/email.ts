import nodemailer from 'nodemailer'
import { supabaseAdmin } from './supabase-admin'

export interface SmtpConfig {
  host: string; port: number; secure: boolean
  user?: string | null; pass?: string | null; from: string
}

// Resolve SMTP config: org Settings first, then env vars, then local Mailpit.
async function resolveConfig(): Promise<SmtpConfig> {
  let org: Record<string, unknown> | null = null
  try {
    const { data } = await supabaseAdmin
      .from('organisations')
      .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from')
      .limit(1).single()
    org = data
  } catch { /* fall back to env */ }

  const host = (org?.smtp_host as string) || process.env.SMTP_HOST || '127.0.0.1'
  const port = Number(org?.smtp_port || process.env.SMTP_PORT || 54325)
  const secure = (org?.smtp_secure as boolean) ?? (process.env.SMTP_SECURE === 'true')
  const user = (org?.smtp_user as string) || process.env.SMTP_USER || null
  const pass = (org?.smtp_pass as string) || process.env.SMTP_PASS || null
  const from = (org?.smtp_from as string) || process.env.SMTP_FROM || 'noreply@teamonsite.local'
  return { host, port, secure, user, pass, from }
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload, cfgOverride?: SmtpConfig) {
  if (!payload.to || (Array.isArray(payload.to) && payload.to.length === 0)) return
  const cfg = cfgOverride ?? await resolveConfig()
  const transport = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? undefined } : undefined,
  })
  await transport.sendMail({ from: cfg.from, to: payload.to, subject: payload.subject, html: payload.html })
}

// Like sendEmail but never throws — for best-effort notification sends.
export async function sendEmailSafe(payload: EmailPayload) {
  try { await sendEmail(payload) }
  catch (err) { console.error('sendEmail failed:', err) }
}
