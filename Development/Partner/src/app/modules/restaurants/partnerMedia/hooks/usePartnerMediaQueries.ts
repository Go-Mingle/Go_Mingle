import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_PROFILE_QUERY_KEY } from '../../partnerProfile/constants'
import type { PartnerRestaurantProfile } from '../../partnerProfile/types'
import { PARTNER_DOCUMENTS_QUERY_KEY, PARTNER_MEDIA_QUERY_KEY, VIDEO_POLL_MS } from '../constants'
import { partnerMediaService } from '../services'
import type { CommitMediaDto, DocumentItem, DocumentListParams, MediaGallery } from '../types'

/**
 * J6B's server state.
 *
 * Mutations own cache writes only; toasts stay with the caller's `mutate`
 * callbacks — the established dual-callback split.
 */

/**
 * A commit is **never** retried (MET-1148).
 *
 * The `uploadRef` is consumed before the server verifies the stored object, and
 * a failed verification deletes that object. So a second attempt with the same
 * ref does not re-run the check — it returns `404 ERR_NOT_FOUND` against bytes
 * that no longer exist, replacing an accurate error with a confusing one.
 *
 * The recovery is to restart the whole upload from `…/upload-url` for a fresh
 * ref, which is exactly what the tabs' Submit already does.
 *
 * Stated per-mutation rather than as a client default because `App.tsx` owns
 * the `QueryClient` and is a protected file — the same reason
 * `partnerRetryPolicy` lives per-hook. React Query v5 defaults mutations to no
 * retry, so this is belt-and-braces: it is here so that adding a global
 * `defaultOptions.mutations.retry` later cannot silently turn one bad upload
 * into two misleading errors.
 */
const NEVER_RETRY = { retry: false } as const

export function usePartnerDocumentsQuery(params: DocumentListParams) {
  return useQuery<{ items: DocumentItem[] }>({
    // Params belong in the key so each sort/search view caches separately.
    queryKey: [...PARTNER_DOCUMENTS_QUERY_KEY, params],
    queryFn: () => partnerMediaService.listDocuments(params),
    enabled: tokenStore.hasSession(),
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/**
 * The photos + videos gallery.
 *
 * A freshly committed video is still transcoding, and the provider reports
 * readiness only when asked — there is no webhook. So this polls while anything
 * is `processing` and **stops on its own** once everything is `ready`, rather
 * than leaving a timer running on an idle gallery.
 */
export function usePartnerMediaQuery() {
  return useQuery<MediaGallery>({
    queryKey: PARTNER_MEDIA_QUERY_KEY,
    queryFn: partnerMediaService.getMedia,
    enabled: tokenStore.hasSession(),
    refetchInterval: (query) =>
      query.state.data?.videos.items.some((video) => video.status === 'processing')
        ? VIDEO_POLL_MS
        : false,
    ...partnerRetryPolicy,
  })
}

/** A document write can flip the count limit, so the list is re-read. */
function useDocumentsWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_DOCUMENTS_QUERY_KEY })
  }
}

/**
 * A gallery write is invalidated alongside **the J6A profile**.
 *
 * Adding the first photo or changing the cover writes `main_photo_key`, which is
 * what J6A's submission gate and header image read. Without this the partner
 * would set a cover and still see "cover photo required" on the submit gate.
 */
function useGalleryWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_MEDIA_QUERY_KEY })
    // `exact` matters: PARTNER_PROFILE_QUERY_KEY is ['partner','restaurant'], a
    // prefix of every sibling key in this module, and React Query invalidates by
    // prefix — so without it a cover change refetched all eight.
    void qc.invalidateQueries({ queryKey: PARTNER_PROFILE_QUERY_KEY, exact: true })
  }
}

export function useCommitDocumentMutation() {
  const invalidate = useDocumentsWriteCache()
  return useMutation({
    mutationFn: (body: CommitMediaDto) => partnerMediaService.commitDocument(body),
    onSuccess: invalidate,
    ...NEVER_RETRY,
  })
}

export function useDeleteDocumentMutation() {
  const invalidate = useDocumentsWriteCache()
  return useMutation({
    mutationFn: (mediaId: string) => partnerMediaService.deleteDocument(mediaId),
    onSuccess: invalidate,
  })
}

/**
 * Mints a presigned download URL. Deliberately no cache write: it expires in
 * about five minutes, so caching it would hand the partner a dead link.
 */
export function useDocumentDownloadMutation() {
  return useMutation({
    mutationFn: (mediaId: string) => partnerMediaService.documentDownloadUrl(mediaId),
  })
}

export function useCommitPhotoMutation() {
  const invalidate = useGalleryWriteCache()
  return useMutation({
    mutationFn: (body: CommitMediaDto) => partnerMediaService.commitPhoto(body),
    onSuccess: invalidate,
    ...NEVER_RETRY,
  })
}

export function useCommitVideoMutation() {
  const invalidate = useGalleryWriteCache()
  return useMutation({
    mutationFn: (body: CommitMediaDto) => partnerMediaService.commitVideo(body),
    onSuccess: invalidate,
  })
}

/**
 * Designating a cover reads no server state back.
 *
 * Everything that changes is already known: which photo carries the label, and
 * the URL the header shows. So both caches are patched in place and the toggle
 * costs **no** GET, where it used to refetch the gallery *and* the profile.
 *
 * The one exception is a restaurant gaining its **first** cover. That flips
 * `submissionReadiness`, whose `canSubmit` is a server-side derivation across
 * several fields the client cannot recompute — so that case, and only that case,
 * still re-reads the profile.
 */
export function useSetCoverPhotoMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string) => partnerMediaService.setCoverPhoto(mediaId),
    onSuccess: ({ mediaId }) => {
      const gallery = qc.getQueryData<MediaGallery>(PARTNER_MEDIA_QUERY_KEY)
      const hadCover = gallery?.photos.items.some((photo) => photo.isCover) ?? false
      const nextCoverUrl =
        gallery?.photos.items.find((photo) => photo.mediaId === mediaId)?.url ?? null

      if (gallery) {
        qc.setQueryData<MediaGallery>(PARTNER_MEDIA_QUERY_KEY, {
          ...gallery,
          photos: {
            ...gallery.photos,
            items: gallery.photos.items.map((photo) => ({
              ...photo,
              isCover: photo.mediaId === mediaId,
            })),
          },
        })
      }

      if (!hadCover) {
        void qc.invalidateQueries({ queryKey: PARTNER_PROFILE_QUERY_KEY, exact: true })
        return
      }

      qc.setQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY, (profile) =>
        profile && nextCoverUrl ? { ...profile, coverPhotoUrl: nextCoverUrl } : profile,
      )
    },
  })
}

export function useDeletePhotoMutation() {
  const invalidate = useGalleryWriteCache()
  return useMutation({
    mutationFn: (mediaId: string) => partnerMediaService.deletePhoto(mediaId),
    onSuccess: invalidate,
  })
}

export function useDeleteVideoMutation() {
  const invalidate = useGalleryWriteCache()
  return useMutation({
    mutationFn: (mediaId: string) => partnerMediaService.deleteVideo(mediaId),
    onSuccess: invalidate,
  })
}
