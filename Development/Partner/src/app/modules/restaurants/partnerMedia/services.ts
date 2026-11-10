import { httpClient } from '../../../../shared/api/httpClient'
import { DOCUMENT_SORT_FIELDS, PARTNER_MEDIA_ENDPOINTS, SORT_ORDERS } from './constants'
import type {
  CommitMediaDto,
  CoverResponse,
  DocumentCommitResponse,
  DocumentItem,
  DocumentListParams,
  DownloadUrlResponse,
  MediaGallery,
  PhotoCommitResponse,
  RemovedResponse,
  UploadTarget,
  UploadTargetRequest,
  VideoCommitResponse,
} from './types'

/**
 * Drops anything the documents list endpoint would reject.
 *
 * These params reach the URL, and a bad `sortBy`/`sortOrder` is a **422 rather
 * than a silent fallback** — so an unrecognised value is removed before it is
 * sent. Same guard as J5's `sanitiseLedgerParams` and J6A's
 * `sanitiseContactsParams`.
 *
 * There is no `searchField`: search matches the document name only.
 */
export function sanitiseDocumentParams(params: DocumentListParams): DocumentListParams {
  const clean: DocumentListParams = {}

  if (params.sortBy && DOCUMENT_SORT_FIELDS.includes(params.sortBy)) {
    clean.sortBy = params.sortBy
  }
  if (params.sortOrder && SORT_ORDERS.includes(params.sortOrder)) {
    clean.sortOrder = params.sortOrder
  }

  const search = params.search?.trim()
  if (search) clean.search = search

  return clean
}

function documentsQueryString(params: DocumentListParams): string {
  const query = new URLSearchParams()
  const clean = sanitiseDocumentParams(params)

  if (clean.sortBy) query.set('sortBy', clean.sortBy)
  if (clean.sortOrder) query.set('sortOrder', clean.sortOrder)
  if (clean.search) query.set('search', clean.search)

  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export const partnerMediaService = {
  // ── Documents ────────────────────────────────────────────────
  listDocuments: (params: DocumentListParams = {}): Promise<{ items: DocumentItem[] }> =>
    httpClient.get<{ items: DocumentItem[] }>(
      `${PARTNER_MEDIA_ENDPOINTS.documents}${documentsQueryString(params)}`,
    ),

  /**
   * Step 1 for a document. The count limit is enforced here, before any upload
   * target is issued, so a refused upload never moves bytes.
   *
   * This is also the only call that carries the filename — the server keeps it
   * against the `uploadRef` it returns.
   */
  documentUploadTarget: (body: UploadTargetRequest): Promise<UploadTarget> =>
    httpClient.post<UploadTarget>(PARTNER_MEDIA_ENDPOINTS.documentUploadUrl, body),

  /**
   * Step 3. Presents the `uploadRef` and nothing else; the server re-verifies
   * the stored object's size and type and reads the name back from step 1.
   */
  commitDocument: (body: CommitMediaDto): Promise<DocumentCommitResponse> =>
    httpClient.post<DocumentCommitResponse>(PARTNER_MEDIA_ENDPOINTS.documents, body),

  /**
   * A short-lived presigned S3 GET (~300s), never a public URL.
   *
   * Requested per click and never cached or parked in a `src` — it expires, and
   * a stale URL fails in a way that looks like a permissions bug.
   */
  documentDownloadUrl: (mediaId: string): Promise<DownloadUrlResponse> =>
    httpClient.get<DownloadUrlResponse>(PARTNER_MEDIA_ENDPOINTS.documentDownloadUrl(mediaId)),

  deleteDocument: (mediaId: string): Promise<RemovedResponse> =>
    httpClient.delete<RemovedResponse>(PARTNER_MEDIA_ENDPOINTS.documentById(mediaId)),

  // ── Gallery ──────────────────────────────────────────────────
  /** Photos and videos together, with the config-driven `count`/`max` per kind. */
  getMedia: (): Promise<MediaGallery> =>
    httpClient.get<MediaGallery>(PARTNER_MEDIA_ENDPOINTS.media),

  // ── Photos ───────────────────────────────────────────────────
  photoUploadTarget: (body: UploadTargetRequest): Promise<UploadTarget> =>
    httpClient.post<UploadTarget>(PARTNER_MEDIA_ENDPOINTS.photoUploadUrl, body),

  /** May return `becameCover` when the restaurant had no cover (AC-03.3). */
  commitPhoto: (body: CommitMediaDto): Promise<PhotoCommitResponse> =>
    httpClient.post<PhotoCommitResponse>(PARTNER_MEDIA_ENDPOINTS.photos, body),

  /**
   * Writes `main_photo_key`. There is no separate cover store — the previous
   * cover simply stops matching — so callers refresh the gallery rather than
   * tracking the flag locally.
   */
  setCoverPhoto: (mediaId: string): Promise<CoverResponse> =>
    httpClient.patch<CoverResponse>(PARTNER_MEDIA_ENDPOINTS.photoCover(mediaId), {}),

  /** Refused with `ERR_COVER_PHOTO_REASSIGN` if this is the cover and others exist. */
  deletePhoto: (mediaId: string): Promise<RemovedResponse> =>
    httpClient.delete<RemovedResponse>(PARTNER_MEDIA_ENDPOINTS.photoById(mediaId)),

  // ── Videos ───────────────────────────────────────────────────
  /** Returns a provider upload target; carries no `key` (a video has no S3 object). */
  videoUploadTarget: (body: UploadTargetRequest): Promise<UploadTarget> =>
    httpClient.post<UploadTarget>(PARTNER_MEDIA_ENDPOINTS.videoUploadUrl, body),

  /**
   * Commits with the same ref-only body as the other kinds — nothing the
   * provider returned is sent back, and neither is the filename. The backend
   * holds the `uploadRef` → asset mapping, resolves the `videoAssetId` from the
   * provider, and reads the real byte size from it.
   */
  commitVideo: (body: CommitMediaDto): Promise<VideoCommitResponse> =>
    httpClient.post<VideoCommitResponse>(PARTNER_MEDIA_ENDPOINTS.videos, body),

  deleteVideo: (mediaId: string): Promise<RemovedResponse> =>
    httpClient.delete<RemovedResponse>(PARTNER_MEDIA_ENDPOINTS.videoById(mediaId)),
}
