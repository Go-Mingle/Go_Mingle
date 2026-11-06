import type { DOCUMENT_SORT_FIELDS, SORT_ORDERS } from './constants'

/** Which tab a piece of media belongs to, and which upload flow it uses. */
export type MediaKind = 'document' | 'photo' | 'video'

export type DocumentSortBy = (typeof DOCUMENT_SORT_FIELDS)[number]
export type SortOrder = (typeof SORT_ORDERS)[number]

/**
 * Documents list params.
 *
 * There is deliberately no `searchField`: search matches the document **name
 * only**. Type and Size are sortable but not searchable, so the design's Type
 * filter-funnel and Size search are dropped (spec appendix).
 */
export interface DocumentListParams {
  sortBy?: DocumentSortBy
  sortOrder?: SortOrder
  search?: string
}

/**
 * `size` and `uploadedAt` are nullable: both were added to the media entry by
 * J6B, so anything uploaded before it has neither. Render a dash — never a
 * fabricated date or `0 B`.
 */
interface MediaItemBase {
  mediaId: string
  name: string
  /** Raw bytes. */
  size: number | null
  /** UTC ISO-8601, converted to Asia/Karachi for display (F1 BR-15). */
  uploadedAt: string | null
}

export interface DocumentItem extends MediaItemBase {
  /** Derived server-side from the content type, e.g. `PDF`. */
  type: string
}

export interface PhotoItem extends MediaItemBase {
  /** Public CloudFront URL — cacheable and safe in an `<img src>`. */
  url: string
  isCover: boolean
  /** Display order within the tab. Returned but read-only in this release. */
  sortOrder: number
}

/** `processing` while the provider transcodes; `ready` once playable. */
export type VideoStatus = 'processing' | 'ready'

export interface VideoItem extends MediaItemBase {
  status: VideoStatus
  /** Both null until `status` is `ready`. Absence is expected, not an error. */
  url: string | null
  thumbnailUrl: string | null
  sortOrder: number
}

/**
 * `count`/`max` drive the "X of N" indicators. `max` is config-driven per
 * environment, so it is read from here rather than hardcoded.
 */
export interface MediaCollection<T> {
  count: number
  max: number
  items: T[]
}

export interface MediaGallery {
  photos: MediaCollection<PhotoItem>
  videos: MediaCollection<VideoItem>
}

/**
 * A file picked but not yet uploaded — one entry of BR-07's preview step.
 *
 * Staged media is always a list, even where only one entry can exist: the photo
 * picker is multi-select (a partner building a gallery picks a set, not a file),
 * and one shape for both keeps a single preview modal serving all three kinds.
 */
export interface StagedFile {
  /** Stable list key — two picks can share a filename, so the name will not do. */
  id: string
  file: File
  /** Object URL for an image/video thumbnail; documents have none. Revoke on removal. */
  previewUrl?: string
}

/**
 * Step 1's request body — and the **only** place a filename is sent.
 *
 * The server records `name` and `contentType` against the `uploadRef` it issues,
 * so the commit does not repeat them. See {@link CommitMediaDto}.
 */
export interface UploadTargetRequest {
  name: string
  contentType: string
}

/**
 * Step 1 of the upload. The response shape differs by kind, deliberately:
 * documents and photos carry a `key` (an S3 object), a video does not — "a
 * video has no S3 object". That absence is the discriminator for which upload
 * protocol the target expects, and is asserted before any bytes are sent.
 */
export interface UploadTarget {
  /**
   * The complete, provider-issued target. The bytes go here **verbatim** — the
   * object key is already embedded in the presigned signature, so building this
   * URL from a host and {@link UploadTarget.key} would double-prefix it and 403.
   */
  uploadUrl: string
  uploadRef: string
  /** Authoritative size limit for this kind; the client pre-checks against it. */
  maxBytes: number
  /**
   * Present for documents and photos; absent for videos.
   *
   * **Opaque, and read for its presence only.** It is an echo for correlation
   * and debugging — nothing here displays, stores or compares it, and nothing
   * derives the upload target from it.
   *
   * Treated that way deliberately: MET-1147 bucket-qualified this field on the
   * wire (`restaurants/{id}/…` → `restaurant-documents/restaurants/{id}/…`)
   * while the stored object key stayed bare, and the prefix is whatever
   * `S3_BUCKET_RESTAURANT_*` holds — so an env-prefixed bucket
   * (`gomingle-dev-restaurant-documents`) is equally valid. Any code that parses
   * or asserts on this shape is wrong the next time the buckets are renamed.
   */
  key?: string
  expiresInSeconds?: number
}

/**
 * Step 3, identical for all three kinds: the `uploadRef` and **nothing else**.
 *
 * The API rejects unknown request fields rather than ignoring them, so adding
 * anything here — `name`, `contentType`, `key`, `size`, `mediaId` — is a 422 and
 * the upload never completes. None of them is needed: the server already
 * recorded the filename and content type against this ref at step 1
 * ({@link UploadTargetRequest}).
 *
 * That split is the point, not an accident. Because the ref is the only thing
 * presented here, a caller cannot commit a file it was never issued a target
 * for, and cannot change the name or type between requesting the upload and
 * confirming it.
 */
export interface CommitMediaDto {
  uploadRef: string
}

export interface DocumentCommitResponse extends DocumentItem {
  mediaId: string
}

export interface PhotoCommitResponse {
  mediaId: string
  url: string
  isCover: boolean
  /** Echoed back from what step 1 recorded, so nothing is lost by not sending it. */
  name: string
  size: number | null
  uploadedAt: string | null
  /**
   * True when this upload became the cover because the restaurant had none.
   * Worth surfacing: a cover photo is required to submit, so a first photo
   * lifts J6A's submission gate as a side effect.
   */
  becameCover?: boolean
}

export interface VideoCommitResponse {
  mediaId: string
  name: string
  status: VideoStatus
  size: number | null
  uploadedAt: string | null
}

export interface DownloadUrlResponse {
  downloadUrl: string
  expiresInSeconds: number
}

export interface RemovedResponse {
  mediaId: string
  removed: boolean
}

export interface CoverResponse {
  mediaId: string
  isCover: boolean
}
