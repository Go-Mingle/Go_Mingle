import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { emailTemplatesService } from '../services'
import type { EmailTemplate, TemplateDraft, UpdateTemplatePayload } from '../types'

export const EMAIL_TEMPLATES_QUERY_KEY = ['email-templates'] as const
export const EMAIL_LOG_QUERY_KEY = ['email-templates', 'log'] as const

export function useEmailTemplatesQuery() {
  return useQuery({
    queryKey: EMAIL_TEMPLATES_QUERY_KEY,
    queryFn: () => emailTemplatesService.list(),
  })
}

export function useEmailLogQuery(enabled: boolean) {
  return useQuery({
    queryKey: EMAIL_LOG_QUERY_KEY,
    queryFn: () => emailTemplatesService.log(),
    enabled,
  })
}

/** Writes a saved template into the list cache so every view updates at once. */
function useStoreTemplate() {
  const qc = useQueryClient()
  return (saved: EmailTemplate) => {
    qc.setQueryData<EmailTemplate[]>(EMAIL_TEMPLATES_QUERY_KEY, (prev) =>
      prev ? prev.map((t) => (t.key === saved.key ? saved : t)) : prev,
    )
    void qc.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY, exact: true })
  }
}

export function useUpdateEmailTemplateMutation() {
  const store = useStoreTemplate()
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateTemplatePayload }) =>
      emailTemplatesService.update(key, data),
    onSuccess: store,
  })
}

export function useRestoreEmailTemplateMutation() {
  const store = useStoreTemplate()
  return useMutation({
    mutationFn: (key: string) => emailTemplatesService.restore(key),
    onSuccess: store,
  })
}

export function usePreviewEmailTemplateMutation() {
  return useMutation({
    mutationFn: ({ key, draft }: { key: string; draft: TemplateDraft }) =>
      emailTemplatesService.preview(key, draft),
  })
}

export function useSendTestEmailMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, draft }: { key: string; draft: TemplateDraft }) =>
      emailTemplatesService.sendTest(key, draft),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: EMAIL_LOG_QUERY_KEY })
    },
  })
}
