export type TemplateAudience = 'partner' | 'admin'

export interface TemplatePlaceholder {
  name: string
  description: string
}

export interface EmailTemplate {
  key: string
  audience: TemplateAudience
  name: string
  description: string
  /** Account emails (codes) that can't be switched off. */
  required: boolean
  placeholders: TemplatePlaceholder[]
  hasButton: boolean
  subject: string
  heading: string
  body: string
  buttonLabel: string
  enabled: boolean
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export interface TemplateDraft {
  subject: string
  heading: string
  body: string
  buttonLabel: string
}

export interface UpdateTemplatePayload extends Partial<TemplateDraft> {
  enabled?: boolean
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export type EmailLogStatus = 'SENT' | 'FAILED' | 'LOGGED' | 'SKIPPED'

export interface EmailLogEntry {
  id: number
  templateKey: string
  templateName: string
  to: string
  subject: string
  status: EmailLogStatus
  error: string | null
  createdAt: string
}

export interface TestSendResult {
  to: string
  status: EmailLogStatus
}
