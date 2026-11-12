import { httpClient } from '../../../shared/api/httpClient'
import { EMAIL_TEMPLATE_ENDPOINTS } from './constants'
import type {
  EmailLogEntry,
  EmailTemplate,
  RenderedEmail,
  TemplateDraft,
  TestSendResult,
  UpdateTemplatePayload,
} from './types'

export const emailTemplatesService = {
  list: (): Promise<EmailTemplate[]> => httpClient.get(EMAIL_TEMPLATE_ENDPOINTS.list),

  log: (): Promise<EmailLogEntry[]> => httpClient.get(EMAIL_TEMPLATE_ENDPOINTS.log),

  update: (key: string, data: UpdateTemplatePayload): Promise<EmailTemplate> =>
    httpClient.patch(EMAIL_TEMPLATE_ENDPOINTS.one(key), data),

  preview: (key: string, draft: TemplateDraft): Promise<RenderedEmail> =>
    httpClient.post(EMAIL_TEMPLATE_ENDPOINTS.preview(key), draft),

  sendTest: (key: string, draft: TemplateDraft): Promise<TestSendResult> =>
    httpClient.post(EMAIL_TEMPLATE_ENDPOINTS.test(key), draft),

  restore: (key: string): Promise<EmailTemplate> =>
    httpClient.post(EMAIL_TEMPLATE_ENDPOINTS.reset(key), {}),
}
