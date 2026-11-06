import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { server } from '../../../../mocks/server'
import { useUploadFileMutation } from '../hooks/useUploadsQuery'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

const pngFile = () => new File(['bytes'], 'x.png', { type: 'image/png' })

function signedUrl(url = 'https://bucket.local/covers/x.png?sig=1', key = 'covers/x.png') {
  return http.post('/api/v1/uploads/signed-url', () =>
    HttpResponse.json({ success: true, data: { uploadUrl: url, key } }),
  )
}

describe('useUploadFileMutation', () => {
  // Body content is not asserted here: jsdom Blob/File bodies do not survive the
  // request interceptor. That the file object itself becomes the request body is
  // covered precisely in services.test.ts against a `fetch` spy.
  it('requests a signed URL, PUTs to S3, then resolves with the key', async () => {
    const put = { called: false, method: '', url: '' }
    server.use(
      signedUrl(),
      http.put('https://bucket.local/covers/x.png', ({ request }) => {
        put.called = true
        put.method = request.method
        put.url = request.url
        return new HttpResponse(null, { status: 200 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })
    result.current.mutate({ file: pngFile(), purpose: 'INTEREST_TABLE_COVER' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.key).toBe('covers/x.png')
    // The bucket is hit at all — the step whose absence left S3 empty and the
    // mobile app showing a placeholder (MET-963).
    expect(put.called).toBe(true)
    expect(put.method).toBe('PUT')
    expect(put.url).toContain('covers/x.png')
  })

  it('sends a Content-Type identical to the one used to request the signed URL', async () => {
    let requestedContentType = ''
    let putContentType = ''
    server.use(
      http.post('/api/v1/uploads/signed-url', async ({ request }) => {
        requestedContentType = ((await request.json()) as { contentType: string }).contentType
        return HttpResponse.json({
          success: true,
          data: { uploadUrl: 'https://bucket.local/covers/x.jpg?sig=1', key: 'covers/x.jpg' },
        })
      }),
      http.put('https://bucket.local/covers/x.jpg', ({ request }) => {
        putContentType = request.headers.get('content-type') ?? ''
        return new HttpResponse(null, { status: 200 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })
    result.current.mutate({
      file: new File(['b'], 'x.jpg', { type: 'image/jpeg' }),
      purpose: 'INTEREST_TABLE_COVER',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // S3 signs the Content-Type, so any drift between these two produces
    // 403 SignatureDoesNotMatch.
    expect(requestedContentType).toBe('image/jpeg')
    expect(putContentType).toBe('image/jpeg')
  })

  it('fails without resolving a key when S3 rejects the PUT', async () => {
    server.use(
      signedUrl(),
      http.put('https://bucket.local/covers/x.png', () =>
        HttpResponse.text('SignatureDoesNotMatch', { status: 403 }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })
    result.current.mutate({ file: pngFile(), purpose: 'INTEREST_TABLE_COVER' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // No key is handed back, so the caller cannot persist one for absent bytes.
    expect(result.current.data).toBeUndefined()
  })

  it('does not attempt the S3 PUT when the signed-url call fails', async () => {
    let putCalls = 0
    server.use(
      http.post('/api/v1/uploads/signed-url', () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
      http.put(/^https:\/\/bucket\.local\//, () => {
        putCalls += 1
        return new HttpResponse(null, { status: 200 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })
    result.current.mutate({ file: pngFile(), purpose: 'INTEREST_TABLE_COVER' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(putCalls).toBe(0)
  })

  it('forwards the purpose and file name to the signed-url endpoint', async () => {
    let body: { fileName?: string; purpose?: string } = {}
    server.use(
      http.post('/api/v1/uploads/signed-url', async ({ request }) => {
        body = (await request.json()) as { fileName?: string; purpose?: string }
        return HttpResponse.json({
          success: true,
          data: { uploadUrl: 'https://bucket.local/topics/g.png?sig=1', key: 'topics/g.png' },
        })
      }),
      http.put('https://bucket.local/topics/g.png', () => new HttpResponse(null, { status: 200 })),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })
    result.current.mutate({
      file: new File(['b'], 'graphic.png', { type: 'image/png' }),
      purpose: 'TOPIC_GRAPHIC',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(body.fileName).toBe('graphic.png')
    expect(body.purpose).toBe('TOPIC_GRAPHIC')
  })

  // Against the default (unoverridden) signed-url handler, so this pins the mock
  // itself. The real service keys every object on a fresh randomUUID; the mock
  // used to key on purpose + extension alone, so two topic graphics came back
  // sharing one key — and one topic's image then resolved to another's, which is
  // exactly the cross-wire MET-1285 reports. A colliding mock agrees with that
  // bug instead of catching it.
  it('mints a distinct, topics/-prefixed key for each TOPIC_GRAPHIC upload', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadFileMutation(), { wrapper })

    result.current.mutate({
      file: new File(['a'], 'first.png', { type: 'image/png' }),
      purpose: 'TOPIC_GRAPHIC',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const firstKey = result.current.data?.key

    result.current.reset()
    await waitFor(() => expect(result.current.isIdle).toBe(true))

    result.current.mutate({
      file: new File(['b'], 'second.png', { type: 'image/png' }),
      purpose: 'TOPIC_GRAPHIC',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const secondKey = result.current.data?.key

    // The backend anchors TOPIC_GRAPHIC keys to the `topics/` prefix and rejects
    // anything else with 400 (MET-805).
    expect(firstKey).toMatch(/^topics\//)
    expect(secondKey).toMatch(/^topics\//)
    expect(firstKey).not.toBe(secondKey)
  })
})
