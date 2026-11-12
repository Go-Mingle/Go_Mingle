import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, Input, Modal, Popconfirm, Tooltip } from 'antd'
import type { InputRef } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { ArrowCounterClockwise, PaperPlaneTilt } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { PREVIEW_DEBOUNCE_MS } from '../constants'
import type { EmailTemplate, RenderedEmail, TemplateDraft } from '../types'
import { EmailPreview } from './EmailPreview'

type Field = keyof TemplateDraft

interface TemplateEditorDrawerProps {
  template: EmailTemplate | null
  saving: boolean
  restoring: boolean
  testing: boolean
  /** Field messages from the last failed save, keyed by field. */
  fieldErrors: Partial<Record<Field, string>>
  onClose: () => void
  onSave: (draft: TemplateDraft) => void
  onRestore: () => void
  onSendTest: (draft: TemplateDraft) => void
  onPreview: (draft: TemplateDraft) => Promise<RenderedEmail>
}

const draftOf = (t: EmailTemplate): TemplateDraft => ({
  subject: t.subject,
  heading: t.heading,
  body: t.body,
  buttonLabel: t.buttonLabel,
})

const LABEL_CLS =
  'mb-1.5 block text-[13px] font-semibold text-(--color-text) [font-family:var(--font-ui)]'
const HINT_CLS = 'm-0 mt-1 text-[12px] text-(--color-text-subtle)'
const ERROR_CLS = 'm-0 mt-1 text-[12px] text-(--color-error)'

export function TemplateEditorDrawer(props: Readonly<TemplateEditorDrawerProps>) {
  const { template } = props
  return (
    <Drawer
      open={template !== null}
      onClose={props.onClose}
      destroyOnHidden
      size="min(1120px, 100vw)"
      title={null}
      closable={false}
      classNames={{ body: 'p-0!' }}
    >
      {template && (
        <EditorBody
          key={template.key + (template.updatedAt ?? '')}
          {...props}
          template={template}
        />
      )}
    </Drawer>
  )
}

function EditorBody({
  template,
  saving,
  restoring,
  testing,
  fieldErrors,
  onClose,
  onSave,
  onRestore,
  onSendTest,
  onPreview,
}: Readonly<TemplateEditorDrawerProps & { template: EmailTemplate }>) {
  const { t } = useTranslation('email-templates')
  const [draft, setDraft] = useState<TemplateDraft>(() => draftOf(template))
  const [preview, setPreview] = useState<RenderedEmail | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState(false)
  const [lastField, setLastField] = useState<Field>('body')
  const subjectRef = useRef<InputRef>(null)
  const headingRef = useRef<InputRef>(null)
  const bodyRef = useRef<TextAreaRef>(null)
  const buttonRef = useRef<InputRef>(null)

  const dirty = useMemo(() => {
    const saved = draftOf(template)
    return (Object.keys(saved) as Field[]).some((k) => saved[k] !== draft[k])
  }, [draft, template])

  // Refresh the preview shortly after the last edit.
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      setPreviewLoading(true)
      onPreview(draft)
        .then((email) => {
          if (!alive) return
          setPreview(email)
          setPreviewError(false)
        })
        .catch(() => alive && setPreviewError(true))
        .finally(() => alive && setPreviewLoading(false))
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [draft, onPreview])

  const set = (field: Field) => (value: string) => setDraft((d) => ({ ...d, [field]: value }))

  const elementFor = (field: Field): HTMLInputElement | HTMLTextAreaElement | null => {
    if (field === 'body') return bodyRef.current?.resizableTextArea?.textArea ?? null
    const ref = field === 'subject' ? subjectRef : field === 'heading' ? headingRef : buttonRef
    return ref.current?.input ?? null
  }

  const insert = (name: string) => {
    const field = lastField
    const token = `{{${name}}}`
    const el = elementFor(field)
    const value = draft[field]
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    setDraft((d) => ({ ...d, [field]: next }))
    requestAnimationFrame(() => {
      const target = elementFor(field)
      if (!target) return
      target.focus()
      const caret = start + token.length
      target.setSelectionRange(caret, caret)
    })
  }

  const close = () => {
    if (!dirty) return onClose()
    Modal.confirm({
      title: t('editor.discardTitle'),
      content: t('editor.discardBody'),
      okText: t('editor.discard'),
      cancelText: t('editor.keepEditing'),
      okButtonProps: { danger: true },
      onOk: onClose,
    })
  }

  const track = (field: Field) => () => setLastField(field)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-(--color-border) px-5 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px] font-bold text-(--color-text) [font-family:var(--font-display)]">
            {t('editor.title', { name: template.name })}
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-(--color-text-muted)">{template.description}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="tpl-subject" className={LABEL_CLS}>
              {t('editor.subject')}
            </label>
            <Input
              id="tpl-subject"
              ref={subjectRef}
              value={draft.subject}
              maxLength={200}
              status={fieldErrors.subject ? 'error' : undefined}
              onFocus={track('subject')}
              onChange={(e) => set('subject')(e.target.value)}
            />
            {fieldErrors.subject && <p className={ERROR_CLS}>{fieldErrors.subject}</p>}
          </div>
          <div>
            <label htmlFor="tpl-heading" className={LABEL_CLS}>
              {t('editor.heading')}
            </label>
            <Input
              id="tpl-heading"
              ref={headingRef}
              value={draft.heading}
              maxLength={120}
              status={fieldErrors.heading ? 'error' : undefined}
              onFocus={track('heading')}
              onChange={(e) => set('heading')(e.target.value)}
            />
            {fieldErrors.heading && <p className={ERROR_CLS}>{fieldErrors.heading}</p>}
          </div>
          <div>
            <label htmlFor="tpl-body" className={LABEL_CLS}>
              {t('editor.body')}
            </label>
            <Input.TextArea
              id="tpl-body"
              ref={bodyRef}
              value={draft.body}
              maxLength={5000}
              autoSize={{ minRows: 8, maxRows: 18 }}
              status={fieldErrors.body ? 'error' : undefined}
              onFocus={track('body')}
              onChange={(e) => set('body')(e.target.value)}
            />
            {fieldErrors.body ? (
              <p className={ERROR_CLS}>{fieldErrors.body}</p>
            ) : (
              <p className={HINT_CLS}>{t('editor.bodyHint', { token: '{{code}}' })}</p>
            )}
          </div>
          {template.hasButton && (
            <div>
              <label htmlFor="tpl-button" className={LABEL_CLS}>
                {t('editor.buttonLabel')}
              </label>
              <Input
                id="tpl-button"
                ref={buttonRef}
                value={draft.buttonLabel}
                maxLength={40}
                status={fieldErrors.buttonLabel ? 'error' : undefined}
                onFocus={track('buttonLabel')}
                onChange={(e) => set('buttonLabel')(e.target.value)}
              />
              {fieldErrors.buttonLabel ? (
                <p className={ERROR_CLS}>{fieldErrors.buttonLabel}</p>
              ) : (
                <p className={HINT_CLS}>{t('editor.buttonHint')}</p>
              )}
            </div>
          )}
          <div>
            <p className={LABEL_CLS}>{t('editor.placeholders')}</p>
            <div className="flex flex-wrap gap-2">
              {template.placeholders.map((p) => (
                <Tooltip key={p.name} title={p.description}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(p.name)}
                    className="cursor-pointer rounded-lg border border-(--color-border-strong) bg-(--color-card) px-2.5 py-1 font-mono text-[12px] text-(--color-accent-dark) transition-colors md:hover:border-(--color-accent) md:hover:bg-(--color-accent-light)"
                  >
                    {`{{${p.name}}}`}
                  </button>
                </Tooltip>
              ))}
            </div>
            <p className={HINT_CLS}>{t('editor.placeholdersHint')}</p>
          </div>
        </div>
        <div className="lg:sticky lg:top-0 lg:self-start">
          <EmailPreview email={preview} loading={previewLoading} error={previewError} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-(--color-border) px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap gap-2">
          <Popconfirm
            title={t('editor.restoreConfirmTitle')}
            description={t('editor.restoreConfirmBody')}
            okText={t('editor.restoreConfirm')}
            cancelText={t('editor.cancel')}
            onConfirm={onRestore}
            disabled={template.isDefault}
          >
            <AppButton variant="neutral" disabled={template.isDefault} loading={restoring}>
              <ArrowCounterClockwise size={14} />
              {t('editor.restore')}
            </AppButton>
          </Popconfirm>
          <AppButton variant="secondary" loading={testing} onClick={() => onSendTest(draft)}>
            <PaperPlaneTilt size={14} />
            {t('editor.sendTest')}
          </AppButton>
        </div>
        <div className="flex gap-2">
          <AppButton variant="neutral" onClick={close}>
            {t('editor.cancel')}
          </AppButton>
          <AppButton
            variant="primary"
            loading={saving}
            disabled={!dirty}
            onClick={() => onSave(draft)}
          >
            {t('editor.save')}
          </AppButton>
        </div>
      </div>
    </div>
  )
}
