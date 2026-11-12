import { useCallback, useMemo, useState } from 'react'
import { Alert, Tabs, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { LoadingState } from '../../molecules/LoadingState'
import { PageHeader } from '../../molecules/PageHeader'
import { EmailLogTable } from './components/EmailLogTable'
import { TemplateCard } from './components/TemplateCard'
import { TemplateEditorDrawer } from './components/TemplateEditorDrawer'
import {
  useEmailLogQuery,
  useEmailTemplatesQuery,
  usePreviewEmailTemplateMutation,
  useRestoreEmailTemplateMutation,
  useSendTestEmailMutation,
  useUpdateEmailTemplateMutation,
} from './hooks/useEmailTemplatesQuery'
import type { EmailTemplate, TemplateAudience, TemplateDraft } from './types'

type TabKey = 'templates' | 'recent'
type FieldErrors = Partial<Record<keyof TemplateDraft, string>>

const AUDIENCES: TemplateAudience[] = ['partner', 'admin']

/** Field messages from a 422 (`details.fields`), if the error carries them. */
function fieldErrorsOf(error: unknown): FieldErrors {
  if (!(error instanceof HttpError)) return {}
  const body = error.responseBody as { error?: { details?: { fields?: FieldErrors } } } | null
  return body?.error?.details?.fields ?? {}
}

export function EmailTemplatesPage() {
  const { t } = useTranslation(['email-templates', 'common'])
  const [messageApi, contextHolder] = message.useMessage()
  const [tab, setTab] = useState<TabKey>('templates')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const { data: templates = [], isPending, isError } = useEmailTemplatesQuery()
  const log = useEmailLogQuery(tab === 'recent')
  const updateMutation = useUpdateEmailTemplateMutation()
  const restoreMutation = useRestoreEmailTemplateMutation()
  const previewMutation = usePreviewEmailTemplateMutation()
  const testMutation = useSendTestEmailMutation()

  const editing = useMemo(
    () => templates.find((tpl) => tpl.key === editingKey) ?? null,
    [templates, editingKey],
  )
  const { mutateAsync: previewAsync } = previewMutation

  const fail = (error: unknown) =>
    void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))

  const handleToggle = (template: EmailTemplate, enabled: boolean) => {
    setTogglingKey(template.key)
    updateMutation.mutate(
      { key: template.key, data: { enabled } },
      {
        onSuccess: () =>
          void messageApi.success(
            t(enabled ? 'messages.enabled' : 'messages.disabled', { name: template.name }),
          ),
        onError: fail,
        onSettled: () => setTogglingKey(null),
      },
    )
  }

  const openEditor = (template: EmailTemplate) => {
    setFieldErrors({})
    setEditingKey(template.key)
  }

  const closeEditor = () => {
    setFieldErrors({})
    setEditingKey(null)
  }

  const handleSave = (draft: TemplateDraft) => {
    if (!editing) return
    updateMutation.mutate(
      { key: editing.key, data: draft },
      {
        onSuccess: () => {
          void messageApi.success(t('messages.saved'))
          closeEditor()
        },
        onError: (error) => {
          setFieldErrors(fieldErrorsOf(error))
          fail(error)
        },
      },
    )
  }

  const handleRestore = () => {
    if (!editing) return
    restoreMutation.mutate(editing.key, {
      onSuccess: () => {
        setFieldErrors({})
        void messageApi.success(t('messages.restored'))
      },
      onError: fail,
    })
  }

  const handleSendTest = (draft: TemplateDraft) => {
    if (!editing) return
    testMutation.mutate(
      { key: editing.key, draft },
      {
        onSuccess: (result) => {
          setFieldErrors({})
          void messageApi.success(t('messages.testSent', { email: result.to }))
        },
        onError: (error) => {
          setFieldErrors(fieldErrorsOf(error))
          fail(error)
        },
      },
    )
  }

  const handlePreview = useCallback(
    (draft: TemplateDraft) =>
      editingKey ? previewAsync({ key: editingKey, draft }) : Promise.reject(new Error('closed')),
    [editingKey, previewAsync],
  )

  if (isPending) return <LoadingState />
  if (isError) return <Alert type="error" message={t('messages.loadError')} className="m-4" />

  const templatesTab = (
    <div className="flex flex-col gap-8">
      {AUDIENCES.map((audience) => {
        const group = templates.filter((tpl) => tpl.audience === audience)
        if (group.length === 0) return null
        return (
          <section
            key={audience}
            aria-labelledby={`group-${audience}`}
            className="flex flex-col gap-3"
          >
            <div>
              <h2
                id={`group-${audience}`}
                className="m-0 text-[16px] font-bold text-(--color-text) [font-family:var(--font-display)]"
              >
                {t(`groups.${audience}`)}
              </h2>
              <p className="m-0 mt-0.5 text-[13px] text-(--color-text-muted)">
                {t(`groups.${audience}Hint`)}
              </p>
            </div>
            {group.map((template) => (
              <TemplateCard
                key={template.key}
                template={template}
                toggling={togglingKey === template.key}
                onToggle={handleToggle}
                onEdit={openEditor}
              />
            ))}
          </section>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col">
      {contextHolder}
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={[
          { key: 'templates', label: t('tabs.templates'), children: templatesTab },
          {
            key: 'recent',
            label: t('tabs.recent'),
            children: (
              <EmailLogTable
                entries={log.data ?? []}
                loading={log.isPending && log.fetchStatus !== 'idle'}
                error={log.isError}
              />
            ),
          },
        ]}
      />
      <TemplateEditorDrawer
        template={editing}
        saving={updateMutation.isPending && togglingKey === null}
        restoring={restoreMutation.isPending}
        testing={testMutation.isPending}
        fieldErrors={fieldErrors}
        onClose={closeEditor}
        onSave={handleSave}
        onRestore={handleRestore}
        onSendTest={handleSendTest}
        onPreview={handlePreview}
      />
    </div>
  )
}
