import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import type { RenderedEmail } from '../types'

interface EmailPreviewProps {
  email: RenderedEmail | null
  loading: boolean
  error: boolean
}

/** The rendered email in a sandboxed frame, as the recipient will see it. */
export function EmailPreview({ email, loading, error }: Readonly<EmailPreviewProps>) {
  const { t } = useTranslation('email-templates')
  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-(--color-border) bg-(--color-page)">
      <div className="flex items-center justify-between gap-2 border-b border-(--color-border) bg-(--color-card) px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--color-text-subtle)">
            {t('editor.preview')}
          </p>
          <p className="m-0 mt-0.5 truncate text-[13px] text-(--color-text)">
            <span className="text-(--color-text-muted)">{t('editor.previewSubject')} </span>
            {email?.subject ?? ''}
          </p>
        </div>
        {loading && <Spin size="small" />}
      </div>
      {error ? (
        <p className="m-0 p-6 text-[13px] text-(--color-error)">{t('editor.previewError')}</p>
      ) : (
        <iframe
          title={t('editor.preview')}
          sandbox=""
          srcDoc={email?.html ?? ''}
          className="min-h-[420px] w-full flex-1 border-0 bg-white"
        />
      )}
      <p className="m-0 border-t border-(--color-border) bg-(--color-card) px-4 py-2 text-[12px] text-(--color-text-subtle)">
        {t('editor.previewHint')}
      </p>
    </div>
  )
}
