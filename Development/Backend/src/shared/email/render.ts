/** Turns a template (subject, heading, body, button) and values into the email. */

export interface TemplateContent {
  subject: string
  heading: string
  body: string
  buttonLabel: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g

const BRAND = '#FF6B5B'
const INK = '#1F2937'
const MUTED = '#6B7280'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Placeholder names used in a piece of text. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1])
}

/** Replaces `{{name}}` with its value; unknown names become empty. */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_m, name: string) => values[name] ?? '')
}

/** A paragraph that is only `{{code}}` is shown as a large code box. */
const isCodeOnly = (paragraph: string) => /^\{\{\s*code\s*\}\}$/.test(paragraph.trim())

function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function renderEmail(content: TemplateContent, values: Record<string, string>, buttonUrl: string | null): RenderedEmail {
  const subject = fill(content.subject, values).replace(/\s+/g, ' ').trim()
  const heading = fill(content.heading, values).trim()
  const blocks = paragraphs(content.body)
  const label = fill(content.buttonLabel, values).trim()
  const showButton = Boolean(label && buttonUrl)

  const htmlBlocks = blocks
    .map((p) => {
      if (isCodeOnly(p)) {
        return `<p style="margin:8px 0 20px;"><span style="display:inline-block;padding:12px 20px;border-radius:10px;background:#FFF1EF;color:${INK};font-size:28px;font-weight:700;letter-spacing:6px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(values.code ?? '')}</span></p>`
      }
      const html = escapeHtml(fill(p, values)).replace(/\n/g, '<br>')
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${html}</p>`
    })
    .join('\n')

  const button = showButton
    ? `<p style="margin:8px 0 8px;"><a href="${escapeHtml(buttonUrl as string)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${BRAND};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a></p>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F6F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F3;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;font-size:22px;font-weight:800;color:${INK};letter-spacing:-0.3px;"><span style="color:${BRAND};">&#10022;</span> GoMingle</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #ECEAE7;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(heading)}</h1>
${htmlBlocks}
${button}
</td></tr>
<tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.6;color:${MUTED};">GoMingle · Karachi, Pakistan<br>You are receiving this email because of your GoMingle account.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    heading,
    '',
    ...blocks.map((p) => (isCodeOnly(p) ? `    ${values.code ?? ''}` : fill(p, values))).flatMap((p) => [p, '']),
    showButton ? `${label}: ${buttonUrl}` : '',
    '',
    '— GoMingle',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { subject, html, text }
}
