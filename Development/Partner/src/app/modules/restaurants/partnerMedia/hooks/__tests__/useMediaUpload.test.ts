import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockGallery,
  receiveMockUpload,
  resetMockMedia,
  setMockDocumentCount,
  MOCK_LIMITS,
} from '../../../../../../mocks/data/partnerMedia'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import {
  installXhrOverFetch,
  lastUpload,
  recordedUploads,
} from '../../../../../../test-utils/xhrOverFetch'
import {
  makeEmptyFile,
  makeMediaFile,
  makeMismatchedFile,
  makeOversizeMediaFile,
} from '../../../../../../test-utils/mediaFiles'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../../constants'
import { partnerMediaService } from '../../services'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { FileEmptyError, FileTooLargeError, useMediaUpload } from '../useMediaUpload'
import type { CommitMediaDto, MediaKind } from '../../types'

/**
 * The three-step upload, end to end against MSW: request a target, send the
 * bytes to that target, commit. The fixtures refuse a commit whose bytes never
 * landed, so a broken middle step fails here rather than silently orphaning an
 * object.
 *
 * Uploads run through `xhrOverFetch` — jsdom's XHR cannot carry a Blob or
 * FormData body (see that shim).
 */

const realXhr = globalThis.XMLHttpRequest

/**
 * Real bytes, because the fixtures size the object from the request body — and
 * since MET-1148 they inspect its signature too, so the bytes must actually look
 * like the declared type.
 */
const makeFile = makeMediaFile

/**
 * Claims a size without allocating it. Only for the oversize path, which is
 * rejected client-side before anything is sent.
 */
const makeOversizeFile = makeOversizeMediaFile

const COMMIT: Record<MediaKind, (body: CommitMediaDto) => Promise<unknown>> = {
  document: partnerMediaService.commitDocument,
  photo: partnerMediaService.commitPhoto,
  video: partnerMediaService.commitVideo,
}

/** Where each kind's commit lands, for asserting the body that reaches it. */
const COMMIT_ENDPOINT: Record<MediaKind, string> = {
  document: PARTNER_MEDIA_ENDPOINTS.documents,
  photo: PARTNER_MEDIA_ENDPOINTS.photos,
  video: PARTNER_MEDIA_ENDPOINTS.videos,
}

const PICKED_FILE: Record<MediaKind, [name: string, type: string]> = {
  document: ['licence.pdf', 'application/pdf'],
  photo: ['bar.jpg', 'image/jpeg'],
  video: ['walkthrough.mp4', 'video/mp4'],
}

function renderUpload(kind: MediaKind) {
  const queryClient = makeQueryClient()
  return renderHook(() => useMediaUpload(kind, COMMIT[kind]), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

beforeEach(() => {
  installXhrOverFetch()
  resetMockProfile()
  resetMockMedia()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  // Restored on its own: unstubAllGlobals would also drop setupTests' localStorage.
  vi.stubGlobal('XMLHttpRequest', realXhr)
})

describe('useMediaUpload — the happy path', () => {
  it('runs target → upload → commit for a document', async () => {
    const { result } = renderUpload('document')
    const committed = await result.current.run(makeFile('licence.pdf', 'application/pdf', 2048))

    expect(committed).toMatchObject({ name: 'licence.pdf', type: 'PDF', size: 2048 })
  })

  it('sends the bytes with a raw PUT for a document', async () => {
    const methods: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) methods.push(request.method)
    })

    const { result } = renderUpload('document')
    await result.current.run(makeFile('licence.pdf', 'application/pdf', 2048))

    expect(methods).toEqual(['PUT'])
    server.events.removeAllListeners()
  })

  /** Cloudflare Direct Creator Upload takes multipart, not a raw PUT. */
  it('sends the bytes as a POST for a video', async () => {
    const methods: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) methods.push(request.method)
    })

    const { result } = renderUpload('video')
    await result.current.run(makeFile('walkthrough.mp4', 'video/mp4', 4096))

    expect(methods).toEqual(['POST'])
    server.events.removeAllListeners()
  })

  it('reports a committed video as still processing', async () => {
    const { result } = renderUpload('video')
    const committed = await result.current.run(makeFile('teaser.mp4', 'video/mp4', 4096))

    expect(committed).toMatchObject({ status: 'processing' })
  })

  /** The first photo silently becomes the cover, lifting J6A's submit gate. */
  it('reports becameCover for the first photo', async () => {
    clearMockGallery()
    const { result } = renderUpload('photo')
    const committed = await result.current.run(makeFile('bar.jpg', 'image/jpeg', 1024))

    expect(committed).toMatchObject({ becameCover: true, isCover: true })
  })

  it('does not claim becameCover when a cover already exists', async () => {
    const { result } = renderUpload('photo')
    const committed = await result.current.run(makeFile('bar.jpg', 'image/jpeg', 1024))

    expect(committed).toMatchObject({ becameCover: false })
  })

  it('clears the uploading flag once finished', async () => {
    const { result } = renderUpload('document')
    await result.current.run(makeFile('licence.pdf', 'application/pdf', 2048))

    await waitFor(() => {
      expect(result.current.uploading).toBe(false)
    })
  })
})

describe('useMediaUpload — the commit body', () => {
  /**
   * The regression this suite exists to prevent.
   *
   * The commit carries the `uploadRef` and nothing else. The API rejects unknown
   * request fields rather than ignoring them, so sending the filename alongside
   * the ref — which this hook used to do — is a 422 and the upload never
   * completes. The server recorded the name at step 1; there is nothing to
   * repeat, and repeating it is what broke.
   */
  it.each(['document', 'photo', 'video'] as const)(
    'sends only the uploadRef when committing a %s',
    async (kind) => {
      let body: unknown
      server.use(
        http.post(`*${COMMIT_ENDPOINT[kind]}`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ success: true, data: { mediaId: 'm-1' } }, { status: 201 })
        }),
      )

      const { result } = renderUpload(kind)
      await result.current.run(makeFile(...PICKED_FILE[kind], 1024))

      expect(body).toEqual({ uploadRef: expect.any(String) })
      // Named explicitly: this is the exact field that caused the 422.
      expect(body).not.toHaveProperty('name')
    },
  )

  /** The filename travels with step 1 instead — that is what makes step 3 safe. */
  it.each(['document', 'photo', 'video'] as const)(
    'sends the name and content type when requesting a %s target',
    async (kind) => {
      const targetUrl = {
        document: PARTNER_MEDIA_ENDPOINTS.documentUploadUrl,
        photo: PARTNER_MEDIA_ENDPOINTS.photoUploadUrl,
        video: PARTNER_MEDIA_ENDPOINTS.videoUploadUrl,
      }[kind]
      const [name, type] = PICKED_FILE[kind]

      let body: unknown
      server.use(
        http.post(`*${targetUrl}`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            success: true,
            data: {
              uploadUrl: 'https://upload.mock.local/u-named',
              uploadRef: 'u-named',
              maxBytes: 999999,
              ...(kind === 'video'
                ? {}
                : { key: `restaurant-multimedia/restaurants/rest-1/${kind}s/u-named` }),
            },
          })
        }),
      )

      const { result } = renderUpload(kind)
      // The commit will 422 against the untouched fixtures (this ref was never
      // staged there), which is irrelevant: step 1's body is what is under test.
      await result.current.run(makeFile(name, type, 1024)).catch(() => undefined)

      expect(body).toEqual({ name, contentType: type })
    },
  )

  /**
   * The end-to-end proof that dropping the name from step 3 loses nothing: the
   * fixtures record it against the ref at step 1 and hand it back at commit,
   * exactly as the server does.
   */
  it('gets the picked filename back from the commit response', async () => {
    const { result } = renderUpload('document')
    const committed = await result.current.run(
      makeFile('Trade Licence 2025.pdf', 'application/pdf', 2048),
    )

    expect(committed).toMatchObject({ name: 'Trade Licence 2025.pdf' })
  })
})

describe('useMediaUpload — refusals move no bytes', () => {
  /**
   * The count limit is enforced at step 1, so a refused upload must never reach
   * the provider — the whole point of checking before issuing a target.
   */
  it('performs zero uploads when already at the count limit', async () => {
    setMockDocumentCount(MOCK_LIMITS.document.maxCount)
    const uploads: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) uploads.push(request.url)
    })

    const { result } = renderUpload('document')
    await expect(
      result.current.run(makeFile('licence.pdf', 'application/pdf', 2048)),
    ).rejects.toBeTruthy()

    expect(uploads).toEqual([])
    server.events.removeAllListeners()
  })

  /**
   * Checked against the limit step 1 reported, not a hardcoded default — the
   * limits are config-driven and differ per environment.
   */
  it('rejects an oversized file before uploading', async () => {
    const uploads: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) uploads.push(request.url)
    })

    const { result } = renderUpload('photo')
    const tooBig = makeOversizeFile('huge.jpg', 'image/jpeg', MOCK_LIMITS.photo.maxBytes + 1)

    await expect(result.current.run(tooBig)).rejects.toBeInstanceOf(FileTooLargeError)
    expect(uploads).toEqual([])
    server.events.removeAllListeners()
  })

  /**
   * The other side of the boundary (MET-1251).
   *
   * BR-08 states the cover image's size rule as "max 5 MB", and the case built
   * on it checks both ends: accepted *at* the limit, refused just over. The line
   * above owns "just over"; without this one the comparison could have been `>=`
   * and refused a file of exactly the permitted size with nothing to catch it.
   *
   * The limit itself is deliberately not a number here. BR-08's 5 MB contradicts
   * J6B BR-05's config-driven 10 MB, and the client resolves that by trusting
   * whatever step 1 reports — so the boundary is `MOCK_LIMITS`, and this test
   * keeps passing when the environment moves it.
   *
   * The size is claimed rather than allocated, so what this pins is the
   * client-side pre-check: 10 MB of real bytes through the upload shim would buy
   * nothing but a slow test. The server's own re-check at commit is the
   * enforcement, and the fixtures cover it from the bytes they actually receive.
   */
  it('accepts a photo of exactly the reported limit', async () => {
    const { result } = renderUpload('photo')
    const atLimit = makeOversizeFile('exact.jpg', 'image/jpeg', MOCK_LIMITS.photo.maxBytes)

    await expect(result.current.run(atLimit)).resolves.toBeTruthy()
  })

  it('carries the authoritative limit on the oversize error', async () => {
    const { result } = renderUpload('photo')
    const tooBig = makeOversizeFile('huge.jpg', 'image/jpeg', MOCK_LIMITS.photo.maxBytes + 1)

    const error = (await result.current.run(tooBig).catch((e: unknown) => e)) as FileTooLargeError
    expect(error.details.maxBytes).toBe(MOCK_LIMITS.photo.maxBytes)
    expect(error.details.actualBytes).toBe(MOCK_LIMITS.photo.maxBytes + 1)
  })

  /** Every write is refused while the profile is under review (BR-13). */
  it('refuses at step 1 while the restaurant is PENDING', async () => {
    setMockProfileStatus('PENDING')
    const { result } = renderUpload('document')

    await expect(
      result.current.run(makeFile('licence.pdf', 'application/pdf', 2048)),
    ).rejects.toBeTruthy()
  })

  it('surfaces a failed upload rather than committing anyway', async () => {
    server.use(
      http.put('https://upload.mock.local/:ref', () => new HttpResponse(null, { status: 403 })),
    )
    let committed = false
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/documents')) committed = true
    })

    const { result } = renderUpload('document')
    await expect(
      result.current.run(makeFile('licence.pdf', 'application/pdf', 2048)),
    ).rejects.toBeTruthy()

    expect(committed).toBe(false)
    server.events.removeAllListeners()
  })
})

describe('useMediaUpload — the protocol discriminator', () => {
  /**
   * A document target must carry an S3 key and a video target must not. Sending
   * a multipart body to a presigned S3 PUT would store the MIME envelope as the
   * file — S3 accepts it and the partner cannot tell it from success — so a
   * swapped protocol has to fail loudly here instead.
   */
  it('refuses a document target that arrives without a key', async () => {
    server.use(
      http.post(`*${PARTNER_MEDIA_ENDPOINTS.documentUploadUrl}`, () =>
        HttpResponse.json({
          success: true,
          data: { uploadUrl: 'https://upload.mock.local/u-x', uploadRef: 'u-x', maxBytes: 999999 },
        }),
      ),
    )

    const { result } = renderUpload('document')
    await expect(
      result.current.run(makeFile('licence.pdf', 'application/pdf', 2048)),
    ).rejects.toThrow(/omitted an S3 key/)
  })

  it('refuses a video target that arrives with a key', async () => {
    server.use(
      http.post(`*${PARTNER_MEDIA_ENDPOINTS.videoUploadUrl}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            uploadUrl: 'https://upload.mock.local/u-y',
            uploadRef: 'u-y',
            maxBytes: 999999,
            key: 'restaurant-multimedia/restaurants/rest-1/videos/u-y.mp4',
          },
        }),
      ),
    )

    const { result } = renderUpload('video')
    await expect(result.current.run(makeFile('clip.mp4', 'video/mp4', 2048))).rejects.toThrow(
      /carried an S3 key/,
    )
  })
})

describe('useMediaUpload — MET-1148, the commit verifies the uploaded bytes', () => {
  /**
   * The commit now inspects the stored object's real signature. A file whose
   * bytes contradict its declared type — a renamed `.txt`, say — is refused at
   * step 3, *after* the bytes have gone up and the progress bar has completed.
   */
  it('surfaces the 422 when the bytes contradict the declared type', async () => {
    const { result } = renderUpload('document')
    const renamed = makeMismatchedFile('licence.pdf', 'application/pdf', 'image/png')

    const error = (await result.current.run(renamed).catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(422)
    expect(error.code).toBe('ERR_MEDIA_TYPE')
  })

  /** The bytes really were sent — this is a commit-time refusal, not a pre-check. */
  it('rejects only after the upload has completed', async () => {
    const { result } = renderUpload('photo')
    const renamed = makeMismatchedFile('bar.jpg', 'image/jpeg', 'application/pdf')

    await result.current.run(renamed).catch(() => undefined)

    expect(recordedUploads).toHaveLength(1)
  })

  /**
   * The regression this block exists to prevent.
   *
   * The ref is consumed before verification and the object is deleted on
   * failure, so replaying the same commit cannot re-run the check — it returns
   * `404 ERR_NOT_FOUND` against bytes that no longer exist. A retry can only
   * turn one accurate error into a second, confusing one.
   */
  it('turns a replayed commit into a 404, which is why it must not be retried', async () => {
    const target = await partnerMediaService.documentUploadTarget({
      name: 'licence.pdf',
      contentType: 'application/pdf',
    })
    receiveMockUpload(target.uploadRef, 2048, [])

    const first = (await partnerMediaService
      .commitDocument({ uploadRef: target.uploadRef })
      .catch((e: unknown) => e)) as HttpError
    const replay = (await partnerMediaService
      .commitDocument({ uploadRef: target.uploadRef })
      .catch((e: unknown) => e)) as HttpError

    expect(first.status).toBe(422)
    expect(replay.status).toBe(404)
  })

  /** One commit per run: no retry wrapper may sit on this mutation. */
  it('issues exactly one commit for a rejected upload', async () => {
    let commits = 0
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/documents')) commits += 1
    })

    const { result } = renderUpload('document')
    await result.current
      .run(makeMismatchedFile('licence.pdf', 'application/pdf', 'image/png'))
      .catch(() => undefined)

    expect(commits).toBe(1)
    server.events.removeAllListeners()
  })

  /**
   * Recovery is a fresh target and a fresh upload, never the same ref again —
   * which is exactly what running the hook a second time does.
   */
  it('restarts from step 1 with a new uploadRef on the next attempt', async () => {
    const refs: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) refs.push(new URL(request.url).pathname)
    })

    const { result } = renderUpload('document')
    await result.current
      .run(makeMismatchedFile('licence.pdf', 'application/pdf', 'image/png'))
      .catch(() => undefined)
    await result.current.run(makeMediaFile('licence.pdf', 'application/pdf', 2048))

    expect(refs).toHaveLength(2)
    expect(refs[0]).not.toBe(refs[1])
    server.events.removeAllListeners()
  })

  /**
   * A video's bytes go to Cloudflare Stream, never to a bucket this API reads,
   * so there is nothing for the commit to inspect and MET-1148 does not apply.
   */
  it('leaves videos unaffected', async () => {
    const { result } = renderUpload('video')
    const committed = await result.current.run(
      makeMismatchedFile('clip.mp4', 'video/mp4', 'application/pdf', 4096),
    )

    expect(committed).toMatchObject({ status: 'processing' })
  })
})

describe('useMediaUpload — MET-1148, an empty file never leaves the browser', () => {
  /**
   * An empty file has no signature to match, so the server now calls it a type
   * failure — true, but unactionable for someone who picked a real PDF. Refused
   * here instead, before a target is minted, so the copy can name the actual
   * problem. This is a size check, not content sniffing.
   */
  it.each(['document', 'photo', 'video'] as const)('refuses an empty %s', async (kind) => {
    const { result } = renderUpload(kind)
    const [name, type] = PICKED_FILE[kind]

    await expect(result.current.run(makeEmptyFile(name, type))).rejects.toBeInstanceOf(
      FileEmptyError,
    )
  })

  it('mints no upload target and sends no bytes', async () => {
    const requests: string[] = []
    server.events.on('request:start', ({ request }) => {
      requests.push(request.url)
    })

    const { result } = renderUpload('document')
    await result.current.run(makeEmptyFile('licence.pdf', 'application/pdf')).catch(() => undefined)

    expect(requests).toEqual([])
    expect(recordedUploads).toEqual([])
    server.events.removeAllListeners()
  })

  it('clears the uploading flag afterwards', async () => {
    const { result } = renderUpload('document')
    await result.current.run(makeEmptyFile('licence.pdf', 'application/pdf')).catch(() => undefined)

    await waitFor(() => {
      expect(result.current.uploading).toBe(false)
    })
  })
})

describe('useMediaUpload — MET-1147, a bucket-qualified key changes nothing', () => {
  /**
   * The bucket prefix moved onto the wire `key`:
   *
   *   before → restaurants/{id}/documents/{uuid}.pdf
   *   after  → restaurant-documents/restaurants/{id}/documents/{uuid}.pdf
   *
   * Only one thing could actually have broken us — composing the upload target
   * from a host plus that key. The presigned URL already carries the object
   * path, so a concatenated target would now double-prefix it and 403 against a
   * bucket that does not exist. These cases hold the boundary: the bytes go to
   * `uploadUrl` exactly as issued, and the key never reaches the wire.
   */
  const QUALIFIED_KEY = 'restaurant-documents/restaurants/rest-1/documents/2f1c-abc.pdf'

  /** A target whose URL and key share no path, so a concatenation is visible. */
  function issueQualifiedTarget(key = QUALIFIED_KEY) {
    server.use(
      http.post(`*${PARTNER_MEDIA_ENDPOINTS.documentUploadUrl}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            uploadUrl: 'https://upload.mock.local/presigned-target?X-Amz-Signature=abc',
            uploadRef: 'u-qualified',
            maxBytes: 999999,
            expiresInSeconds: 900,
            key,
          },
        }),
      ),
      http.put(
        'https://upload.mock.local/presigned-target',
        () => new HttpResponse(null, { status: 200 }),
      ),
    )
  }

  /** The commit 422s — this ref was never staged — which is beside the point. */
  async function runDocument() {
    const { result } = renderUpload('document')
    await result.current
      .run(makeFile('licence.pdf', 'application/pdf', 2048))
      .catch(() => undefined)
  }

  it('PUTs to the issued uploadUrl verbatim, signature and all', async () => {
    issueQualifiedTarget()
    await runDocument()

    expect(lastUpload().url).toBe('https://upload.mock.local/presigned-target?X-Amz-Signature=abc')
    expect(lastUpload().method).toBe('PUT')
  })

  it('never folds the key into the upload target', async () => {
    issueQualifiedTarget()
    await runDocument()

    // Named explicitly: the bucket segment appearing here is the 403.
    expect(lastUpload().url).not.toContain('restaurant-documents')
    expect(lastUpload().url).not.toContain('2f1c-abc.pdf')
  })

  it('keeps the qualified key out of the commit body', async () => {
    let body: unknown
    issueQualifiedTarget()
    server.use(
      http.post(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { mediaId: 'm-1' } }, { status: 201 })
      }),
    )

    await runDocument()

    expect(body).toEqual({ uploadRef: 'u-qualified' })
    expect(body).not.toHaveProperty('key')
  })

  /**
   * The bucket segment is whatever `S3_BUCKET_RESTAURANT_DOCUMENTS` holds, so a
   * DevOps env-prefixed provisioning is just as valid as the bare name QA
   * expects. The client must not care either way — a shape check here would
   * pass in one environment and refuse every upload in another.
   */
  it('accepts an env-prefixed bucket without inspecting the shape', async () => {
    issueQualifiedTarget('gomingle-dev-restaurant-documents/restaurants/rest-1/documents/x.pdf')
    await runDocument()

    expect(recordedUploads).toHaveLength(1)
  })
})
