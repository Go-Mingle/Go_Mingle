import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockGallery,
  receiveMockUpload,
  resetMockMedia,
  setMockDocumentCount,
  setMockPhotoCount,
  MOCK_LIMITS,
} from '../../../../../mocks/data/partnerMedia'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../constants'
import { partnerMediaService, sanitiseDocumentParams } from '../services'
import type { CommitMediaDto } from '../types'

beforeEach(() => {
  resetMockProfile()
  resetMockMedia()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('sanitiseDocumentParams', () => {
  /**
   * These params reach the URL and a bad value is a 422, not a silent fallback,
   * so anything unrecognised is dropped before it is sent.
   */
  it.each([
    ['an unknown sort field', { sortBy: 'uploadedAt' }],
    ['an unknown order', { sortOrder: 'sideways' }],
    ['a searchField that does not exist on this endpoint', { searchField: 'type' }],
  ])('drops %s', (_label, params) => {
    expect(sanitiseDocumentParams(params as never)).toEqual({})
  })

  it.each(['name', 'type', 'size'] as const)('keeps the %s sort field', (sortBy) => {
    expect(sanitiseDocumentParams({ sortBy })).toEqual({ sortBy })
  })

  it.each(['asc', 'desc'] as const)('keeps the %s order', (sortOrder) => {
    expect(sanitiseDocumentParams({ sortOrder })).toEqual({ sortOrder })
  })

  it('trims the search term and drops it when blank', () => {
    expect(sanitiseDocumentParams({ search: '  licence  ' })).toEqual({ search: 'licence' })
    expect(sanitiseDocumentParams({ search: '   ' })).toEqual({})
  })

  it('keeps a valid combination intact', () => {
    expect(sanitiseDocumentParams({ sortBy: 'size', sortOrder: 'desc', search: 'plan' })).toEqual({
      sortBy: 'size',
      sortOrder: 'desc',
      search: 'plan',
    })
  })
})

describe('listDocuments', () => {
  it('returns the seeded documents', async () => {
    const { items } = await partnerMediaService.listDocuments()
    expect(items.length).toBeGreaterThan(0)
  })

  it('sends only sanitised params', async () => {
    let search = ''
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )

    await partnerMediaService.listDocuments({ sortBy: 'size', sortOrder: 'desc', search: 'plan' })
    expect(search).toContain('sortBy=size')
    expect(search).toContain('sortOrder=desc')
    expect(search).toContain('search=plan')
    // No searchField: search is name-only by design.
    expect(search).not.toContain('searchField')
  })

  it('omits the query string entirely with no params', async () => {
    let url = ''
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, ({ request }) => {
        url = request.url
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )

    await partnerMediaService.listDocuments()
    expect(url).not.toContain('?')
  })

  it('sorts by size numerically, not as text', async () => {
    const { items } = await partnerMediaService.listDocuments({ sortBy: 'size', sortOrder: 'desc' })
    const sizes = items.map((item) => item.size ?? 0)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('matches the name only', async () => {
    const { items } = await partnerMediaService.listDocuments({ search: 'Floor' })
    expect(items.map((item) => item.name)).toEqual(['Floor plan.png'])
  })

  /** A bad param is rejected rather than quietly defaulted. */
  it('surfaces a 422 when a bad sort reaches the server', async () => {
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'Invalid sort.' } },
          { status: 422 },
        ),
      ),
    )

    const error = (await partnerMediaService.listDocuments().catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_VALIDATION')
  })
})

describe('upload targets', () => {
  /** Documents and photos address an S3 object, so they carry a key. */
  it.each([
    [
      'document',
      () =>
        partnerMediaService.documentUploadTarget({ name: 'a.pdf', contentType: 'application/pdf' }),
    ],
    [
      'photo',
      () => partnerMediaService.photoUploadTarget({ name: 'a.jpg', contentType: 'image/jpeg' }),
    ],
  ] as const)('returns a key for a %s', async (_label, call) => {
    const target = await call()
    expect(target.key).toBeTruthy()
    expect(target.maxBytes).toBeGreaterThan(0)
    expect(target.uploadRef).toBeTruthy()
  })

  /**
   * The fixture-contract check for MET-1147, and the only place a key's shape is
   * asserted anywhere in the app.
   *
   * The wire key is bucket-qualified — `restaurant-documents/restaurants/{id}/…`
   * for a document, `restaurant-multimedia/…` for a photo — while the stored S3
   * object key stays bare. Pinned here so the fixtures cannot quietly drift back
   * to the pre-fix form and certify a client against a shape the deployed API no
   * longer returns.
   *
   * Nothing in `src/app` may do this: the bucket segment is whatever
   * `S3_BUCKET_RESTAURANT_*` holds, so an env-prefixed deployment is equally
   * valid and a production shape check would refuse every upload there.
   */
  it.each([
    ['document', 'restaurant-documents', 'documents', '.pdf'],
    ['photo', 'restaurant-multimedia', 'photos', '.jpg'],
  ] as const)('bucket-qualifies the %s key (MET-1147)', async (kind, bucket, folder, extension) => {
    const target =
      kind === 'document'
        ? await partnerMediaService.documentUploadTarget({
            name: `a${extension}`,
            contentType: 'application/pdf',
          })
        : await partnerMediaService.photoUploadTarget({
            name: `a${extension}`,
            contentType: 'image/jpeg',
          })

    expect(target.key).toBe(
      `${bucket}/restaurants/rest-1/${folder}/${target.uploadRef}${extension}`,
    )
  })

  /** A video has no S3 object — the absent key is the protocol discriminator. */
  it('returns no key for a video', async () => {
    const target = await partnerMediaService.videoUploadTarget({
      name: 'a.mp4',
      contentType: 'video/mp4',
    })
    expect(target.key).toBeUndefined()
    expect(target.uploadRef).toBeTruthy()
  })

  it('reports the kind-specific size limit', async () => {
    const photo = await partnerMediaService.photoUploadTarget({
      name: 'a.jpg',
      contentType: 'image/jpeg',
    })
    const video = await partnerMediaService.videoUploadTarget({
      name: 'a.mp4',
      contentType: 'video/mp4',
    })

    expect(photo.maxBytes).toBe(MOCK_LIMITS.photo.maxBytes)
    expect(video.maxBytes).toBe(MOCK_LIMITS.video.maxBytes)
  })

  /** Refused before a target exists, so no bytes can be sent for it. */
  it.each([
    [
      'documents',
      () => setMockDocumentCount(MOCK_LIMITS.document.maxCount),
      () =>
        partnerMediaService.documentUploadTarget({ name: 'a.pdf', contentType: 'application/pdf' }),
    ],
    [
      'photos',
      () => setMockPhotoCount(MOCK_LIMITS.photo.maxCount),
      () => partnerMediaService.photoUploadTarget({ name: 'a.jpg', contentType: 'image/jpeg' }),
    ],
  ] as const)('409s at the %s count limit', async (_label, fill, call) => {
    fill()
    const error = (await call().catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_MEDIA_LIMIT_REACHED')
  })

  it('422s without a name or content type', async () => {
    const error = (await partnerMediaService
      .documentUploadTarget({ name: '', contentType: '' })
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(422)
  })
})

describe('the gallery read', () => {
  it('returns photos and videos with config-driven maxima', async () => {
    const gallery = await partnerMediaService.getMedia()

    expect(gallery.photos.max).toBe(MOCK_LIMITS.photo.maxCount)
    expect(gallery.videos.max).toBe(MOCK_LIMITS.video.maxCount)
    expect(gallery.photos.count).toBe(gallery.photos.items.length)
  })

  it('marks exactly one photo as the cover', async () => {
    const gallery = await partnerMediaService.getMedia()
    expect(gallery.photos.items.filter((photo) => photo.isCover)).toHaveLength(1)
  })

  it('never includes a document', async () => {
    const gallery = await partnerMediaService.getMedia()
    const names = [...gallery.photos.items, ...gallery.videos.items].map((item) => item.name)
    expect(names).not.toContain('Trade Licence 2026.pdf')
  })

  it('reports an empty gallery honestly rather than omitting the keys', async () => {
    clearMockGallery()
    const gallery = await partnerMediaService.getMedia()

    expect(gallery.photos).toMatchObject({ count: 0, items: [] })
    expect(gallery.videos).toMatchObject({ count: 0, items: [] })
  })
})

describe('cover designation', () => {
  it('moves the cover and clears the previous one', async () => {
    await partnerMediaService.setCoverPhoto('photo-2')
    const gallery = await partnerMediaService.getMedia()

    expect(gallery.photos.items.find((p) => p.mediaId === 'photo-2')?.isCover).toBe(true)
    expect(gallery.photos.items.find((p) => p.mediaId === 'photo-1')?.isCover).toBe(false)
  })

  it('404s for a photo that does not exist', async () => {
    const error = (await partnerMediaService
      .setCoverPhoto('nope')
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(404)
  })
})

describe('deletion', () => {
  /** The entry leaves the array; the stored object is retained (BR-10). */
  it('removes a document entry', async () => {
    await partnerMediaService.deleteDocument('doc-1')
    const { items } = await partnerMediaService.listDocuments()
    expect(items.map((item) => item.mediaId)).not.toContain('doc-1')
  })

  it('removes a non-cover photo without complaint', async () => {
    await expect(partnerMediaService.deletePhoto('photo-2')).resolves.toMatchObject({
      removed: true,
    })
  })

  /**
   * Deleting the cover while others remain would leave the restaurant with no
   * cover and no obvious replacement, so a new one must be chosen first (BR-11).
   */
  it('refuses to delete the cover while other photos exist', async () => {
    const error = (await partnerMediaService
      .deletePhoto('photo-1')
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_COVER_PHOTO_REASSIGN')
  })

  /** Allowed when it is the only photo, and it clears the cover. */
  it('deletes the cover when it is the last photo', async () => {
    await partnerMediaService.deletePhoto('photo-2')
    await expect(partnerMediaService.deletePhoto('photo-1')).resolves.toMatchObject({
      removed: true,
    })

    const gallery = await partnerMediaService.getMedia()
    expect(gallery.photos.count).toBe(0)
  })

  it('removes a video', async () => {
    await expect(partnerMediaService.deleteVideo('video-1')).resolves.toMatchObject({
      removed: true,
    })
  })

  it.each([
    ['a document', () => partnerMediaService.deleteDocument('nope')],
    ['a photo', () => partnerMediaService.deletePhoto('nope')],
    ['a video', () => partnerMediaService.deleteVideo('nope')],
  ] as const)('404s deleting %s that does not exist', async (_label, call) => {
    const error = (await call().catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(404)
  })
})

describe('document download', () => {
  /** A short-lived presigned GET, never a public URL. */
  it('mints a URL with its expiry', async () => {
    const result = await partnerMediaService.documentDownloadUrl('doc-1')
    expect(result.downloadUrl).toContain('signed-get')
    expect(result.expiresInSeconds).toBe(300)
  })

  it('mints a fresh URL on every call rather than reusing one', async () => {
    const calls: string[] = []
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}/:id/download-url`, ({ params }) => {
        calls.push(String(params.id))
        return HttpResponse.json({
          success: true,
          data: { downloadUrl: `https://s3/${String(calls.length)}`, expiresInSeconds: 300 },
        })
      }),
    )

    const first = await partnerMediaService.documentDownloadUrl('doc-1')
    const second = await partnerMediaService.documentDownloadUrl('doc-1')
    expect(first.downloadUrl).not.toBe(second.downloadUrl)
    expect(calls).toHaveLength(2)
  })

  it('404s for a document that does not exist', async () => {
    const error = (await partnerMediaService
      .documentDownloadUrl('nope')
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(404)
  })
})

describe('read-only while under review (BR-13)', () => {
  beforeEach(() => {
    setMockProfileStatus('PENDING')
  })

  /** Every write is refused, including the step that only issues a target. */
  it.each([
    [
      'a document upload target',
      () =>
        partnerMediaService.documentUploadTarget({ name: 'a.pdf', contentType: 'application/pdf' }),
    ],
    [
      'a photo upload target',
      () => partnerMediaService.photoUploadTarget({ name: 'a.jpg', contentType: 'image/jpeg' }),
    ],
    [
      'a video upload target',
      () => partnerMediaService.videoUploadTarget({ name: 'a.mp4', contentType: 'video/mp4' }),
    ],
    ['a document delete', () => partnerMediaService.deleteDocument('doc-1')],
    ['a photo delete', () => partnerMediaService.deletePhoto('photo-2')],
    ['a video delete', () => partnerMediaService.deleteVideo('video-1')],
    ['a cover change', () => partnerMediaService.setCoverPhoto('photo-2')],
  ] as const)('refuses %s with ERR_PROFILE_READ_ONLY', async (_label, call) => {
    const error = (await call().catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(409)
    expect(error.code).toBe('ERR_PROFILE_READ_ONLY')
  })

  /** Reads stay available — the tabs still render, just without controls. */
  it.each([
    ['the documents list', () => partnerMediaService.listDocuments()],
    ['the gallery', () => partnerMediaService.getMedia()],
  ] as const)('still allows %s', async (_label, call) => {
    await expect(call()).resolves.toBeTruthy()
  })
})

describe('the commit step', () => {
  /**
   * Commit verifies the stored object; a reference whose bytes never landed is
   * rejected rather than written as a phantom entry.
   */
  it('rejects an uploadRef with no uploaded object', async () => {
    const target = await partnerMediaService.documentUploadTarget({
      name: 'a.pdf',
      contentType: 'application/pdf',
    })
    const error = (await partnerMediaService
      .commitDocument({ uploadRef: target.uploadRef })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
  })

  /**
   * A ref that does not exist is a **404**, not a 422 (MET-1148).
   *
   * This is the shape a retried commit sees: the first attempt consumed the ref
   * and the failed verification deleted the stored object, so there is nothing
   * left to check. The distinction matters because it is what tells a client the
   * failure is terminal — retrying can only produce this same 404 — and that the
   * recovery is a fresh upload target.
   */
  it('rejects an unknown uploadRef as not found', async () => {
    const error = (await partnerMediaService
      .commitPhoto({ uploadRef: 'u-nope' })
      .catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(404)
    expect(error.code).toBe('ERR_NOT_FOUND')
  })

  it('rejects a commit with no uploadRef at all', async () => {
    const error = (await partnerMediaService
      .commitVideo({} as CommitMediaDto)
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
  })

  /**
   * The body is the `uploadRef` and nothing else.
   *
   * The API rejects unknown request fields rather than ignoring them, so an extra
   * `name` is a 422 — "this property is not allowed here", not a bad value — and
   * the upload never completes. All three kinds share one commit shape, so each
   * is asserted.
   */
  it.each([
    ['a document', PARTNER_MEDIA_ENDPOINTS.documents, partnerMediaService.commitDocument],
    ['a photo', PARTNER_MEDIA_ENDPOINTS.photos, partnerMediaService.commitPhoto],
    ['a video', PARTNER_MEDIA_ENDPOINTS.videos, partnerMediaService.commitVideo],
  ] as const)('sends only the uploadRef when committing %s', async (_label, endpoint, commit) => {
    let body: unknown
    server.use(
      http.post(`*${endpoint}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { mediaId: 'm-1' } }, { status: 201 })
      }),
    )

    await commit({ uploadRef: 'ref-1' })
    expect(body).toEqual({ uploadRef: 'ref-1' })
  })

  /**
   * And the fixtures now enforce that, so a re-added field fails the suite
   * instead of passing here and 422ing against the live API — which is exactly
   * how this bug reached production.
   */
  it.each([
    ['a document', partnerMediaService.commitDocument],
    ['a photo', partnerMediaService.commitPhoto],
    ['a video', partnerMediaService.commitVideo],
  ] as const)('422s when %s commit carries a name', async (_label, commit) => {
    const error = (await commit({
      uploadRef: 'u-1',
      name: 'bar.jpg',
    } as unknown as CommitMediaDto).catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_VALIDATION')
  })

  /**
   * Nothing is lost by not sending the name: it was recorded against the ref at
   * step 1 and comes back on the commit response, which is what lets the client
   * render the new entry without having tracked the filename itself.
   */
  it('returns the name recorded at step 1, not one supplied at commit', async () => {
    const target = await partnerMediaService.documentUploadTarget({
      name: 'Trade Licence 2025.pdf',
      contentType: 'application/pdf',
    })
    receiveMockUpload(target.uploadRef, 2048)

    const committed = await partnerMediaService.commitDocument({ uploadRef: target.uploadRef })

    expect(committed.name).toBe('Trade Licence 2025.pdf')
    expect(committed.type).toBe('PDF')
    expect(committed.size).toBe(2048)
  })

  it('returns the name on a photo commit too', async () => {
    const target = await partnerMediaService.photoUploadTarget({
      name: 'bar.jpg',
      contentType: 'image/jpeg',
    })
    receiveMockUpload(target.uploadRef, 1024)

    const committed = await partnerMediaService.commitPhoto({ uploadRef: target.uploadRef })
    expect(committed.name).toBe('bar.jpg')
  })

  it('returns the name on a video commit too', async () => {
    const target = await partnerMediaService.videoUploadTarget({
      name: 'walkthrough.mp4',
      contentType: 'video/mp4',
    })
    receiveMockUpload(target.uploadRef, 4096)

    const committed = await partnerMediaService.commitVideo({ uploadRef: target.uploadRef })
    expect(committed.name).toBe('walkthrough.mp4')
    expect(committed.status).toBe('processing')
  })
})

/**
 * The URLs the fixtures mint go straight into an `<img src>`, so an origin with
 * no handler is not a no-op: MSW passes it through, the browser resolves a host
 * that does not exist, and the gallery renders as broken images. That reads as a
 * failed upload even when all three steps returned cleanly — which is exactly
 * how it was reported.
 *
 * Fixture behaviour, asserted here because nothing in `src/app` can see it: the
 * client only ever puts the URL it was given into an `img`.
 */
describe('the mock CDN behind those URLs', () => {
  /** Real JPEG magic bytes, so the commit's own signature check passes. */
  function jpegBytes(): ArrayBuffer {
    const buffer = new ArrayBuffer(8)
    new Uint8Array(buffer).set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
    return buffer
  }

  async function uploadPhoto(bytes: ArrayBuffer): Promise<string> {
    const target = await partnerMediaService.photoUploadTarget({
      name: 'bar.jpg',
      contentType: 'image/jpeg',
    })
    receiveMockUpload(target.uploadRef, bytes.byteLength, undefined, bytes)
    const committed = await partnerMediaService.commitPhoto({ uploadRef: target.uploadRef })
    return committed.url
  }

  it('serves the uploaded bytes from the URL the commit minted', async () => {
    const bytes = jpegBytes()
    const response = await fetch(await uploadPhoto(bytes))

    expect(response.ok).toBe(true)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes))
  })

  /**
   * Every photo URL is minted as `.jpg` whatever was uploaded, and the cover key
   * is built from the same shape — so the declared type has to travel on the
   * header, which is what browsers go by.
   */
  it('serves them under the content type declared at step 1', async () => {
    const response = await fetch(await uploadPhoto(jpegBytes()))
    expect(response.headers.get('content-type')).toBe('image/jpeg')
  })

  /** Seeded photos have no bytes behind them, and must not 404 either. */
  it.each([
    ['a seeded photo', 'https://cdn.mock.local/dining-room.jpg'],
    ['a review thumbnail', 'https://cdn.mock.local/reviews/mezze-platter.jpg'],
    ['a video poster', 'https://stream.mock.local/video-1.jpg'],
  ])('serves a placeholder image for %s', async (_label, url) => {
    const response = await fetch(url)

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
  })

  /** In-memory only — a reset re-seeds the gallery, so the bytes go with it. */
  it('drops uploaded bytes on reset', async () => {
    const url = await uploadPhoto(jpegBytes())
    resetMockMedia()

    const response = await fetch(url)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
  })
})
