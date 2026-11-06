import { Alert, Progress, Spin, Upload } from 'antd'
import { DownloadSimple, Eye, FilePdf, Trash, UploadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { MENU_PDF_ACCEPT_ATTRIBUTE } from '../constants'
import type { useMenuPdfSection } from '../hooks/useMenuPdfSection'

type Pdf = ReturnType<typeof useMenuPdfSection>

const ACTION =
  'flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent ' +
  'text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150'

/**
 * The Restaurant Menu PDF section (US-01).
 *
 * `menuUrl` is a plain **public** CloudFront URL (CR-39), so the eye and the
 * download use it directly — unlike J6B's documents there is no presign hop and
 * no auth header to attach.
 */
export function MenuPdfCard({ c }: { c: Pdf }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="mb-3 rounded-[var(--radius-lg)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] md:mb-6 md:p-6">
      <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        {t('restaurants:partnerMenu.pdfTitle')}
        <span className="text-[11px] font-medium normal-case text-[var(--color-text-subtle)]">
          ({t('restaurants:partnerMenu.pdfOptional')})
        </span>
      </h3>
      <p className="mb-4 text-[12px] text-[var(--color-text-muted)]">
        {t('restaurants:partnerMenu.pdfHint')}
      </p>

      {/* The refusal, in place and in the section it belongs to (MET-1258). The
          page also toasts it, but a toast has faded by the time a partner looks
          back at an Upload button that appeared to do nothing. */}
      {c.uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          className="mb-4"
          message={c.uploadError}
          onClose={c.dismissUploadError}
        />
      )}

      <MenuPdfBody c={c} />

      <ConfirmModal
        open={c.confirmingDelete}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:partnerMenu.pdfDeleteTitle')}
        // The stored file is retained, but the reference is cleared for good, so
        // the copy promises exactly what the spec promises (BR-04).
        content={t('restaurants:partnerMenu.pdfDeleteBody')}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />
    </div>
  )
}

function MenuPdfBody({ c }: { c: Pdf }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (c.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  // Replaces the row while bytes are moving: there is no preview modal to host a
  // progress bar (AC-01.2).
  if (c.uploading) {
    return (
      <div className="rounded-[12px] border border-[var(--color-border)] p-3">
        <p className="mb-2 text-[13px] text-[var(--color-text-muted)]">
          {t('restaurants:partnerMenu.pdfUploading')}
        </p>
        <Progress percent={c.progress} size="small" />
      </div>
    )
  }

  // The URL is narrowed here and passed down, so the row needs no fallback of
  // its own for a case that cannot reach it.
  return c.menuUrl ? <UploadedRow c={c} url={c.menuUrl} /> : <EmptyState c={c} />
}

function UploadedRow({ c, url }: { c: Pdf; url: string }) {
  const { t } = useTranslation(['restaurants', 'common'])
  // The name can genuinely be absent on a legacy row, unlike the URL.
  const name = c.name ?? t('restaurants:partnerMenu.pdfFallbackName')

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-error-bg)]">
        <FilePdf size={22} className="text-[var(--color-error)]" />
      </div>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text)]">
        {name}
      </span>

      <button
        type="button"
        aria-label={t('restaurants:partnerMenu.viewPdf')}
        onClick={() => window.open(url, '_blank', 'noopener')}
        className={`${ACTION} md:hover:bg-[var(--color-hover-neutral)] md:hover:text-[var(--color-text)]`}
      >
        <Eye size={17} />
      </button>

      {/* A button, not an `<a download>`: the URL is cross-origin, where the
          `download` attribute is ignored and the anchor just navigated the tab. */}
      <button
        type="button"
        aria-label={t('restaurants:partnerMenu.downloadPdf')}
        onClick={() => void c.downloadPdf()}
        className={`${ACTION} md:hover:bg-[var(--color-accent-light)] md:hover:text-[var(--color-accent)]`}
      >
        <DownloadSimple size={17} />
      </button>

      {/* Absent rather than disabled while read-only, so PENDING offers no
          control that would only 409 (BR-10). */}
      {c.editable && (
        <button
          type="button"
          aria-label={t('restaurants:partnerMenu.removePdf')}
          onClick={c.requestDelete}
          className={`${ACTION} md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]`}
        >
          <Trash size={17} />
        </button>
      )}
    </div>
  )
}

function EmptyState({ c }: { c: Pdf }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (!c.editable) {
    return (
      <p className="rounded-[12px] border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
        {t('restaurants:partnerMenu.noPdf')}
      </p>
    )
  }

  return (
    <Upload.Dragger
      accept={MENU_PDF_ACCEPT_ATTRIBUTE}
      showUploadList={false}
      // Returns false: the real upload is the presigned PUT the controller
      // triggers, not AntD's own request. The dashed full-width drop box comes
      // from `.app-upload-dragger` in antd-overrides.css (matches the design).
      beforeUpload={(file) => c.pickFile(file as unknown as File)}
      className="app-upload-dragger"
    >
      <div className="flex flex-col items-center gap-2 py-4">
        <UploadSimple size={28} className="text-[var(--color-text-subtle)]" />
        <span className="text-[13px] text-[var(--color-text-muted)]">
          {t('restaurants:partnerMenu.noPdf')}
        </span>
        <AppButton variant="secondary">
          <UploadSimple size={14} /> {t('restaurants:partnerMenu.uploadPdf')}
        </AppButton>
      </div>
    </Upload.Dragger>
  )
}
