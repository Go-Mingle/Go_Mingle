import nodemailer from 'nodemailer'
import { config } from '../../config'
import type { RenderedEmail } from './render'

export type ProviderName = 'mailtrap' | 'mailtrap-sandbox' | 'smtp' | 'log'

export interface Delivery {
  status: 'SENT' | 'FAILED' | 'LOGGED'
  provider: ProviderName
  messageId?: string
  error?: string
}

export interface Recipient {
  email: string
  name?: string | null
}

/** Which provider the current settings select. */
export function activeProvider(): ProviderName {
  if (config.mail.mailtrapToken) return config.mail.mailtrapInboxId ? 'mailtrap-sandbox' : 'mailtrap'
  if (config.mail.smtpHost) return 'smtp'
  return 'log'
}

export const mailConfigured = () => activeProvider() !== 'log'

/** Test hook: every send in this process is captured here instead of delivered. */
export const outbox: { to: string; email: RenderedEmail; category: string }[] = []

let smtp: nodemailer.Transporter | null = null

async function viaMailtrap(to: Recipient, email: RenderedEmail, category: string, sandbox: boolean): Promise<Delivery> {
  const provider: ProviderName = sandbox ? 'mailtrap-sandbox' : 'mailtrap'
  const url = sandbox
    ? `https://sandbox.api.mailtrap.io/api/send/${encodeURIComponent(config.mail.mailtrapInboxId)}`
    : 'https://send.api.mailtrap.io/api/send'
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.mail.mailtrapToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { email: config.mail.fromEmail, name: config.mail.fromName },
      to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
      subject: email.subject,
      html: email.html,
      text: email.text,
      category,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; message_ids?: string[]; errors?: string[] }
  if (!res.ok || data.success === false) {
    return { status: 'FAILED', provider, error: (data.errors ?? [`HTTP ${res.status}`]).join('; ').slice(0, 500) }
  }
  return { status: 'SENT', provider, messageId: data.message_ids?.[0] }
}

async function viaSmtp(to: Recipient, email: RenderedEmail): Promise<Delivery> {
  smtp ??= nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: config.mail.smtpPort === 465,
    auth: config.mail.smtpUser ? { user: config.mail.smtpUser, pass: config.mail.smtpPass } : undefined,
    connectionTimeout: 10_000,
  })
  const info = await smtp.sendMail({
    from: { name: config.mail.fromName, address: config.mail.fromEmail },
    to: to.name ? { name: to.name, address: to.email } : to.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return { status: 'SENT', provider: 'smtp', messageId: info.messageId }
}

/** Sends one email. Never throws: a failure comes back as status FAILED. */
export async function deliver(to: Recipient, email: RenderedEmail, category: string): Promise<Delivery> {
  const provider = activeProvider()
  if (process.env.NODE_ENV === 'test') {
    outbox.push({ to: to.email, email, category })
    return { status: provider === 'log' ? 'LOGGED' : 'SENT', provider }
  }
  try {
    if (provider === 'mailtrap' || provider === 'mailtrap-sandbox') return await viaMailtrap(to, email, category, provider === 'mailtrap-sandbox')
    if (provider === 'smtp') return await viaSmtp(to, email)
    console.log(`[mail] (not sent, no provider configured) to ${to.email}: ${email.subject}\n${email.text}`)
    return { status: 'LOGGED', provider }
  } catch (err) {
    return { status: 'FAILED', provider, error: (err instanceof Error ? err.message : String(err)).slice(0, 500) }
  }
}
