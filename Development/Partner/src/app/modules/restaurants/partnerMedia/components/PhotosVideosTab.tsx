import type { ReactNode } from 'react'
import { Alert, Grid, Image, Spin, Upload } from 'antd'
import {
  DownloadSimple,
  Images,
  Star,
  Trash,
  UploadSimple,
  VideoCamera,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { CardActionsMenu } from '../../../../molecules/CardActionsMenu'
import type { CardAction } from '../../../../molecules/CardActionsMenu'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { TabEmptyState } from '../../components/TabEmptyState'
import { ACCEPT_ATTRIBUTE } from '../constants'
import { formatBytes, formatCountOf } from '../format'
import type { PhotoItem, VideoItem } from '../types'
import type { usePhotosVideosTab } from '../hooks/usePhotosVideosTab'
import { UploadPreviewModal } from './UploadPreviewModal'

type Gallery = ReturnType<typeof usePhotosVideosTab>

const SECTION = 'bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]'
const SECTION_TITLE = 'text-sm font-semibold text-[var(--color-text)] m-0'
const META = 'text-[12px] text-[var(--color-text-muted)]'
/** Circular action pinned over a photo thumbnail. */
const OVERLAY_BTN =
  'w-7 h-7 rounded-full bg-white/90 flex items-center justify-center border-none cursor-pointer'
/** Square action in a video row. */
const ROW_BTN =
  'w-8 h-8 rounded-[8px] flex items-center justify-center bg-transparent border-none cursor-pointer'

/** Heading on the left; upload button pinned to the far right on the same row. */
function SectionHeader({
  title,
  count,
  action,
}: {
  title: string
  count: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-3 mb-4">
      <div>
        <h3 className={SECTION_TITLE}>{title}</h3>
        <span className={META}>{count}</span>
      </div>
      {action}
    </div>
  )
}

/**
 * The Photos & Videos tab (US-02 to US-06).
 *
 * Counts and maxima come from the payload — they are config-driven per
 * environment, so nothing here hardcodes 20 or 5.
 */
export function PhotosVideosTab({ c }: { c: Gallery }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  const uploadButton = (
    kind: 'photo' | 'video',
    variant: 'primary' | 'secondary',
    full: boolean,
    label: string,
  ) =>
    c.editable && (
      <Upload
        accept={ACCEPT_ATTRIBUTE[kind]}
        showUploadList={false}
        // Photos are picked as a set — a partner filling an empty gallery has a
        // folder of them. Videos stay single: one 200 MB transcode at a time.
        // Either way AntD calls `beforeUpload` once per file, and the modal is
        // still the confirmation step (BR-07).
        multiple={kind === 'photo'}
        beforeUpload={(file) => c.stageFile(kind, file as unknown as File)}
        disabled={full}
      >
        {/* Disabled at the limit rather than left to 409 at step 1 (BR-05). */}
        <AppButton variant={variant} disabled={full} className="justify-center">
          <UploadSimple size={14} />{' '}
          {variant === 'secondary' && isMobile ? t('restaurants:partnerMedia.upload') : label}
        </AppButton>
      </Upload>
    )

  const photoLabel = t('restaurants:partnerMedia.uploadPhoto')
  const videoLabel = t('restaurants:partnerMedia.uploadVideo')

  return (
    <div>
      <section className={`${SECTION} mb-6`}>
        <SectionHeader
          title={t('restaurants:partnerMedia.photos')}
          count={formatCountOf(c.photoCount, c.photoMax, t('restaurants:partnerMedia.photosNoun'))}
          // Top-right upload appears once there is content; the empty state owns
          // the first upload affordance (matches the design).
          action={
            c.photos.length > 0 && uploadButton('photo', 'secondary', c.photosFull, photoLabel)
          }
        />

        {c.photos.length === 0 ? (
          <TabEmptyState
            IconComp={Images}
            title={t('restaurants:partnerMedia.photosTitle')}
            description={t('restaurants:partnerMedia.photosDesc')}
            action={uploadButton('photo', 'primary', c.photosFull, photoLabel)}
          />
        ) : (
          <Image.PreviewGroup>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {c.photos.map((photo) => (
                <PhotoCard key={photo.mediaId} photo={photo} c={c} isMobile={isMobile} />
              ))}
            </div>
          </Image.PreviewGroup>
        )}
      </section>

      <section className={SECTION}>
        <SectionHeader
          title={t('restaurants:partnerMedia.videos')}
          count={formatCountOf(c.videoCount, c.videoMax, t('restaurants:partnerMedia.videosNoun'))}
          action={
            c.videos.length > 0 && uploadButton('video', 'secondary', c.videosFull, videoLabel)
          }
        />

        {c.videos.length === 0 ? (
          <TabEmptyState
            IconComp={VideoCamera}
            title={t('restaurants:partnerMedia.videosTitle')}
            description={t('restaurants:partnerMedia.videosDesc')}
            action={uploadButton('video', 'primary', c.videosFull, videoLabel)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {c.videos.map((video) => (
              <VideoRow key={video.mediaId} video={video} c={c} isMobile={isMobile} />
            ))}
          </div>
        )}
      </section>

      <UploadPreviewModal
        open={Boolean(c.pending)}
        kind={c.pending?.kind ?? 'photo'}
        items={c.stagedFiles}
        uploading={c.uploading}
        progress={c.progress}
        uploadIndex={c.uploadIndex}
        error={c.uploadError}
        onRemove={c.removeStaged}
        onCancel={c.closeUpload}
        onSubmit={() => void c.submitUpload()}
      />

      <ConfirmModal
        open={Boolean(c.deleteTarget)}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:partnerMedia.deleteTitle')}
        /* The last photo is a different decision from any other photo: it takes
           the cover, and the app listing, with it (MET-1255). */
        content={t(
          c.deleteHidesRestaurant
            ? 'restaurants:partnerMedia.deleteLastPhotoBody'
            : 'restaurants:partnerMedia.deleteBody',
          { name: c.deleteTarget?.name ?? '' },
        )}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />
    </div>
  )
}

interface PhotoCardProps {
  photo: PhotoItem
  c: Gallery
  isMobile: boolean
}

function PhotoCard({ photo, c, isMobile }: PhotoCardProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const canSetCover = c.editable && !photo.isCover

  const actions: CardAction[] = [
    {
      key: 'download',
      label: t('restaurants:partnerMedia.download'),
      icon: <DownloadSimple size={16} />,
      onClick: () => c.downloadMedia(photo.url),
    },
    ...(canSetCover
      ? [
          {
            key: 'cover',
            label: t('restaurants:partnerMedia.setCover'),
            icon: <Star size={16} />,
            onClick: () => c.applyCover(photo),
          },
        ]
      : []),
    ...(c.editable
      ? [
          {
            key: 'delete',
            label: t('common:buttons.delete'),
            icon: <Trash size={16} />,
            danger: true,
            onClick: () => c.requestDelete('photo', photo),
          },
        ]
      : []),
  ]

  return (
    /* `aspect-[4/3]` sits on the grid item itself, not on a child. Grid items
       stretch to the tallest cell in their row, so with the ratio on an inner box
       the tile grew while the frame did not — which is the blank strip that kept
       appearing under one photo. Pinning the ratio here makes the tile's height
       its own and unstretchable. */
    <div className="aspect-[4/3] rounded-[12px] overflow-hidden border border-[var(--color-border)]">
      <div className="group relative h-full">
        {/* A CloudFront URL — public and cacheable, safe in an img src.
            The image fills the frame edge to edge: `object-cover` scales the short
            axis up and `object-center` trims the overflow evenly instead of taking
            it all off the bottom. Height is forced on the img because AntD ships
            `.ant-image-img { height: auto }` at the same specificity as Tailwind's
            `h-full`, and load order decides — so `!h-full` settles it rather than
            leaving the image free to size itself. Click opens the full, uncropped
            photo in the preview group. */}
        <Image
          src={photo.url}
          alt={photo.name}
          rootClassName="block h-full w-full"
          className="!h-full w-full object-cover object-center"
          preview={{ mask: false }}
        />
        {photo.isCover && (
          <span className="absolute left-2 top-2 rounded bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
            {t('restaurants:partnerMedia.coverPhoto')}
          </span>
        )}

        {/* Web: actions on hover */}
        {!isMobile && (
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-1.5 bg-gradient-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title={t('restaurants:partnerMedia.download')}
              aria-label={t('restaurants:partnerMedia.download')}
              onClick={() => c.downloadMedia(photo.url)}
              className={`${OVERLAY_BTN} text-[var(--color-text)]`}
            >
              <DownloadSimple size={15} />
            </button>
            {canSetCover && (
              <button
                type="button"
                title={t('restaurants:partnerMedia.setCover')}
                aria-label={t('restaurants:partnerMedia.setCover')}
                onClick={() => c.applyCover(photo)}
                disabled={c.settingCover}
                className={`${OVERLAY_BTN} text-[var(--color-text)] disabled:cursor-not-allowed`}
              >
                <Star size={15} />
              </button>
            )}
            {c.editable && (
              <button
                type="button"
                title={t('common:buttons.delete')}
                aria-label={t('common:buttons.delete')}
                onClick={() => c.requestDelete('photo', photo)}
                className={`${OVERLAY_BTN} text-[var(--color-error)]`}
              >
                <Trash size={15} />
              </button>
            )}
          </div>
        )}

        {/* Mobile: solid "more" menu pinned to the image's top-right */}
        {isMobile && (
          <div className="absolute top-1.5 right-1.5">
            <CardActionsMenu overlay moreLabel={t('common:buttons.more')} actions={actions} />
          </div>
        )}
      </div>
    </div>
  )
}

interface VideoRowProps {
  video: VideoItem
  c: Gallery
  isMobile: boolean
}

function VideoRow({ video, c, isMobile }: VideoRowProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const processing = video.status === 'processing'

  const actions: CardAction[] = [
    // Omitted while transcoding — `url` is null until the provider reports ready.
    ...(video.url
      ? [
          {
            key: 'download',
            label: t('restaurants:partnerMedia.download'),
            icon: <DownloadSimple size={16} />,
            onClick: () => c.downloadMedia(video.url),
          },
        ]
      : []),
    ...(c.editable
      ? [
          {
            key: 'delete',
            label: t('common:buttons.delete'),
            icon: <Trash size={16} />,
            danger: true,
            onClick: () => c.requestDelete('video', video),
          },
        ]
      : []),
  ]

  /**
   * Transcoding takes the size slot rather than sitting beside it: readiness is
   * the salient fact, and a single-line row has no room for both. The gallery
   * polls until the provider says ready, at which point the byte count returns.
   */
  const sizeSlot = processing ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[var(--color-accent)]">
      <Spin size="small" />
      {t('restaurants:partnerMedia.processing')}
    </span>
  ) : (
    <span className={`${META} shrink-0`}>{formatBytes(video.size)}</span>
  )

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] p-3">
      <div className="w-10 h-10 rounded-[8px] bg-[var(--color-hover-neutral)] flex items-center justify-center shrink-0 overflow-hidden">
        {/* Both URLs are null until the provider reports ready — expected, not
            an error — so a placeholder stands in rather than a broken image. */}
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <VideoCamera size={20} className="text-[var(--color-text-secondary)]" />
        )}
      </div>

      {isMobile ? (
        /* Mobile: filename with the size stacked below it */
        <div className="flex-1 min-w-0">
          <div className="truncate text-[13px] font-medium text-[var(--color-text)]">
            {video.name}
          </div>
          <div className="mt-0.5">{sizeSlot}</div>
        </div>
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-[var(--color-text)]">
            {video.name}
          </span>
          {sizeSlot}
        </>
      )}

      {isMobile ? (
        <CardActionsMenu moreLabel={t('common:buttons.more')} actions={actions} />
      ) : (
        <>
          <button
            type="button"
            title={t('restaurants:partnerMedia.download')}
            aria-label={t('restaurants:partnerMedia.download')}
            onClick={() => c.downloadMedia(video.url)}
            disabled={!video.url}
            className={`${ROW_BTN} text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-40 md:hover:bg-[var(--color-hover-neutral)]`}
          >
            <DownloadSimple size={16} />
          </button>
          {c.editable && (
            <button
              type="button"
              title={t('common:buttons.delete')}
              aria-label={t('common:buttons.delete')}
              onClick={() => c.requestDelete('video', video)}
              className={`${ROW_BTN} text-[var(--color-error)] md:hover:bg-[var(--color-error-bg)]`}
            >
              <Trash size={16} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
