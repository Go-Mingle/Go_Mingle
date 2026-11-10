import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { installXhrOverFetch, lastUpload } from '../../../test-utils/xhrOverFetch'
import { uploadFile, UploadError } from '../uploadFile'

/**
 * The direct-to-provider upload. Documents and photos PUT raw bytes to a
 * presigned S3 URL; a video POSTs multipart to Cloudflare's Direct Creator
 * Upload target, where the field must be named exactly `file`.
 *
 * Run through `xhrOverFetch` because jsdom's own XHR stringifies a Blob body and
 * hangs on FormData — see that shim for why the production code still uses XHR.
 */

const TARGET = 'https://upload.test.local/u-1'

const realXhr = globalThis.XMLHttpRequest

function respondWith(status = 200) {
  server.use(http.all(TARGET, () => new HttpResponse(null, { status })))
}

function file(name = 'licence.pdf', type = 'application/pdf'): File {
  return new File(['hello-bytes'], name, { type })
}

beforeEach(() => {
  installXhrOverFetch()
})

afterEach(() => {
  // Restored on its own rather than with unstubAllGlobals, which would also
  // drop the localStorage stub setupTests installs at module load.
  vi.stubGlobal('XMLHttpRequest', realXhr)
  server.resetHandlers()
})

describe('uploadFile — raw PUT (documents and photos)', () => {
  it('PUTs the file itself with its own content type', async () => {
    respondWith()
    await uploadFile({ uploadUrl: TARGET, file: file(), strategy: 'put-bytes' })

    const sent = lastUpload()
    expect(sent.method).toBe('PUT')
    expect(sent.url).toBe(TARGET)
    expect(sent.headers['Content-Type']).toBe('application/pdf')
    // The body is the File, not a wrapper around it.
    expect(sent.body).toBeInstanceOf(File)
  })

  /**
   * S3 rejects a presigned request that also carries an Authorization header —
   * the signature already is the credential. This is exactly why the upload does
   * not go through `httpClient`, which would attach the session token.
   */
  it('sends no Authorization header', async () => {
    respondWith()
    await uploadFile({ uploadUrl: TARGET, file: file(), strategy: 'put-bytes' })

    expect(Object.keys(lastUpload().headers)).toEqual(['Content-Type'])
  })

  it('omits Content-Type when the file has no detectable type', async () => {
    respondWith()
    await uploadFile({
      uploadUrl: TARGET,
      file: new File(['x'], 'blob.bin'),
      strategy: 'put-bytes',
    })

    expect(lastUpload().headers['Content-Type']).toBeUndefined()
  })
})

describe('uploadFile — multipart POST (videos)', () => {
  it('POSTs a FormData whose only field is named "file"', async () => {
    respondWith()
    await uploadFile({
      uploadUrl: TARGET,
      file: file('clip.mp4', 'video/mp4'),
      strategy: 'post-multipart',
    })

    const sent = lastUpload()
    expect(sent.method).toBe('POST')
    expect(sent.body).toBeInstanceOf(FormData)

    // Cloudflare's contract, not ours: the part must be named exactly `file`.
    const form = sent.body as FormData
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file')).toBeInstanceOf(File)
  })

  /**
   * The browser must generate the multipart boundary. Setting Content-Type by
   * hand omits it and the provider cannot parse the body.
   */
  it('sets no Content-Type, leaving the boundary to the browser', async () => {
    respondWith()
    await uploadFile({
      uploadUrl: TARGET,
      file: file('clip.mp4', 'video/mp4'),
      strategy: 'post-multipart',
    })

    expect(lastUpload().headers).toEqual({})
  })

  it('sends no Authorization header', async () => {
    respondWith()
    await uploadFile({
      uploadUrl: TARGET,
      file: file('clip.mp4', 'video/mp4'),
      strategy: 'post-multipart',
    })

    expect(lastUpload().headers['Authorization']).toBeUndefined()
  })
})

describe('uploadFile — failures', () => {
  it.each([403, 404, 500])('rejects on status %i, carrying that status', async (status) => {
    respondWith(status)
    const error = (await uploadFile({
      uploadUrl: TARGET,
      file: file(),
      strategy: 'put-bytes',
    }).catch((e: unknown) => e)) as UploadError

    expect(error).toBeInstanceOf(UploadError)
    expect(error.status).toBe(status)
  })

  /**
   * A CORS preflight rejection also arrives as status 0 with no detail — the
   * browser withholds it — so a network failure and a blocked preflight are
   * deliberately indistinguishable here.
   */
  it('rejects with status 0 when the request never reaches the server', async () => {
    server.use(http.all(TARGET, () => HttpResponse.error()))
    const error = (await uploadFile({
      uploadUrl: TARGET,
      file: file(),
      strategy: 'put-bytes',
    }).catch((e: unknown) => e)) as UploadError

    expect(error).toBeInstanceOf(UploadError)
    expect(error.status).toBe(0)
  })

  it('rejects without sending anything when the signal is already aborted', async () => {
    respondWith()
    const controller = new AbortController()
    controller.abort()

    await expect(
      uploadFile({
        uploadUrl: TARGET,
        file: file(),
        strategy: 'put-bytes',
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(UploadError)
  })
})

describe('uploadFile — progress', () => {
  it('reports intermediate progress and ends at 100', async () => {
    respondWith()
    const percents: number[] = []
    await uploadFile({
      uploadUrl: TARGET,
      file: file(),
      strategy: 'put-bytes',
      onProgress: (percent) => percents.push(percent),
    })

    expect(percents).toContain(50)
    expect(percents.at(-1)).toBe(100)
  })

  it('never exceeds 100', async () => {
    respondWith()
    const percents: number[] = []
    await uploadFile({
      uploadUrl: TARGET,
      file: file(),
      strategy: 'put-bytes',
      onProgress: (percent) => percents.push(percent),
    })

    expect(Math.max(...percents)).toBeLessThanOrEqual(100)
  })

  it('completes without a progress callback', async () => {
    respondWith()
    await expect(
      uploadFile({ uploadUrl: TARGET, file: file(), strategy: 'put-bytes' }),
    ).resolves.toBeUndefined()
  })
})
