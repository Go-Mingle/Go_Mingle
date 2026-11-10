import { describe, it, expect, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { uploadsService } from '../services'
import type { SignedUrlRequest } from '../types'
import { HttpError } from '../../../../shared/api/httpClient'

describe('uploadsService.createSignedUrl', () => {
  const req: SignedUrlRequest = {
    fileName: 'founders-dinner.png',
    contentType: 'image/png',
    purpose: 'INTEREST_TABLE_COVER',
  }

  it('POSTs the request body and returns the unwrapped { uploadUrl, key }', async () => {
    let receivedBody: unknown
    server.use(
      http.post('/api/v1/uploads/signed-url', async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: { uploadUrl: 'https://bucket.local/covers/abc.png?sig=1', key: 'covers/abc.png' },
        })
      }),
    )

    const res = await uploadsService.createSignedUrl(req)
    expect(res).toEqual({
      uploadUrl: 'https://bucket.local/covers/abc.png?sig=1',
      key: 'covers/abc.png',
    })
    expect(receivedBody).toEqual(req)
  })

  it('throws HttpError on a failed response', async () => {
    server.use(
      http.post('/api/v1/uploads/signed-url', () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    await expect(uploadsService.createSignedUrl(req)).rejects.toBeInstanceOf(HttpError)
  })
})

// Asserted against a `fetch` spy rather than through MSW on purpose. jsdom's
// Blob/File does not survive this project's request interceptor — a File body
// arrives as the literal string "undefined" — so MSW cannot prove the binary was
// sent. Browsers transmit it correctly, and inspecting the call arguments is the
// only way to verify the file itself is handed over, which is the whole point of
// MET-963. `uploadToSignedUrl` calls bare `fetch` (never httpClient), so
// stubbing it here isolates exactly this function.
describe('uploadsService.uploadToSignedUrl', () => {
  const url = 'https://bucket.local/covers/abc.png?sig=1'
  const file = () => new File(['raw-bytes'], 'abc.png', { type: 'image/png' })

  let fetchSpy: ReturnType<typeof vi.spyOn>

  const stubFetch = (init: { ok: boolean; status?: number; statusText?: string }) => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: init.ok,
      status: init.status ?? (init.ok ? 200 : 403),
      statusText: init.statusText ?? (init.ok ? 'OK' : 'Forbidden'),
    } as Response)
  }

  afterEach(() => {
    fetchSpy?.mockRestore()
  })

  it('PUTs the file itself to the signed URL with the given Content-Type', async () => {
    stubFetch({ ok: true })
    const sent = file()

    await expect(uploadsService.uploadToSignedUrl(url, sent, 'image/png')).resolves.toBeUndefined()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(url)
    expect(options.method).toBe('PUT')
    // The binary is the request body — the step whose absence left S3 empty.
    expect(options.body).toBe(sent)
    expect(options.headers).toEqual({ 'Content-Type': 'image/png' })
  })

  it('attaches no Authorization header', async () => {
    stubFetch({ ok: true })
    await uploadsService.uploadToSignedUrl(url, file(), 'image/png')

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    // The URL is already signed; sending the portal's bearer token alongside it
    // makes S3 refuse the request.
    const headerKeys = Object.keys(options.headers as Record<string, string>).map((k) =>
      k.toLowerCase(),
    )
    expect(headerKeys).not.toContain('authorization')
  })

  it('sends the Content-Type it is given rather than the file’s own type', async () => {
    stubFetch({ ok: true })
    // Guards the caller's contract: whatever was signed is what gets sent, since
    // the pre-signed signature covers this header.
    await uploadsService.uploadToSignedUrl(url, file(), 'image/jpeg')

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(options.headers).toEqual({ 'Content-Type': 'image/jpeg' })
  })

  it('throws when S3 rejects the PUT with 403 SignatureDoesNotMatch', async () => {
    stubFetch({ ok: false, status: 403, statusText: 'SignatureDoesNotMatch' })
    // An unchecked response here is what let a key be persisted for bytes that
    // never landed in the bucket (MET-963).
    await expect(uploadsService.uploadToSignedUrl(url, file(), 'image/png')).rejects.toThrow(/403/)
  })

  it('throws on a 500 from the bucket', async () => {
    stubFetch({ ok: false, status: 500, statusText: 'Internal Server Error' })
    await expect(uploadsService.uploadToSignedUrl(url, file(), 'image/png')).rejects.toThrow(
      /S3 upload failed/,
    )
  })
})
