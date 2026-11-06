import { HttpResponse } from 'msw'
import {
  clearMockCoverPhoto as dropProfileCoverPhoto,
  errorResponse,
  mockProfile,
} from './partnerRestaurantProfile'
import { bytesMatchContentType, signatureFor } from './fileSignatures'
import { bucketQualifiedKey } from './uploadKeys'
import {
  clearMockCdnObjects,
  MOCK_CDN_ORIGIN,
  MOCK_STREAM_ORIGIN,
  putMockCdnObject,
} from './mockCdn'
import type {
  DocumentItem,
  PhotoItem,
  VideoItem,
} from '../../app/modules/restaurants/partnerMedia/types'

/**
 * J6B media fixtures — documents, photos and videos.
 *
 * Mirrors the real strictness rather than the happy path, because the awkward
 * branches are the ones worth catching in a test: the count limit refuses
 * *before* an upload target is issued, a bad sort is a 422, deleting the cover
 * while other photos exist is refused, and the first photo silently becomes the
 * cover — which is what lifts J6A's submission gate.
 *
 * The cover is stored in `mockProfile.mainPhotoKey`, the same field J6A's
 * readiness reads, so the cross-module behaviour is exercised end to end.
 */

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."

/** Config-driven in production; these stand in for the defaults. */
export const MOCK_LIMITS = {
  document: { maxBytes: 10 * 1024 * 1024, maxCount: 10 },
  photo: { maxBytes: 10 * 1024 * 1024, maxCount: 20 },
  video: { maxBytes: 200 * 1024 * 1024, maxCount: 5 },
} as const

export const MOCK_UPLOAD_ORIGIN = 'https://upload.mock.local'

interface StagedUpload {
  uploadRef: string
  kind: 'document' | 'photo' | 'video'
  /**
   * Recorded at step 1 and read back at commit, exactly as the server does —
   * which is why the commit body does not carry it (and 422s if it does).
   */
  name: string
  contentType: string
  /** Set once the bytes are PUT/POSTed, so commit can require a real upload. */
  received: boolean
  size: number
  /**
   * The stored object's leading bytes, which the commit inspects (MET-1148).
   * Empty until the upload lands — and still empty for a zero-byte file, which
   * is exactly why that case now fails.
   */
  leading: number[]
  /**
   * The whole object, kept so the commit can park it on the mock CDN and the
   * gallery shows the photo the partner actually picked.
   *
   * Null until the upload lands. The real API never round-trips the bytes like
   * this — it hands out a CloudFront URL for an object S3 already holds — so
   * nothing on the client side may depend on it.
   */
  bytes: ArrayBuffer | null
}

interface MockVideo extends VideoItem {
  /**
   * The provider reports readiness only when asked, so a freshly committed video
   * flips to `ready` after this many gallery reads — letting a test observe the
   * `processing` → `ready` transition the poll exists for.
   */
  readyAfterReads: number
}

let documents: DocumentItem[] = []
let photos: PhotoItem[] = []
let videos: MockVideo[] = []
let staged: StagedUpload[] = []
let galleryReads = 0
let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${String(idCounter)}`
}

function documentSeed(): DocumentItem[] {
  return [
    {
      mediaId: 'doc-1',
      name: 'Trade Licence 2026.pdf',
      type: 'PDF',
      size: 1258291,
      uploadedAt: '2026-05-01T09:12:00Z',
    },
    {
      mediaId: 'doc-2',
      name: 'Floor plan.png',
      type: 'PNG',
      // Predates J6B — neither field was recorded, so the UI must show a dash.
      size: null,
      uploadedAt: null,
    },
  ]
}

function photoSeed(): PhotoItem[] {
  return [
    {
      mediaId: 'photo-1',
      name: 'dining-room.jpg',
      url: `${MOCK_CDN_ORIGIN}/dining-room.jpg`,
      isCover: true,
      size: 2411724,
      uploadedAt: '2026-05-02T10:00:00Z',
      sortOrder: 1,
    },
    {
      mediaId: 'photo-2',
      name: 'bar.jpg',
      url: `${MOCK_CDN_ORIGIN}/bar.jpg`,
      isCover: false,
      size: 1911724,
      uploadedAt: '2026-05-03T10:00:00Z',
      sortOrder: 2,
    },
  ]
}

function videoSeed(): MockVideo[] {
  return [
    {
      mediaId: 'video-1',
      name: 'restaurant-walkthrough.mp4',
      status: 'ready',
      url: `${MOCK_STREAM_ORIGIN}/video-1.m3u8`,
      thumbnailUrl: `${MOCK_STREAM_ORIGIN}/video-1.jpg`,
      size: 50531860,
      uploadedAt: '2026-05-04T10:00:00Z',
      sortOrder: 1,
      readyAfterReads: 0,
    },
  ]
}

export function resetMockMedia(): void {
  documents = documentSeed()
  photos = photoSeed()
  videos = videoSeed()
  staged = []
  galleryReads = 0
  idCounter = 0
  // The seed URLs are back to serving placeholders, so anything an earlier
  // upload parked under them has to go with them.
  clearMockCdnObjects()
  mockProfile.mainPhotoKey = 'photos/dining-room.jpg'
}

resetMockMedia()

/**
 * Keeps the photos but leaves none designated — the state a restaurant is in
 * before it ever picks a cover, where a designation flips J6A's submission gate.
 */
export function clearMockCoverPhoto(): void {
  for (const photo of photos) photo.isCover = false
  dropProfileCoverPhoto()
}

/** Empties both galleries — for the empty-state and first-photo-cover paths. */
export function clearMockGallery(): void {
  photos = []
  videos = []
  dropProfileCoverPhoto()
}

export function setMockDocumentCount(count: number): void {
  documents = Array.from({ length: count }, (_, index) => ({
    mediaId: `doc-bulk-${String(index)}`,
    name: `Document ${String(index)}.pdf`,
    type: 'PDF',
    size: 1024,
    uploadedAt: '2026-05-01T09:12:00Z',
  }))
}

export function setMockPhotoCount(count: number): void {
  photos = Array.from({ length: count }, (_, index) => ({
    mediaId: `photo-bulk-${String(index)}`,
    name: `Photo ${String(index)}.jpg`,
    url: `${MOCK_CDN_ORIGIN}/bulk-${String(index)}.jpg`,
    isCover: index === 0,
    size: 1024,
    uploadedAt: '2026-05-02T10:00:00Z',
    sortOrder: index + 1,
  }))
  if (count > 0) mockProfile.mainPhotoKey = 'photos/bulk-0.jpg'
  else dropProfileCoverPhoto()
}

function readOnly(): Response | null {
  return mockProfile.status === 'PENDING'
    ? errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
    : null
}

// ── Documents ──────────────────────────────────────────────────
const SORT_FIELDS = ['name', 'type', 'size']
const SORT_ORDERS = ['asc', 'desc']

export function listMockDocuments(query: {
  sortBy: string | null
  sortOrder: string | null
  search: string | null
}): Response {
  // A bad param is a 422, never a silent fallback.
  if (query.sortBy && !SORT_FIELDS.includes(query.sortBy)) {
    return errorResponse('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
  }
  if (query.sortOrder && !SORT_ORDERS.includes(query.sortOrder)) {
    return errorResponse('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
  }

  let items = [...documents]

  // Name only — Type and Size are sortable but deliberately not searchable.
  const search = query.search?.trim().toLowerCase()
  if (search) {
    items = items.filter((item) => item.name.toLowerCase().includes(search))
  }

  const field = (query.sortBy ?? 'name') as 'name' | 'type' | 'size'
  const descending = query.sortOrder === 'desc'
  items.sort((a, b) => {
    const compared =
      field === 'size'
        ? (a.size ?? 0) - (b.size ?? 0)
        : String(a[field]).localeCompare(String(b[field]))
    return descending ? -compared : compared
  })

  return HttpResponse.json({ success: true, data: { items } })
}

// ── Upload targets (step 1) ────────────────────────────────────
const COUNT_OF: Record<StagedUpload['kind'], () => number> = {
  document: () => documents.length,
  photo: () => photos.length,
  video: () => videos.length,
}

const LIMIT_MESSAGE: Record<StagedUpload['kind'], string> = {
  document: "You've reached the maximum number of documents.",
  photo: "You've reached the maximum number of photos.",
  video: "You've reached the maximum number of videos.",
}

/**
 * Issues an upload target, refusing at the count limit **before** one exists —
 * so a refused upload never moves any bytes.
 *
 * A video target carries no `key`: it has no S3 object. That absence is the
 * client's discriminator for which upload protocol to use.
 *
 * The key a document or photo target does carry is **bucket-qualified**
 * (MET-1147) — see {@link bucketQualifiedKey}. It is an echo only: the bytes go
 * to `uploadUrl` and the commit carries `uploadRef`, so nothing downstream reads
 * it. Emitted in the qualified form regardless, so these fixtures cannot certify
 * a client against a shape the deployed API no longer returns.
 */
export function mockUploadTarget(
  kind: StagedUpload['kind'],
  body: Record<string, unknown>,
): Response {
  const blocked = readOnly()
  if (blocked) return blocked

  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const name = typeof body.name === 'string' ? body.name : ''
  if (!name || !contentType) {
    return errorResponse('ERR_VALIDATION', 'A name and content type are required.', 422)
  }

  if (COUNT_OF[kind]() >= MOCK_LIMITS[kind].maxCount) {
    return errorResponse('ERR_MEDIA_LIMIT_REACHED', LIMIT_MESSAGE[kind], 409)
  }

  const uploadRef = nextId('u')
  // The name and the declared type are kept here, against the ref — the commit
  // never sends them again, and the type is what the stored bytes are later
  // checked against (MET-1148).
  staged.push({
    uploadRef,
    kind,
    name,
    contentType,
    received: false,
    size: 0,
    leading: [],
    bytes: null,
  })

  return HttpResponse.json({
    success: true,
    data: {
      uploadUrl: `${MOCK_UPLOAD_ORIGIN}/${uploadRef}`,
      uploadRef,
      maxBytes: MOCK_LIMITS[kind].maxBytes,
      ...(kind === 'video'
        ? {}
        : { key: bucketQualifiedKey(kind, uploadRef, name), expiresInSeconds: 900 }),
    },
  })
}

/**
 * Step 2 — the direct PUT/POST. Records that the bytes actually landed.
 *
 * S3 stores whatever it is given: the signature is kept, not judged. The
 * verification happens at commit, which is the whole point — a presigned PUT
 * cannot enforce content any more than it can enforce Content-Length.
 */
export function receiveMockUpload(
  uploadRef: string,
  size: number,
  leading?: number[],
  bytes?: ArrayBuffer,
): Response {
  const entry = staged.find((item) => item.uploadRef === uploadRef)
  if (!entry) return new HttpResponse(null, { status: 403 })
  entry.received = true
  entry.size = size
  // Kept for the commit to park on the mock CDN. Omitted by tests that stub an
  // upload without a body, which simply get the placeholder image instead.
  entry.bytes = bytes ?? null
  // Omitted means "bytes that match what was declared" — the ordinary upload, so
  // a test not exercising verification does not have to hand-roll magic bytes.
  // Pass `[]` for the zero-byte case, or another type's signature for a mismatch.
  entry.leading = leading ?? [...(signatureFor(entry.contentType) ?? [0x00])]
  return new HttpResponse(null, { status: 200 })
}

// ── Commits (step 3) ───────────────────────────────────────────
/**
 * The commit body is `{ uploadRef }` and nothing else.
 *
 * The real API rejects unknown request fields rather than ignoring them, and
 * these fixtures previously did the opposite — reading `name` off the commit body
 * and tolerating whatever else it carried. That is precisely how a client sending
 * `{ uploadRef, name }` passed the whole suite and then 422'd against the live
 * API. Mirroring the strictness here is what keeps that from recurring.
 */
function rejectUnknownCommitFields(body: Record<string, unknown>): Response | null {
  if (typeof body.uploadRef !== 'string' || !body.uploadRef) {
    return errorResponse('ERR_VALIDATION', 'An uploadRef is required.', 422)
  }

  const extras = Object.keys(body).filter((key) => key !== 'uploadRef')
  if (extras.length > 0) {
    return errorResponse(
      'ERR_VALIDATION',
      `Property ${extras.join(', ')} is not allowed on this request.`,
      422,
    )
  }

  return null
}

/**
 * The section-specific copy the spec mandates, carried in `details.message`.
 *
 * The top-level `message` stays the generic catalogue string for the code — the
 * split is the point, and a client that reads only the top level shows the
 * partner strictly less than was sent (MET-1148).
 */
const BAD_TYPE_DETAIL: Record<StagedUpload['kind'], string> = {
  document: 'Only PDF, DOCX, JPG or PNG documents are allowed.',
  photo: 'Only JPG or PNG photos are allowed.',
  video: 'Only MP4 videos are allowed.',
}

const BAD_TYPE_GENERIC = "This file type isn't supported for this section."

function takeStaged(
  kind: StagedUpload['kind'],
  body: Record<string, unknown>,
): StagedUpload | Response {
  const rejected = rejectUnknownCommitFields(body)
  if (rejected) return rejected

  const blocked = readOnly()
  if (blocked) return blocked

  const entry = staged.find((item) => item.uploadRef === body.uploadRef && item.kind === kind)

  /*
   * A ref that is simply gone is a 404, not a 422 (MET-1148).
   *
   * This is the shape a *retried* commit sees: the first attempt consumed the
   * ref and the failed verification deleted the object, so there is nothing left
   * to check. Answering 422 again would invite the client to keep retrying
   * something that can never succeed.
   */
  if (!entry) {
    return errorResponse('ERR_NOT_FOUND', 'No upload was found for that reference.', 404)
  }
  // Staged but never uploaded is the server's HEAD finding nothing.
  if (!entry.received) {
    return errorResponse('ERR_VALIDATION', 'No uploaded object for that reference.', 422)
  }

  /*
   * Consumed *before* verification, exactly as the server does.
   *
   * This ordering is the whole reason a failed commit must not be retried: the
   * ref is spent whatever the outcome, so a second attempt falls into the 404
   * above rather than re-running the check.
   */
  staged = staged.filter((item) => item !== entry)

  if (entry.size > MOCK_LIMITS[kind].maxBytes) {
    return errorResponse('ERR_MEDIA_TOO_LARGE', 'This file is larger than the limit.', 413)
  }

  // The stored object's real bytes, not the type declared at step 1. On a
  // mismatch the server deletes the object — which the line above already did.
  if (!bytesMatchContentType(entry.leading, entry.contentType)) {
    return errorResponse('ERR_MEDIA_TYPE', BAD_TYPE_GENERIC, 422, {
      contentType: entry.contentType,
      message: BAD_TYPE_DETAIL[kind],
    })
  }

  return entry
}

function isResponse(value: StagedUpload | Response): value is Response {
  return value instanceof Response
}

const NOW = '2026-08-11T10:00:00Z'

export function commitMockDocument(body: Record<string, unknown>): Response {
  const entry = takeStaged('document', body)
  if (isResponse(entry)) return entry

  // From step 1, never from this request.
  const { name } = entry
  const item: DocumentItem = {
    mediaId: nextId('doc'),
    name,
    type: (name.split('.').pop() ?? '').toUpperCase(),
    size: entry.size,
    uploadedAt: NOW,
  }
  documents.push(item)
  return HttpResponse.json({ success: true, data: item }, { status: 201 })
}

export function commitMockPhoto(body: Record<string, unknown>): Response {
  const entry = takeStaged('photo', body)
  if (isResponse(entry)) return entry

  // The first photo silently becomes the cover, which is what unblocks J6A's
  // submission gate — so it is reported back for the client to surface.
  const becameCover = mockProfile.mainPhotoKey === null
  const { name } = entry
  const mediaId = nextId('photo')
  // Always `.jpg`, whatever was uploaded — the cover key is built from the same
  // shape, and the served Content-Type is what decides how it renders.
  const url = `${MOCK_CDN_ORIGIN}/${mediaId}.jpg`

  // Stands in for the object S3 is now holding, so the gallery shows the file
  // that was picked rather than a URL pointing at nothing.
  if (entry.bytes) putMockCdnObject(url, entry.bytes, entry.contentType)

  photos.push({
    mediaId,
    name,
    url,
    isCover: becameCover,
    size: entry.size,
    uploadedAt: NOW,
    sortOrder: photos.length + 1,
  })
  if (becameCover) mockProfile.mainPhotoKey = `photos/${mediaId}.jpg`

  return HttpResponse.json(
    {
      success: true,
      data: {
        mediaId,
        url,
        isCover: becameCover,
        // Returned so the client never needs to have sent it.
        name,
        size: entry.size,
        uploadedAt: NOW,
        becameCover,
      },
    },
    { status: 201 },
  )
}

export function commitMockVideo(body: Record<string, unknown>): Response {
  const entry = takeStaged('video', body)
  if (isResponse(entry)) return entry

  const { name } = entry
  const mediaId = nextId('video')
  videos.push({
    mediaId,
    name,
    status: 'processing',
    url: null,
    thumbnailUrl: null,
    size: entry.size,
    uploadedAt: NOW,
    sortOrder: videos.length + 1,
    // Ready on the next gallery read, so one poll observes the transition.
    readyAfterReads: galleryReads + 1,
  })

  return HttpResponse.json(
    {
      success: true,
      data: { mediaId, name, status: 'processing', size: entry.size, uploadedAt: NOW },
    },
    { status: 201 },
  )
}

// ── Gallery ────────────────────────────────────────────────────
/** Strips the fixture-only bookkeeping the API would never return. */
function toVideoItem({ readyAfterReads, ...item }: MockVideo): VideoItem {
  void readyAfterReads
  return item
}

export function mockGalleryResponse(): Response {
  galleryReads += 1

  const items: VideoItem[] = videos.map((video) => {
    // Flips on the read that reaches its threshold, so a poll observes the
    // processing → ready transition exactly once.
    if (video.status === 'processing' && galleryReads >= video.readyAfterReads) {
      video.status = 'ready'
      video.url = `${MOCK_STREAM_ORIGIN}/${video.mediaId}.m3u8`
      // No poster is generated from the uploaded MP4 — the mock CDN serves a
      // placeholder for it, which is what the provider's own thumbnail stands
      // in for here anyway.
      video.thumbnailUrl = `${MOCK_STREAM_ORIGIN}/${video.mediaId}.jpg`
    }
    return toVideoItem(video)
  })

  return HttpResponse.json({
    success: true,
    data: {
      photos: { count: photos.length, max: MOCK_LIMITS.photo.maxCount, items: photos },
      videos: { count: videos.length, max: MOCK_LIMITS.video.maxCount, items },
    },
  })
}

// ── Download, cover, delete ────────────────────────────────────
export function mockDownloadUrl(mediaId: string): Response {
  if (!documents.some((item) => item.mediaId === mediaId)) {
    return errorResponse('ERR_NOT_FOUND', 'Document not found.', 404)
  }
  return HttpResponse.json({
    success: true,
    // Short-lived by design: re-requested on every click, never cached.
    data: { downloadUrl: `${MOCK_UPLOAD_ORIGIN}/signed-get/${mediaId}`, expiresInSeconds: 300 },
  })
}

export function deleteMockDocument(mediaId: string): Response {
  const blocked = readOnly()
  if (blocked) return blocked
  if (!documents.some((item) => item.mediaId === mediaId)) {
    return errorResponse('ERR_NOT_FOUND', 'Document not found.', 404)
  }
  // The entry leaves the array; the stored object is retained (BR-10).
  documents = documents.filter((item) => item.mediaId !== mediaId)
  return HttpResponse.json({ success: true, data: { mediaId, removed: true } })
}

export function setMockCoverPhoto(mediaId: string): Response {
  const blocked = readOnly()
  if (blocked) return blocked
  const photo = photos.find((item) => item.mediaId === mediaId)
  if (!photo) return errorResponse('ERR_NOT_FOUND', 'Photo not found.', 404)

  // No separate cover store — the previous cover simply stops matching.
  photos = photos.map((item) => ({ ...item, isCover: item.mediaId === mediaId }))
  mockProfile.mainPhotoKey = `photos/${mediaId}.jpg`
  return HttpResponse.json({ success: true, data: { mediaId, isCover: true } })
}

export function deleteMockPhoto(mediaId: string): Response {
  const blocked = readOnly()
  if (blocked) return blocked
  const photo = photos.find((item) => item.mediaId === mediaId)
  if (!photo) return errorResponse('ERR_NOT_FOUND', 'Photo not found.', 404)

  // Removing the cover while others remain would leave the restaurant with no
  // cover and no obvious replacement, so a new one must be designated first.
  if (photo.isCover && photos.length > 1) {
    return errorResponse(
      'ERR_COVER_PHOTO_REASSIGN',
      'Please set a new cover photo before deleting this one.',
      409,
    )
  }

  photos = photos.filter((item) => item.mediaId !== mediaId)
  // Deleting the only photo is allowed and clears the cover, which re-blocks
  // submission on J6A's side — and takes the restaurant off the app with it,
  // since visibility cannot stand without a cover photo (MET-1255).
  if (photo.isCover) dropProfileCoverPhoto()

  return HttpResponse.json({ success: true, data: { mediaId, removed: true } })
}

export function deleteMockVideo(mediaId: string): Response {
  const blocked = readOnly()
  if (blocked) return blocked
  if (!videos.some((item) => item.mediaId === mediaId)) {
    return errorResponse('ERR_NOT_FOUND', 'Video not found.', 404)
  }
  videos = videos.filter((item) => item.mediaId !== mediaId)
  return HttpResponse.json({ success: true, data: { mediaId, removed: true } })
}
