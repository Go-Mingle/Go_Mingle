import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePartnerProfileQuery } from '../../partnerProfile/hooks/usePartnerProfileQueries'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { ACCEPTED_TYPES } from '../constants'
import { isCoverReassignRequired } from '../errors'
import type { MediaKind, PhotoItem, StagedFile, VideoItem } from '../types'
import { useMediaFeedback } from './useMediaFeedback'
import { useMediaUpload } from './useMediaUpload'
import {
  useCommitPhotoMutation,
  useCommitVideoMutation,
  useDeletePhotoMutation,
  useDeleteVideoMutation,
  usePartnerMediaQuery,
  useSetCoverPhotoMutation,
} from './usePartnerMediaQueries'

/** Which of the two galleries an action is aimed at. */
type GalleryKind = Extract<MediaKind, 'photo' | 'video'>

/**
 * A batch staged for the BR-07 preview → submit confirmation.
 *
 * BR-07 keeps its shape — pick, preview, confirm — but the photo picker takes a
 * selection rather than a single file: a partner filling an empty gallery has a
 * folder of shots, and twenty separate pick → preview → submit rounds is the
 * same twenty uploads with nineteen extra confirmations. There is still no bulk
 * endpoint, so Submit runs the three-step upload once per file, in order.
 *
 * Videos stay single: a 200 MB transcode is not something to queue five of.
 */
interface PendingUpload {
  kind: GalleryKind
  files: StagedFile[]
}

interface DeleteTarget {
  kind: GalleryKind
  mediaId: string
  name: string
}

let stagedSeq = 0

/** Two picks can share a filename, and `File` has no identity of its own. */
function nextStagedId(): string {
  stagedSeq += 1
  return `staged-${stagedSeq}`
}

/** Re-picking the same file from the same dialog should not stage it twice. */
function isSameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}

function revokeAll(files: StagedFile[]): void {
  files.forEach((staged) => {
    if (staged.previewUrl) URL.revokeObjectURL(staged.previewUrl)
  })
}

/**
 * The Photos & Videos tab (US-02 to US-06).
 *
 * Counts and maxima come from the gallery payload — they are config-driven per
 * environment, so nothing here hardcodes 20 or 5.
 */
export function usePhotosVideosTab(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showErrorText, showMediaError, resolveMediaError } =
    useMediaFeedback(feedback)

  const mediaQuery = usePartnerMediaQuery()
  // Already in cache — the profile shell reads the same key, so this costs no GET.
  // Needed only to know whether the restaurant is currently listed on the app.
  const profileQuery = usePartnerProfileQuery()
  const commitPhoto = useCommitPhotoMutation()
  const commitVideo = useCommitVideoMutation()
  const setCover = useSetCoverPhotoMutation()
  const deletePhoto = useDeletePhotoMutation()
  const deleteVideo = useDeleteVideoMutation()

  const photos = mediaQuery.data?.photos
  const videos = mediaQuery.data?.videos

  const [pending, setPending] = useState<PendingUpload | null>(null)
  /**
   * The batch again, readable synchronously.
   *
   * A multi-select pick calls `stageFile` once per file within a single tick, so
   * each call has to see what the previous one added. React state does not
   * update until the re-render, and the alternative — deciding inside a state
   * updater — would put the "too many picked" toast in a function React is free
   * to call twice.
   */
  const pendingRef = useRef<PendingUpload | null>(null)
  /**
   * Why the last submit failed, shown inside the modal.
   *
   * Alongside the toast, not instead of it: since MET-1148 the commit verifies
   * the uploaded bytes, so a photo can be rejected *after* its progress bar has
   * run to 100% and vanished. Videos are unaffected — their bytes go to
   * Cloudflare Stream, never to a bucket this API inspects — but the modal is
   * shared, and a failure there deserves the same treatment.
   */
  const [uploadError, setUploadError] = useState<string | null>(null)
  /** 0-based position of the file currently uploading, for "Uploading 2 of 3". */
  const [uploadIndex, setUploadIndex] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const photoUpload = useMediaUpload('photo', commitPhoto.mutateAsync)
  const videoUpload = useMediaUpload('video', commitVideo.mutateAsync)
  const active = pending?.kind === 'video' ? videoUpload : photoUpload

  const applyPending = useCallback((next: PendingUpload | null) => {
    pendingRef.current = next
    setPending(next)
  }, [])

  /** Slots left before the configured maximum; unknown until the gallery loads. */
  const photoRoom = photos ? Math.max(photos.max - photos.count, 0) : 1
  const videoRoom = videos ? Math.max(videos.max - videos.count, 0) : 1

  /**
   * Staged rather than uploaded on pick (BR-07). Returning false stops AntD's
   * Upload from issuing its own request — the real upload is the direct
   * presigned PUT / provider POST the modal triggers.
   *
   * A multi-select pick arrives one file per call, so this both validates and
   * accumulates.
   */
  const stageFile = useCallback(
    (kind: GalleryKind, file: File): boolean => {
      if (!ACCEPTED_TYPES[kind].includes(file.type as never)) {
        showErrorText(t(`restaurants:partnerMedia.errors.badType.${kind}`))
        return false
      }

      const current = pendingRef.current
      // A pick for the other gallery replaces the batch rather than mixing kinds:
      // the two have different limits, endpoints and preview treatments.
      if (current && current.kind !== kind) revokeAll(current.files)
      // Only photos accumulate — a second video pick replaces the first.
      const staged = current?.kind === kind && kind === 'photo' ? current.files : []

      // Picking the same file twice from the dialog is a slip, not a request to
      // upload it twice.
      if (staged.some((entry) => isSameFile(entry.file, file))) return false

      // Capacity is a courtesy here, never the enforcement — the server refuses
      // at the limit (BR-05). One file always goes through, so a rejection still
      // arrives in the server's own wording; only a multi-pick's excess is
      // dropped, where staging files that cannot possibly fit is the worse lie.
      const room = Math.max(kind === 'photo' ? photoRoom : videoRoom, 1)
      if (staged.length >= room) {
        showErrorText(t('restaurants:partnerMedia.errors.tooManyPicked', { room }))
        return false
      }

      applyPending({
        kind,
        files: [...staged, { id: nextStagedId(), file, previewUrl: URL.createObjectURL(file) }],
      })
      setUploadError(null)
      return false
    },
    [applyPending, photoRoom, videoRoom, showErrorText, t],
  )

  /** Drops one file from the batch before it is submitted. */
  const removeStaged = useCallback(
    (id: string) => {
      const current = pendingRef.current
      if (!current) return
      const entry = current.files.find((staged) => staged.id === id)
      if (!entry) return

      revokeAll([entry])
      const files = current.files.filter((staged) => staged.id !== id)
      // Emptying the list closes the modal — there is nothing left to preview.
      applyPending(files.length > 0 ? { ...current, files } : null)
      setUploadError(null)
    },
    [applyPending],
  )

  /** Releases every object URL — otherwise they leak for the page's lifetime. */
  const closeUpload = useCallback(() => {
    if (pendingRef.current) revokeAll(pendingRef.current.files)
    applyPending(null)
    setUploadError(null)
    setUploadIndex(0)
    photoUpload.reset()
    videoUpload.reset()
  }, [applyPending, photoUpload, videoUpload])

  /** What to say once a batch has gone up whole. */
  const uploadedMessage = useCallback(
    (kind: GalleryKind, total: number, becameCover: boolean): string => {
      // Transcoding starts now; the gallery poll picks up the transition.
      if (kind === 'video') return t('restaurants:partnerMedia.videoAdded')
      if (total === 1) {
        // Worth its own message: a cover photo is required to submit, so this
        // first upload is what lifts J6A's submission gate.
        return becameCover
          ? t('restaurants:partnerMedia.firstPhotoBecameCover')
          : t('restaurants:partnerMedia.photoAdded')
      }
      return becameCover
        ? t('restaurants:partnerMedia.photosAddedWithCover', { total })
        : t('restaurants:partnerMedia.photosAdded', { total })
    },
    [t],
  )

  const submitUpload = useCallback(async () => {
    const current = pendingRef.current
    if (!current || current.files.length === 0) return
    const { kind, files } = current
    // Cleared up front so a second attempt never shows the previous reason
    // beside a running progress bar.
    setUploadError(null)
    setUploadIndex(0)

    const runner = kind === 'video' ? videoUpload : photoUpload
    let done = 0
    let becameCover = false

    // Sequential, not parallel: every file is a presigned PUT plus two API calls,
    // and the count limit is checked when each upload target is minted — firing
    // them together would race several requests at the last free slot.
    for (const staged of files) {
      setUploadIndex(done)
      try {
        const result = await runner.run(staged.file)
        if ((result as { becameCover?: boolean }).becameCover) becameCover = true
        done += 1
      } catch (cause) {
        // Everything before this file is committed and already in the gallery.
        // The failed file and the ones behind it stay staged, so Submit retries
        // exactly what is left — a full restart from step 1, which is the only
        // valid recovery once the server has consumed the uploadRef (MET-1148).
        const reason = resolveMediaError(cause, kind)
        const message =
          files.length > 1
            ? t('restaurants:partnerMedia.errors.batchStopped', {
                done,
                total: files.length,
                name: staged.file.name,
                reason,
              })
            : reason

        revokeAll(files.slice(0, done))
        applyPending({ kind, files: files.slice(done) })
        setUploadIndex(0)
        setUploadError(message)
        showErrorText(message)
        return
      }
    }

    showSuccess(uploadedMessage(kind, done, becameCover))
    closeUpload()
  }, [
    applyPending,
    videoUpload,
    photoUpload,
    showSuccess,
    uploadedMessage,
    t,
    closeUpload,
    resolveMediaError,
    showErrorText,
  ])

  /**
   * One bar for the whole batch, weighted by bytes.
   *
   * `useMediaUpload` reports progress for the file in flight and resets to 0 for
   * the next one, so a three-photo pick drew what read as three separate
   * loaders: the bar filled, vanished, and started again. The batch is a single
   * action to the partner — one Submit, one outcome — so it gets a single
   * indicator that only ever moves forward.
   *
   * Weighted by size rather than counting files off, because a batch routinely
   * mixes a 200 KB shot with an 8 MB one and "1 of 3 done" would claim a third
   * of the work was finished after a fortieth of the bytes.
   *
   * Derived rather than accumulated in state: `uploadIndex` already says which
   * file is in flight and the batch cannot change while it is uploading, so the
   * bytes behind it are just a sum over the same list.
   */
  const batchProgress = useMemo(() => {
    const files = pending?.files ?? []
    if (files.length === 0) return 0

    const total = files.reduce((bytes, staged) => bytes + staged.file.size, 0)
    // Nothing to weight by. A zero-byte file is refused at submit before any
    // target is minted (`FileEmptyError`), so this only guards the division.
    if (total === 0) return active.progress

    const settled = files
      .slice(0, uploadIndex)
      .reduce((bytes, staged) => bytes + staged.file.size, 0)
    const inFlight = files[uploadIndex]?.file.size ?? 0

    return Math.min(
      Math.round(((settled + (inFlight * active.progress) / 100) / total) * 100),
      100,
    )
  }, [pending, uploadIndex, active.progress])

  const applyCover = useCallback(
    (photo: PhotoItem) => {
      setCover.mutate(photo.mediaId, {
        onSuccess: () => {
          showSuccess(t('restaurants:partnerMedia.coverUpdated'))
        },
        onError: (cause) => {
          showMediaError(cause, 'photo')
        },
      })
    },
    [setCover, showSuccess, showMediaError, t],
  )

  /**
   * Opens the asset in a new tab so the browser can save it.
   *
   * Photo and video URLs are public CloudFront links, so no presigned round-trip
   * is needed — J6B exposes `download-url` for documents only, which are private.
   */
  const downloadMedia = useCallback((url: string | null | undefined) => {
    if (!url) return
    window.open(url, '_blank', 'noopener')
  }, [])

  const requestDelete = useCallback((kind: GalleryKind, item: PhotoItem | VideoItem) => {
    setDeleteTarget({ kind, mediaId: item.mediaId, name: item.name })
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return
    const { kind, mediaId } = deleteTarget
    const mutation = kind === 'video' ? deleteVideo : deletePhoto

    mutation.mutate(mediaId, {
      onSuccess: () => {
        showSuccess(t(`restaurants:partnerMedia.${kind}Deleted`))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        // The cover guard is an instruction, not a failure: the partner has to
        // designate a replacement first. Either way the modal closes, so the
        // message is not hidden behind it.
        if (isCoverReassignRequired(cause)) {
          showErrorText(t('restaurants:partnerMedia.errors.coverReassign'))
        } else {
          showMediaError(cause, kind)
        }
        setDeleteTarget(null)
      },
    })
  }, [deleteTarget, deleteVideo, deletePhoto, showSuccess, showMediaError, showErrorText, t])

  /**
   * True when confirming this deletion would take the restaurant off the app.
   *
   * The cover can only be deleted once it is the last photo standing — the
   * reassign guard refuses it while others remain — and a restaurant with no
   * cover cannot be visible to Minglers, since turning visibility back on is
   * refused with `ERR_COVER_PHOTO_REQUIRED`. So this delete un-lists the venue,
   * and nothing else on the tab hints at that: the partner clearing photos to
   * replace them with better ones has no way to know (MET-1255).
   */
  const deleteHidesRestaurant =
    deleteTarget?.kind === 'photo' &&
    (profileQuery.data?.visibleOnApp ?? false) &&
    (photos?.items.find((photo) => photo.mediaId === deleteTarget.mediaId)?.isCover ?? false)

  return {
    photos: photos?.items ?? [],
    photoCount: photos?.count ?? 0,
    photoMax: photos?.max ?? 0,
    videos: videos?.items ?? [],
    videoCount: videos?.count ?? 0,
    videoMax: videos?.max ?? 0,

    isPending: mediaQuery.isPending,
    isError: mediaQuery.isError,
    error: mediaQuery.error,
    isFetching: mediaQuery.isFetching,

    editable,
    /** True at the limit — the control is disabled rather than 409-ing on click. */
    photosFull: Boolean(photos && photos.count >= photos.max),
    videosFull: Boolean(videos && videos.count >= videos.max),

    pending,
    /** Everything staged for the batch in the modal; empty when nothing is. */
    stagedFiles: pending?.files ?? [],
    stageFile,
    removeStaged,
    closeUpload,
    submitUpload,
    uploading: active.uploading,
    /** Across the whole batch, not the file in flight. */
    progress: batchProgress,
    uploadIndex,
    uploadError,

    applyCover,
    settingCover: setCover.isPending,

    downloadMedia,

    deleteTarget,
    deleteHidesRestaurant,
    requestDelete,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    deleting: deletePhoto.isPending || deleteVideo.isPending,
  }
}
