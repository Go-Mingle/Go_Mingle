import { Alert, Modal, Progress } from 'antd'
import { FileText, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { formatBytes } from '../format'
import type { MediaKind, StagedFile } from '../types'

interface Props {
  open: boolean
  kind: MediaKind
  /**
   * Everything staged, in upload order. A list rather than a file because the
   * photo picker is multi-select; documents and videos simply pass one entry.
   */
  items: StagedFile[]
  uploading: boolean
  /**
   * 0–100 across the whole batch, not the file in flight.
   *
   * One Submit is one action to the partner, so it gets one bar that only moves
   * forward. A per-file percentage here would fill and restart once per file,
   * which reads as a separate loader for each of them.
   */
  progress: number
  /** 0-based position of the file in flight within {@link Props.items}. */
  uploadIndex?: number
  /**
   * Why the last attempt failed, or null. Shown in place of the progress bar.
   *
   * The modal needs its own copy of this, not just the page toast: since
   * MET-1148 the commit verifies the uploaded bytes, so the common failure now
   * arrives *after* the partner has watched the bar reach 100% and disappear. A
   * toast alone leaves the modal looking like it succeeded but did nothing.
   */
  error?: string | null
  /** Drops one staged file. Omitted where the batch is always a single file. */
  onRemove?: (id: string) => void
  onCancel: () => void
  onSubmit: () => void
}

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'
const VALUE = 'font-[Poppins,sans-serif] text-sm font-medium text-[var(--color-text-secondary)]'

/**
 * The preview → submit step every upload goes through (BR-07).
 *
 * Nothing has left the browser at this point: the files are staged locally, and
 * only Submit requests an upload target and sends the bytes. Cancel therefore
 * costs nothing and leaves no orphaned object.
 *
 * One file gets the full-bleed preview the design specifies; a multi-file batch
 * gets a checkable list instead, because a stack of 180px previews buries the
 * Submit button and the point of the step is confirming *which* files these are.
 */
export function UploadPreviewModal({
  open,
  kind,
  items,
  uploading,
  progress,
  uploadIndex = 0,
  error,
  onRemove,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useTranslation(['restaurants', 'common'])

  const batch = items.length > 1
  const only = items[0]

  return (
    <Modal
      open={open}
      onCancel={uploading ? undefined : onCancel}
      title={t(
        batch
          ? 'restaurants:partnerMedia.preview.photos'
          : `restaurants:partnerMedia.preview.${kind}`,
      )}
      footer={null}
      width={480}
      // Dismissing mid-upload would leave the request running with no way to
      // report its outcome, so the modal is locked until it settles.
      maskClosable={!uploading}
      closable={!uploading}
      destroyOnHidden
    >
      <div className="mt-3 flex flex-col gap-4">
        {batch ? (
          <StagedList items={items} uploading={uploading} onRemove={onRemove} />
        ) : (
          <SinglePreview kind={kind} item={only} />
        )}

        {/* A video can run to 200 MB, so the bytes need a visible indicator. */}
        {uploading && (
          <div className="flex flex-col gap-1">
            {/* One bar for the batch — weighted by bytes upstream, so it fills
                once instead of restarting per file. The count is a caption on
                it, not a second indicator: it says which file is going up now,
                which the bar alone cannot. */}
            {batch && (
              <span className="text-[12px] text-[var(--color-text-muted)]">
                {t('restaurants:partnerMedia.uploadingOf', {
                  current: Math.min(uploadIndex + 1, items.length),
                  total: items.length,
                })}
              </span>
            )}
            <Progress percent={progress} size="small" status="active" />
          </div>
        )}

        {/*
          Anchored where the progress bar was, so the thing that replaces a
          completed upload is the reason it did not count. Retrying is Submit
          again — which restarts from step 1 with a fresh upload target, the only
          valid recovery once the server has consumed the ref (MET-1148).
        */}
        {!uploading && error ? (
          <Alert type="error" showIcon message={error} role="alert" className="text-[13px]" />
        ) : null}
      </div>

      <div className="app-modal-footer">
        <AppButton variant="neutral" onClick={onCancel} disabled={uploading}>
          {t('common:buttons.cancel')}
        </AppButton>
        <AppButton variant="primary" onClick={onSubmit} disabled={uploading || items.length === 0}>
          {error ? t('common:buttons.retry') : t('common:buttons.submit')}
        </AppButton>
      </div>
    </Modal>
  )
}

/** The design's single-file preview: the image itself, then its metadata. */
function SinglePreview({ kind, item }: { kind: MediaKind; item: StagedFile | undefined }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const previewUrl = item?.previewUrl

  return (
    <>
      <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-page)]">
        {kind === 'photo' && previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {kind === 'video' && previewUrl ? (
          <video src={previewUrl} controls className="h-full w-full object-contain" />
        ) : null}
        {kind === 'document' ? (
          <div className="flex flex-col items-center gap-2 text-[var(--color-text-subtle)]">
            <FileText size={30} />
            <span className="text-[12.5px]">{t('restaurants:partnerMedia.preview.noPreview')}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <div className={LABEL}>{t('restaurants:partnerMedia.fields.name')}</div>
          <div className={`${VALUE} mt-1 break-all`}>{item?.file.name ?? '—'}</div>
        </div>
        <div className="flex gap-8">
          <div>
            <div className={LABEL}>{t('restaurants:partnerMedia.fields.type')}</div>
            <div className={`${VALUE} mt-1`}>{item?.file.type || '—'}</div>
          </div>
          <div>
            <div className={LABEL}>{t('restaurants:partnerMedia.fields.size')}</div>
            <div className={`${VALUE} mt-1`}>{formatBytes(item?.file.size ?? null)}</div>
          </div>
        </div>
      </div>
    </>
  )
}

interface StagedListProps {
  items: StagedFile[]
  uploading: boolean
  onRemove?: (id: string) => void
}

/**
 * A multi-file batch: thumbnail, name, size, and a per-file remove.
 *
 * Remove matters more than the larger preview does — a twenty-photo pick will
 * usually contain one or two the partner did not mean to include, and without
 * this the only correction is Cancel and start the dialog over.
 */
function StagedList({ items, uploading, onRemove }: StagedListProps) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-[var(--color-text-muted)]">
        {t('restaurants:partnerMedia.selectedPhotos', { total: items.length })}
      </span>
      {/* Capped and scrollable so the footer stays reachable at twenty files. */}
      <ul className="m-0 flex max-h-[260px] list-none flex-col gap-2 overflow-y-auto p-0">
        {items.map((staged) => (
          <li
            key={staged.id}
            className="flex items-center gap-3 rounded-[10px] border border-[var(--color-border)] p-2"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[var(--color-page)]">
              {staged.previewUrl ? (
                <img src={staged.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[var(--color-text)]">
                {staged.file.name}
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)]">
                {formatBytes(staged.file.size)}
              </div>
            </div>
            {onRemove && (
              <button
                type="button"
                title={t('restaurants:partnerMedia.removeStaged', { name: staged.file.name })}
                aria-label={t('restaurants:partnerMedia.removeStaged', { name: staged.file.name })}
                onClick={() => onRemove(staged.id)}
                disabled={uploading}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40 md:hover:bg-[var(--color-hover-neutral)]"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
